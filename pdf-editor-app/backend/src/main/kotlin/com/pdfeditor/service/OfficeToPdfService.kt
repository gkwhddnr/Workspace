package com.pdfeditor.service

import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.concurrent.TimeUnit
import kotlin.io.path.deleteIfExists
import kotlin.io.path.extension
import kotlin.io.path.isRegularFile
import kotlin.io.path.nameWithoutExtension

@Service
class OfficeToPdfService {
    fun convertToPdf(file: MultipartFile): ConvertedPdf {
        val originalName = (file.originalFilename ?: "document").trim().ifEmpty { "document" }
        val ext = originalName.substringAfterLast('.', "").lowercase()
        if (ext != "ppt" && ext != "pptx") {
            throw IllegalArgumentException("현재는 PPT/PPTX만 PDF로 변환할 수 있습니다. (입력: $originalName)")
        }

        val soffice = findSofficeExecutable()
            ?: throw IllegalStateException(
                "LibreOffice(soffice)를 찾을 수 없습니다. LibreOffice를 설치하고 PATH에 soffice를 추가하거나, " +
                    "환경 변수 LIBREOFFICE_HOME 또는 LIBREOFFICE_PATH를 설정해 주세요."
            )

        val workDir = Files.createTempDirectory("pdf-editor-convert-")
        try {
            val safeBaseName = sanitizeFileBaseName(originalName.substringBeforeLast('.'))
            val inputPath = workDir.resolve("$safeBaseName.$ext")
            file.inputStream.use { Files.copy(it, inputPath) }

            val outDir = workDir.resolve("out").also { Files.createDirectories(it) }

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

            val process = ProcessBuilder(command)
                .redirectErrorStream(true)
                .directory(workDir.toFile())
                .start()

            val output = ByteArrayOutputStream()
            val readerThread = Thread {
                process.inputStream.use { input -> input.copyTo(output) }
            }.apply { isDaemon = true; start() }

            val finished = process.waitFor(90, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                throw IllegalStateException("PPT 변환이 시간 초과로 중단되었습니다. (90초)")
            }

            readerThread.join(2000)

            if (process.exitValue() != 0) {
                val msg = output.toString(Charset.defaultCharset())
                throw IllegalStateException("PPT 변환에 실패했습니다. LibreOffice 출력:\n$msg")
            }

            val generatedPdf = Files.list(outDir).use { stream ->
                stream.filter { it.isRegularFile() && it.extension.lowercase() == "pdf" }
                    .findFirst()
                    .orElse(null)
            } ?: throw IllegalStateException("변환된 PDF 파일을 찾을 수 없습니다.")

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
        return Paths.get(sofficeExeName())
    }

    private fun sofficeExeName(): String =
        if (System.getProperty("os.name").lowercase().contains("win")) "soffice.exe" else "soffice"

    private fun deleteRecursively(root: Path) {
        if (!Files.exists(root)) return
        Files.walk(root)
            .sorted(Comparator.reverseOrder())
            .forEach { p ->
                runCatching { p.deleteIfExists() }
            }
    }
}

