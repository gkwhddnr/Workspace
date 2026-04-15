package com.pdfeditor.service

import com.pdfeditor.model.WorkHistory
import com.pdfeditor.repository.WorkHistoryRepository
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption

/**
 * Template Method Pattern — Abstract base for PDF file save operations.
 *
 * The template method [save] defines the invariant steps of the algorithm:
 *   1. Ensure the Downloads directory exists
 *   2. Sanitize the filename
 *   3. [resolveTargetPath] — HOOK: overridden by subclasses to control naming
 *   4. Copy the file to the target path
 *   5. Persist metadata to the database
 *
 * Subclasses only override step 3; everything else is shared.
 */
abstract class AbstractFileStorageService(
    protected val workHistoryRepository: WorkHistoryRepository
) {
    /** Template Method — the fixed algorithm skeleton. */
    fun save(file: MultipartFile, filename: String): WorkHistory {
        val storagePath = ensureOriginalsDirectory()
        val sanitized = Companion.sanitizeFilename(filename)
        val targetPath = resolveTargetPath(storagePath, sanitized)   // ← Hook
        copyFile(file, targetPath)
        return saveToDatabase(file, filename, sanitized, targetPath)
    }

    /**
     * Hook — subclasses decide the final target [Path]:
     *   - Unique strategy: appends _(1), _(2) … suffixes (Save As)
     *   - Overwrite strategy: always uses the same path (Save)
     */
    protected abstract fun resolveTargetPath(storagePath: Path, sanitizedName: String): Path

    // ── Fixed steps (private, not overridable) ──────────────────────────────

    private fun ensureOriginalsDirectory(): Path {
        val path = Paths.get("data", "originals")
        if (!Files.exists(path)) Files.createDirectories(path)
        return path
    }

    private fun copyFile(file: MultipartFile, target: Path) {
        Files.copy(file.inputStream, target, StandardCopyOption.REPLACE_EXISTING)
    }

    private fun saveToDatabase(
        file: MultipartFile,
        originalName: String,
        savedName: String,
        target: Path
    ): WorkHistory {
        val history = WorkHistory(
            originalFileName = originalName,
            savedFileName = savedName,
            savedFilePath = target.toAbsolutePath().toString(),
            fileSize = file.size
        )
        return workHistoryRepository.save(history)
    }

    companion object {
        /**
         * Helper to ensure the filename is valid for the OS.
         */
        fun sanitizeFilename(name: String): String =
            name.replace("""[\\/:*?"<>|]""".toRegex(), "_")
    }
}

/**
 * Concrete Strategy A — Unique names: appends _(1), _(2) … if file exists.
 * Used by the "Save As" flow.
 */
@Service
class UniqueFileStorageService(
    workHistoryRepository: WorkHistoryRepository
) : AbstractFileStorageService(workHistoryRepository) {

    override fun resolveTargetPath(storagePath: Path, sanitizedName: String): Path {
        var finalName = sanitizedName
        var target = storagePath.resolve(finalName)
        var counter = 1
        while (Files.exists(target)) {
            val base = sanitizedName.substringBeforeLast(".")
            val ext  = sanitizedName.substringAfterLast(".", "pdf")
            finalName = "${base}_(${counter}).$ext"
            target = storagePath.resolve(finalName)
            counter++
        }
        return target
    }
}

/**
 * Concrete Strategy B — Overwrite: always writes to the same path.
 * Used by the "Save" (overwrite) flow.
 */
@Service
class OverwriteFileStorageService(
    workHistoryRepository: WorkHistoryRepository
) : AbstractFileStorageService(workHistoryRepository) {

    override fun resolveTargetPath(storagePath: Path, sanitizedName: String): Path =
        storagePath.resolve(sanitizedName)
}

/**
 * Facade service that exposes the two save strategies under a single class.
 * [PdfController] injects this instead of the individual strategies.
 */
@Service
class FileStorageService(
    private val uniqueStrategy: UniqueFileStorageService,
    private val overwriteStrategy: OverwriteFileStorageService,
    private val workHistoryRepository: WorkHistoryRepository
) {
    fun savePdfToWorkspace(file: MultipartFile, filename: String): WorkHistory =
        uniqueStrategy.save(file, filename)

    fun savePdfToWorkspaceOverwrite(file: MultipartFile, filename: String): WorkHistory =
        overwriteStrategy.save(file, filename)

    fun getHistory(): List<WorkHistory> =
        workHistoryRepository.findAllByOrderBySavedAtDesc()

    private fun buildTargetPath(filename: String): Path {
        val sanitized = AbstractFileStorageService.sanitizeFilename(filename)
        // Ensure only one .pdf extension, case-insensitive
        val targetName = if (sanitized.lowercase().endsWith(".pdf")) {
            sanitized
        } else {
            "$sanitized.pdf"
        }
        val targetPath = Paths.get("data", "originals", targetName)
        println("[FileStorageService] buildTargetPath: filename=$filename -> targetPath=${targetPath.toAbsolutePath()}")
        return targetPath
    }

    fun saveOriginalPdf(file: MultipartFile, filename: String) {
        println("[FileStorageService] saveOriginalPdf: starting save for $filename")
        val path = buildTargetPath(filename)
        println("[FileStorageService] saveOriginalPdf: saving to ${path.toAbsolutePath()}")
        val parent = path.parent
        if (!Files.exists(parent)) Files.createDirectories(parent)
        Files.copy(file.inputStream, path, StandardCopyOption.REPLACE_EXISTING)
    }

    fun getOriginalPdf(filename: String): Path? {
        val target = buildTargetPath(filename)
        println("[FileStorageService] getOriginalPdf: looking for ${target.toAbsolutePath()}")
        return if (Files.exists(target)) target else null
    }
}
