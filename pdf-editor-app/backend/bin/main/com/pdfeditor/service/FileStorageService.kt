package com.pdfeditor.service

import com.pdfeditor.model.WorkHistory
import com.pdfeditor.repository.WorkHistoryRepository
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.time.LocalDateTime

@Service
class FileStorageService(
    private val workHistoryRepository: WorkHistoryRepository
) {

    fun savePdfToDownloads(file: MultipartFile, filename: String): WorkHistory {
        // Get the user's home directory.
        val userHome = System.getProperty("user.home")
        val downloadsPath = Paths.get(userHome, "Downloads")
        
        // Ensure Downloads directory exists (it should, but just in case)
        if (!Files.exists(downloadsPath)) {
            Files.createDirectories(downloadsPath)
        }

        // Sanitize filename
        val sanitizedName = filename.replace("[\\\\/:*?\"<>|]".toRegex(), "_")
        
        // Ensure unique filename
        var finalName = sanitizedName
        var targetLocation = downloadsPath.resolve(finalName)
        var counter = 1
        
        while (Files.exists(targetLocation)) {
            val nameWithoutExtension = sanitizedName.substringBeforeLast(".")
            val extension = sanitizedName.substringAfterLast(".", "pdf")
            finalName = "${nameWithoutExtension}_($counter).$extension"
            targetLocation = downloadsPath.resolve(finalName)
            counter++
        }

        // Copy the file to the Downloads folder
        Files.copy(file.inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING)

        // Save metadata to database
        val workHistory = WorkHistory(
            originalFileName = filename,
            savedFileName = finalName,
            savedFilePath = targetLocation.toAbsolutePath().toString(),
            fileSize = file.size
        )

        return workHistoryRepository.save(workHistory)
    }

    /**
     * 동일한 파일명이 이미 존재하면 그대로 덮어쓰는 저장 방식.
     * (프론트엔드 '저장' 버튼에서 사용)
     */
    fun savePdfToDownloadsOverwrite(file: MultipartFile, filename: String): WorkHistory {
        val userHome = System.getProperty("user.home")
        val downloadsPath = Paths.get(userHome, "Downloads")

        if (!Files.exists(downloadsPath)) {
            Files.createDirectories(downloadsPath)
        }

        val sanitizedName = filename.replace("[\\\\/:*?\"<>|]".toRegex(), "_")
        val targetLocation = downloadsPath.resolve(sanitizedName)

        // 동일 파일명에 대해 무조건 덮어쓰기
        Files.copy(file.inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING)

        val workHistory = WorkHistory(
            originalFileName = filename,
            savedFileName = sanitizedName,
            savedFilePath = targetLocation.toAbsolutePath().toString(),
            fileSize = file.size
        )

        return workHistoryRepository.save(workHistory)
    }

    fun getHistory(): List<WorkHistory> {
        return workHistoryRepository.findAllByOrderBySavedAtDesc()
    }
}
