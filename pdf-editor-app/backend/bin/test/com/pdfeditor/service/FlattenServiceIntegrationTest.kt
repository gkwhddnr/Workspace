package com.pdfeditor.service

import com.pdfeditor.model.PdfWorkspace
import com.pdfeditor.model.WorkHistory
import com.pdfeditor.repository.PdfWorkspaceRepository
import com.pdfeditor.repository.WorkHistoryRepository
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.*
import java.nio.file.Files
import java.nio.file.Paths
import java.time.LocalDateTime
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Integration test for Task 3.2: Flatten processing with automatic cleanup.
 * Validates Requirements 3.1, 3.2, 3.3
 */
class FlattenServiceIntegrationTest {

    private lateinit var pdfWorkspaceRepository: PdfWorkspaceRepository
    private lateinit var workHistoryRepository: WorkHistoryRepository
    private lateinit var flattenService: FlattenService

    @BeforeEach
    fun setup() {
        pdfWorkspaceRepository = mock(PdfWorkspaceRepository::class.java)
        workHistoryRepository = mock(WorkHistoryRepository::class.java)
        flattenService = FlattenService(pdfWorkspaceRepository, workHistoryRepository)
    }

    @AfterEach
    fun cleanup() {
        // Clean up test files
        try {
            val originalsPath = Paths.get("data", "originals")
            if (Files.exists(originalsPath)) {
                Files.list(originalsPath)
                    .filter { it.fileName.toString().startsWith("test-integration-") }
                    .forEach { Files.deleteIfExists(it) }
            }
            
            // Clean up Downloads folder
            val userHome = System.getProperty("user.home")
            val downloadsPath = Paths.get(userHome, "Downloads")
            if (Files.exists(downloadsPath)) {
                Files.list(downloadsPath)
                    .filter { it.fileName.toString().startsWith("test-integration-") }
                    .forEach { Files.deleteIfExists(it) }
            }
        } catch (e: Exception) {
            // Ignore cleanup errors
        }
    }

    @Test
    fun `flattenSinglePdf calls deleteOriginalAndDbData after successful flatten`() {
        // Arrange: Create a test PDF file
        val filename = "test-integration-flatten.pdf.pdf"
        val originalsPath = Paths.get("data", "originals")
        Files.createDirectories(originalsPath)
        val testFile = originalsPath.resolve(filename)
        
        // Create a simple PDF with PDFBox
        val document = PDDocument()
        document.addPage(PDPage())
        document.save(testFile.toFile())
        document.close()
        
        // Mock DB entities
        val workspace = PdfWorkspace(
            id = 1L,
            filename = filename,
            lastViewedPage = 1,
            updatedAt = LocalDateTime.now()
        )
        val historyRecords = listOf(
            WorkHistory(
                id = 1L,
                originalFileName = filename,
                savedFileName = "saved1.pdf",
                savedFilePath = "/path/to/saved1.pdf",
                savedAt = LocalDateTime.now()
            )
        )
        
        `when`(pdfWorkspaceRepository.findByFilename(filename)).thenReturn(workspace)
        `when`(workHistoryRepository.findAllByOriginalFileName(filename)).thenReturn(historyRecords)
        
        // Act: Process flatten
        val result = flattenService.processFlatten(listOf(filename))
        
        // Assert: Flatten was successful
        assertTrue(result.successCount == 1, "Flatten should succeed")
        assertTrue(result.results[0].success, "Result should indicate success")
        
        // Assert: Original file was deleted (Requirement 3.1)
        assertFalse(Files.exists(testFile), "Original file should be deleted after successful flatten")
        
        // Assert: DB records were deleted (Requirements 3.2, 3.3)
        verify(pdfWorkspaceRepository).delete(workspace)
        verify(workHistoryRepository).deleteAll(historyRecords)
        
        // Assert: Output file exists in Downloads
        val outputPath = Paths.get(result.results[0].outputPath!!)
        assertTrue(Files.exists(outputPath), "Flattened PDF should exist in Downloads")
    }

    @Test
    fun `flattenSinglePdf does not delete files when flatten fails`() {
        // Arrange: Create a corrupted PDF file
        val filename = "test-integration-corrupted.pdf.pdf"
        val originalsPath = Paths.get("data", "originals")
        Files.createDirectories(originalsPath)
        val testFile = originalsPath.resolve(filename)
        
        // Write invalid PDF content
        Files.write(testFile, "This is not a valid PDF".toByteArray())
        
        // Mock DB entities
        val workspace = PdfWorkspace(
            id = 1L,
            filename = filename,
            lastViewedPage = 1,
            updatedAt = LocalDateTime.now()
        )
        
        `when`(pdfWorkspaceRepository.findByFilename(filename)).thenReturn(workspace)
        `when`(workHistoryRepository.findAllByOriginalFileName(filename)).thenReturn(emptyList())
        
        // Act: Process flatten (should fail)
        val result = flattenService.processFlatten(listOf(filename))
        
        // Assert: Flatten failed
        assertTrue(result.successCount == 0, "Flatten should fail for corrupted PDF")
        assertFalse(result.results[0].success, "Result should indicate failure")
        
        // Assert: Original file still exists (not deleted on failure)
        assertTrue(Files.exists(testFile), "Original file should NOT be deleted when flatten fails")
        
        // Assert: DB records were NOT deleted
        verify(pdfWorkspaceRepository, never()).delete(any())
        verify(workHistoryRepository, never()).deleteAll(any())
    }
}
