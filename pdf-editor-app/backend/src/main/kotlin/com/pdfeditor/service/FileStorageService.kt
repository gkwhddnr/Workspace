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
        val downloadsPath = ensureDownloadsDirectory()
        val sanitized = sanitizeFilename(filename)
        val targetPath = resolveTargetPath(downloadsPath, sanitized)   // ← Hook
        copyFile(file, targetPath)
        return saveToDatabase(file, filename, sanitized, targetPath)
    }

    /**
     * Hook — subclasses decide the final target [Path]:
     *   - Unique strategy: appends _(1), _(2) … suffixes
     *   - Overwrite strategy: always uses the same path
     */
    protected abstract fun resolveTargetPath(downloadsPath: Path, sanitizedName: String): Path

    // ── Fixed steps (private, not overridable) ──────────────────────────────

    private fun ensureDownloadsDirectory(): Path {
        val path = Paths.get(System.getProperty("user.home"), "Downloads")
        if (!Files.exists(path)) Files.createDirectories(path)
        return path
    }

    private fun sanitizeFilename(name: String): String =
        name.replace("""[\\/:*?"<>|]""".toRegex(), "_")

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
}

/**
 * Concrete Strategy A — Unique names: appends _(1), _(2) … if file exists.
 * Used by the "Save As" flow.
 */
@Service
class UniqueFileStorageService(
    workHistoryRepository: WorkHistoryRepository
) : AbstractFileStorageService(workHistoryRepository) {

    override fun resolveTargetPath(downloadsPath: Path, sanitizedName: String): Path {
        var finalName = sanitizedName
        var target = downloadsPath.resolve(finalName)
        var counter = 1
        while (Files.exists(target)) {
            val base = sanitizedName.substringBeforeLast(".")
            val ext  = sanitizedName.substringAfterLast(".", "pdf")
            finalName = "${base}_($counter).$ext"
            target = downloadsPath.resolve(finalName)
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

    override fun resolveTargetPath(downloadsPath: Path, sanitizedName: String): Path =
        downloadsPath.resolve(sanitizedName)
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
    fun savePdfToDownloads(file: MultipartFile, filename: String): WorkHistory =
        uniqueStrategy.save(file, filename)

    fun savePdfToDownloadsOverwrite(file: MultipartFile, filename: String): WorkHistory =
        overwriteStrategy.save(file, filename)

    fun getHistory(): List<WorkHistory> =
        workHistoryRepository.findAllByOrderBySavedAtDesc()
}
