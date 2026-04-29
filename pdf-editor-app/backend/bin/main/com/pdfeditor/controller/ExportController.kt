package com.pdfeditor.controller

import com.pdfeditor.service.ExportService
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import java.nio.charset.StandardCharsets

@RestController
@RequestMapping("/api/export")
class ExportController(private val exportService: ExportService) {

    @PostMapping("/convert")
    fun convertPdf(
        @RequestParam("file") file: MultipartFile,
        @RequestParam("format") format: String
    ): ResponseEntity<ByteArray> {
        return try {
            val convertedBytes = exportService.convertPdfToHwp(file.inputStream, format)
            
            val filename = file.originalFilename?.replace(".pdf", "") ?: "document"
            val extension = if (format.lowercase() == "hwpx") "hwpx" else "hwp"
            
            val contentDisposition = ContentDisposition.attachment()
                .filename("$filename.$extension", StandardCharsets.UTF_8)
                .build()
            
            ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(convertedBytes)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.internalServerError().build()
        }
    }
}
