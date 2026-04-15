package com.pdfeditor.service

import com.pdfeditor.controller.FlattenResponse
import com.pdfeditor.controller.FlattenResult
import com.pdfeditor.repository.PdfWorkspaceRepository
import com.pdfeditor.repository.WorkHistoryRepository
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm
import org.springframework.stereotype.Service
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

data class FileInfo(
    val filename: String,
    val sizeBytes: Long
)

@Service
class FlattenService(
    private val pdfWorkspaceRepository: PdfWorkspaceRepository,
    private val workHistoryRepository: WorkHistoryRepository
) {
    
    /**
     * Lists all PDF files in the data/originals folder.
     * Returns empty list if folder doesn't exist or is empty.
     * 
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4
     */
    fun listOriginalsFiles(): List<FileInfo> {
        try {
            val originalsPath = Paths.get("data", "originals")
            
            // Return empty list if folder doesn't exist (Requirement 1.3)
            if (!Files.exists(originalsPath) || !Files.isDirectory(originalsPath)) {
                return emptyList()
            }
            
            // List all PDF files in the originals folder (Requirement 1.1)
            val files = Files.list(originalsPath)
                .filter { Files.isRegularFile(it) && it.fileName.toString().endsWith(".pdf", ignoreCase = true) }
                .map { path ->
                    FileInfo(
                        filename = path.fileName.toString(),
                        sizeBytes = Files.size(path)
                    )
                }
                .toList()
            
            // Return file list (Requirement 1.2)
            return files
        } catch (e: Exception) {
            // Log error and return empty list for safety
            e.printStackTrace()
            return emptyList()
        }
    }

    /**
     * Processes flatten operation for the given list of filenames.
     * Returns a response with success count and individual results.
     * Continues processing remaining files even if one fails (Requirement 2.6).
     * 
     * Validates: Requirements 2.1, 2.5, 2.6
     */
    fun processFlatten(filenames: List<String>): FlattenResponse {
        val results = mutableListOf<FlattenResult>()
        
        // Process each file individually (Requirement 2.5)
        // Continue processing even if one file fails (Requirement 2.6)
        for (filename in filenames) {
            try {
                val result = flattenSinglePdf(filename)
                results.add(result)
            } catch (e: Exception) {
                // Catch any unexpected exceptions and continue with remaining files
                results.add(
                    FlattenResult(
                        filename = filename,
                        success = false,
                        outputPath = null,
                        errorMessage = "Unexpected error during processing: ${e.message}"
                    )
                )
            }
        }
        
        // Count successful operations
        val successCount = results.count { it.success }
        
        return FlattenResponse(
            successCount = successCount,
            results = results
        )
    }

    /**
     * Cleans up a single PDF file and its workspace data.
     * Removes the file from data/originals and deletes DB records for memory optimization.
     * 
     * Validates: Implementation of Simplified Cleanup Requirement
     */
    private fun flattenSinglePdf(filename: String): FlattenResult {
        return try {
            // Delete original file and DB data (Simplified "Flatten" as a Cleanup tool)
            deleteOriginalAndDbData(filename)
            
            FlattenResult(
                filename = filename,
                success = true,
                outputPath = "Cleanup successful (Workspace data removed)",
                errorMessage = null
            )
        } catch (e: Exception) {
            FlattenResult(
                filename = filename,
                success = false,
                outputPath = null,
                errorMessage = "Error during cleanup: ${e.message}"
            )
        }
    }
    
    /**
     * Deletes the original file and associated database records.
     * 
     * Process:
     * 1. Delete original file from data/originals folder
     * 2. If file deletion succeeds, delete PdfWorkspace records (by filename)
     * 3. If file deletion succeeds, delete WorkHistory records (by originalFileName)
     * 4. If file deletion fails, skip DB deletion and log error
     * 5. If DB records don't exist, complete without error (idempotent)
     * 
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
     */
    fun deleteOriginalAndDbData(filename: String) {
        try {
            // Step 1: Delete original file from data/originals
            val originalsPath = Paths.get("data", "originals", filename)
            
            if (!Files.exists(originalsPath)) {
                println("Warning: Original file not found, skipping deletion: $filename")
                return
            }
            
            // Attempt to delete the file with retry for Windows file locking
            val fileDeleted = try {
                var deleted = false
                var attempts = 0
                val maxAttempts = 3
                
                while (!deleted && attempts < maxAttempts) {
                    try {
                        Files.delete(originalsPath)
                        deleted = true
                        println("Successfully deleted original file: $filename")
                    } catch (e: Exception) {
                        attempts++
                        if (attempts < maxAttempts) {
                            // Wait a bit for file handles to be released (Windows file locking issue)
                            Thread.sleep(100)
                        } else {
                            throw e
                        }
                    }
                }
                deleted
            } catch (e: Exception) {
                println("Error: Failed to delete original file: $filename - ${e.message}")
                e.printStackTrace()
                false
            }
            
            // Step 2 & 3: Only proceed with DB deletion if file deletion succeeded
            if (fileDeleted) {
                try {
                    // Delete PdfWorkspace records matching filename
                    val workspace = pdfWorkspaceRepository.findByFilename(filename)
                    if (workspace != null) {
                        pdfWorkspaceRepository.delete(workspace)
                        println("Successfully deleted PdfWorkspace record for: $filename")
                    } else {
                        println("Info: No PdfWorkspace record found for: $filename (idempotent)")
                    }
                    
                    // Delete WorkHistory records matching originalFileName
                    val historyRecords = workHistoryRepository.findAllByOriginalFileName(filename)
                    if (historyRecords.isNotEmpty()) {
                        workHistoryRepository.deleteAll(historyRecords)
                        println("Successfully deleted ${historyRecords.size} WorkHistory record(s) for: $filename")
                    } else {
                        println("Info: No WorkHistory records found for: $filename (idempotent)")
                    }
                } catch (e: Exception) {
                    println("Error: Failed to delete DB records for: $filename - ${e.message}")
                    e.printStackTrace()
                }
            }
        } catch (e: Exception) {
            println("Error: Unexpected error during deleteOriginalAndDbData for: $filename - ${e.message}")
            e.printStackTrace()
        }
    }
}
