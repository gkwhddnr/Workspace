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

@RestController
@RequestMapping("/api/pdf")
class PdfController(
    private val fileStorageService: FileStorageService,
    private val officeToPdfService: OfficeToPdfService
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
}
