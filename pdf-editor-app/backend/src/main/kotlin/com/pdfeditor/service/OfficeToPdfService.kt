package com.pdfeditor.service

import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import jakarta.annotation.PostConstruct
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.io.path.deleteIfExists
import kotlin.io.path.extension
import kotlin.io.path.isRegularFile
import kotlin.io.path.nameWithoutExtension

@Service
class OfficeToPdfService {

    private val warmupExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "office-pdf-warmup").apply { isDaemon = true }
    }

    private val BOM_UTF8: ByteArray = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())

    /**
     * LibreOffice headless는 첫 실행 시 사용자 프로파일 생성/언어팩 로드로 매우 느리다.
     * 앱이 뜨는 즉시 작은 문서를 headless로 1회 변환해 프로파일을 미리 만들어,
     * 최초의 실제 변환 요청이 120초 타임아웃에 걸리지 않도록 한다.
     */
    @PostConstruct
    fun warmUpLibreOffice() {
        val soffice = findSofficeExecutable() ?: return
        warmupExecutor.submit {
            try {
                val tmpDir = Files.createTempDirectory("pdf-editor-loo-warmup-")
                try {
                    // 최소한의 빈 .txt 문서를 만들고 PDF로 변환
                    val input = tmpDir.resolve("warmup.txt")
                    Files.writeString(input, "LibreOffice warm-up")
                    val outDir = tmpDir.resolve("out").also { Files.createDirectories(it) }

                    val command = listOf(
                        soffice.toString(),
                        "--headless",
                        "--nologo",
                        "--nodefault",
                        "--nolockcheck",
                        "--nofirststartwizard",
                        "--convert-to", "pdf",
                        "--outdir", outDir.toString(),
                        input.toString()
                    )
                    val process = ProcessBuilder(command)
                        .redirectErrorStream(true)
                        .directory(outDir.toFile())
                        .start()
                    val output = ByteArrayOutputStream()
                    val reader = Thread {
                        process.inputStream.use { it.copyTo(output) }
                    }.apply { isDaemon = true; start() }

                    if (process.waitFor(180, TimeUnit.SECONDS)) {
                        reader.join(2000)
                        if (process.exitValue() == 0) {
                            println("[OfficeToPdfService] LibreOffice warm-up 완료 (프로파일 준비됨).")
                        } else {
                            println("[OfficeToPdfService] LibreOffice warm-up 실패:\n${output.toString(Charset.defaultCharset())}")
                        }
                    } else {
                        process.destroyForcibly()
                        println("[OfficeToPdfService] LibreOffice warm-up 타임아웃.")
                    }
                } finally {
                    deleteRecursively(tmpDir)
                }
            } catch (e: Exception) {
                println("[OfficeToPdfService] LibreOffice warm-up 예외: ${e.message}")
            }
        }
    }

    fun convertToPdf(file: MultipartFile): ConvertedPdf {
        val originalName = (file.originalFilename ?: "document").trim().ifEmpty { "document" }
        val ext = originalName.substringAfterLast('.', "").lowercase()
        if (ext != "ppt" && ext != "pptx") {
            throw IllegalArgumentException("현재는 PPT/PPTX만 PDF로 변환할 수 있습니다. (입력: $originalName)")
        }

        val workDir = Files.createTempDirectory("pdf-editor-convert-")
        try {
            val safeBaseName = sanitizeFileBaseName(originalName.substringBeforeLast('.'))
            // 임시 파일명은 항상 ASCII로 고정한다. 한글 등 비-ASCII 파일명은
            // PowerShell이 UTF-8 스크립트를 ANSI로 해석하면서 깨지기 때문이다.
            val inputPath = workDir.resolve("input.$ext")
            file.inputStream.use { Files.copy(it, inputPath) }

            val outDir = workDir.resolve("out").also { Files.createDirectories(it) }

            // LibreOffice -> PowerPoint COM fallback
            val generatedPdf = convertWithLibreOffice(inputPath, outDir)
                ?: convertWithPowerPoint(inputPath, outDir)
                ?: throw IllegalStateException(
                    "PPT/PPTX를 PDF로 변환할 수 있는 도구가 없습니다. " +
                        "LibreOffice를 설치하거나 Microsoft PowerPoint를 설치해 주세요."
                )

            val bytes = Files.readAllBytes(generatedPdf)
            val convertedName = "${safeBaseName}.pdf"
            return ConvertedPdf(fileName = convertedName, bytes = bytes)
        } finally {
            deleteRecursively(workDir)
        }
    }

    data class ConvertedPdf(
        val fileName: String,
        val bytes: ByteArray
    )

    /** Convert via LibreOffice headless CLI. Returns null if unavailable or on failure. */
    private fun convertWithLibreOffice(inputPath: Path, outDir: Path): Path? {
        val soffice = findSofficeExecutable() ?: return null

        val command = listOf(
            soffice.toString(),
            "--headless",
            "--nologo",
            "--nodefault",
            "--nolockcheck",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            "--outdir",
            outDir.toString(),
            inputPath.toString()
        )

        return try {
            val process = ProcessBuilder(command)
                .redirectErrorStream(true)
                .directory(outDir.toFile())
                .start()

            val output = ByteArrayOutputStream()
            val readerThread = Thread {
                process.inputStream.use { input -> input.copyTo(output) }
            }.apply { isDaemon = true; start() }

            val finished = process.waitFor(90, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                null
            } else {
                readerThread.join(2000)
                if (process.exitValue() != 0) {
                    println("[OfficeToPdfService] LibreOffice convert failed:\n${output.toString(Charset.defaultCharset())}")
                    null
                } else {
                    locateGeneratedPdf(outDir)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /** Convert via Microsoft PowerPoint COM (PowerShell). Returns null if unavailable or on failure. */
    private fun convertWithPowerPoint(inputPath: Path, outDir: Path): Path? {
        val outPath = outDir.resolve("input.pdf").apply { Files.deleteIfExists(this) }

        val script = buildString {
            appendLine("\$ErrorActionPreference = 'Continue'")
            appendLine("\$ppt = New-Object -ComObject PowerPoint.Application")
            appendLine("try {")
            appendLine("  \$pres = \$ppt.Presentations.Open('${psQuote(inputPath.toString())}', \$true, \$false, \$false)")
            appendLine("  \$pres.SaveAs('${psQuote(outPath.toString())}', 32)") // 32 = ppSaveAsPDF
            appendLine("  \$pres.Close()")
            appendLine("  Write-Output 'PPT2PDF_OK'")
            appendLine("} catch {")
            appendLine("  Write-Output \"PPT2PDF_ERR: \$_\"")
            appendLine("} finally {")
            appendLine("  try { \$ppt.Quit() } catch { }")
            appendLine("}")
            appendLine("exit 0")
        }

        val scriptFile = Files.createTempFile("ppt2pdf-", ".ps1")
        return try {
            // BOM 없이 UTF-8로 쓰면 PowerShell 5.1이 ANSI로 해석해
            // 비-ASCII 문자가 깨질 수 있으므로 BOM을 붙여 쓴다.
            Files.write(scriptFile, BOM_UTF8.plus(script.toByteArray(Charsets.UTF_8)))
            val command = listOf(
                "powershell.exe", "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", scriptFile.toString()
            )
            val process = ProcessBuilder(command)
                .redirectErrorStream(true)
                .directory(outDir.toFile())
                .start()

            val output = ByteArrayOutputStream()
            val readerThread = Thread {
                process.inputStream.use { input -> input.copyTo(output) }
            }.apply { isDaemon = true; start() }

            val finished = process.waitFor(120, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                null
            } else {
                readerThread.join(2000)
                if (process.exitValue() != 0) {
                    println("[OfficeToPdfService] PowerPoint convert failed:\n${output.toString(Charset.defaultCharset())}")
                    null
                } else if (Files.exists(outPath) && Files.size(outPath) > 0) {
                    outPath
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            runCatching { Files.deleteIfExists(scriptFile) }
        }
    }

    private fun locateGeneratedPdf(outDir: Path): Path? =
        Files.list(outDir).use { stream ->
            stream.filter { it.isRegularFile() && it.extension.lowercase() == "pdf" }
                .findFirst()
                .orElse(null)
        }

    /** Escape a file path for embedding inside a single-quoted PowerShell string. */
    private fun psQuote(path: String): String =
        path.replace("'", "''")

    private fun sanitizeFileBaseName(name: String): String {
        val trimmed = name.trim().ifEmpty { "document" }
        return trimmed.replace(Regex("[\\\\/:*?\"<>|]"), "_")
    }

    private fun findSofficeExecutable(): Path? {
        // Highest priority: explicit env vars
        val loPath = System.getenv("LIBREOFFICE_PATH")?.trim()?.takeIf { it.isNotEmpty() }
        if (loPath != null) {
            val p = Paths.get(loPath)
            if (Files.exists(p)) return p
        }

        val loHome = System.getenv("LIBREOFFICE_HOME")?.trim()?.takeIf { it.isNotEmpty() }
        if (loHome != null) {
            val candidate = Paths.get(loHome, "program", sofficeExeName())
            if (Files.exists(candidate)) return candidate
        }

        // Common Windows install locations
        val windowsCandidates = listOf(
            Paths.get("C:\\Program Files\\LibreOffice\\program\\${sofficeExeName()}"),
            Paths.get("C:\\Program Files (x86)\\LibreOffice\\program\\${sofficeExeName()}")
        )
        for (c in windowsCandidates) {
            if (Files.exists(c)) return c
        }

        // Fallback: rely on PATH
        val onPath = Paths.get(sofficeExeName())
        return if (onPath.toFile().canExecute() || commandExists(sofficeExeName())) onPath else null
    }

    private fun commandExists(name: String): Boolean {
        return try {
            val process = ProcessBuilder(if (isWindows()) listOf("where", name) else listOf("which", name))
                .redirectErrorStream(true)
                .start()
            process.waitFor(5, TimeUnit.SECONDS)
            process.exitValue() == 0
        } catch (e: Exception) {
            false
        }
    }

    private fun sofficeExeName(): String =
        if (isWindows()) "soffice.exe" else "soffice"

    private fun isWindows(): Boolean =
        System.getProperty("os.name").lowercase().contains("win")

    private fun deleteRecursively(root: Path) {
        if (!Files.exists(root)) return
        Files.walk(root)
            .sorted(Comparator.reverseOrder())
            .forEach { p ->
                runCatching { p.deleteIfExists() }
            }
    }
}