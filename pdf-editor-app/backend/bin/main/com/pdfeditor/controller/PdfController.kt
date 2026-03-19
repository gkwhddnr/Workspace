package com.pdfeditor.controller

import com.pdfeditor.model.WorkHistory
import com.pdfeditor.service.FileStorageService
import com.pdfeditor.service.OfficeToPdfService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.web.multipart.MultipartFile
import com.pdfeditor.model.PdfWorkspace
import com.pdfeditor.repository.PdfWorkspaceRepository
import java.time.LocalDateTime

data class WorkspaceRequest(val filename: String, val lastViewedPage: Int)

@RestController
@RequestMapping("/api/pdf")
class PdfController(
    private val fileStorageService: FileStorageService,
    private val officeToPdfService: OfficeToPdfService,
    private val pdfWorkspaceRepository: PdfWorkspaceRepository
) {

    @PostMapping("/save")
    fun savePdf(
        @RequestParam("file") file: MultipartFile,
        @RequestParam("filename") filename: String
    ): ResponseEntity<WorkHistory> {
        return try {
            val savedHistory = fileStorageService.savePdfToDownloads(file, filename)
            ResponseEntity.ok(savedHistory)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError().build()
        }
    }

    @PostMapping("/save-overwrite")
    fun savePdfOverwrite(
        @RequestParam("file") file: MultipartFile,
        @RequestParam("filename") filename: String
    ): ResponseEntity<WorkHistory> {
        return try {
            val savedHistory = fileStorageService.savePdfToDownloadsOverwrite(file, filename)
            ResponseEntity.ok(savedHistory)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError().build()
        }
    }

    @PostMapping("/convert-to-pdf")
    fun convertToPdf(
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<ByteArrayResource> {
        return try {
            val converted = officeToPdfService.convertToPdf(file)
            val resource = ByteArrayResource(converted.bytes)

            ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"${converted.fileName}\""
                )
                .contentLength(converted.bytes.size.toLong())
                .body(resource)
        } catch (e: IllegalArgumentException) {
            e.printStackTrace()
            ResponseEntity.badRequest()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ByteArrayResource(("{\"error\":\"${e.message?.replace("\"", "\\\"") ?: "invalid"}\"}").toByteArray()))
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError()
                .contentType(MediaType.APPLICATION_JSON)
                .body(ByteArrayResource(("{\"error\":\"${e.message?.replace("\"", "\\\"") ?: "internal"}\"}").toByteArray()))
        }
    }

    @GetMapping("/history")
    fun getHistory(): ResponseEntity<List<WorkHistory>> {
        return try {
            val history = fileStorageService.getHistory()
            ResponseEntity.ok(history)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError().build()
        }
    }

    @GetMapping("/workspace")
    fun getWorkspace(@RequestParam("filename") filename: String): ResponseEntity<PdfWorkspace> {
        return try {
            val workspace = pdfWorkspaceRepository.findByFilename(filename)
            if (workspace != null) {
                ResponseEntity.ok(workspace)
            } else {
                ResponseEntity.notFound().build()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError().build()
        }
    }

    @PostMapping("/workspace")
    fun saveWorkspace(@RequestBody request: WorkspaceRequest): ResponseEntity<PdfWorkspace> {
        return try {
            val existing = pdfWorkspaceRepository.findByFilename(request.filename)
            val toSave = if (existing != null) {
                existing.lastViewedPage = request.lastViewedPage
                existing.updatedAt = LocalDateTime.now()
                existing
            } else {
                PdfWorkspace(
                    filename = request.filename,
                    lastViewedPage = request.lastViewedPage
                )
            }
            val saved = pdfWorkspaceRepository.save(toSave)
            ResponseEntity.ok(saved)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError().build()
        }
    }
}
