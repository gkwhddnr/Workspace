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

data class WorkspaceRequest(
    val filename: String = "",
    val lastViewedPage: Int = 1
)

data class ProjectDataRequest(
    val filename: String = "",
    val projectData: String = ""
)

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
            val savedHistory = fileStorageService.savePdfToWorkspace(file, filename)
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
            val savedHistory = fileStorageService.savePdfToWorkspaceOverwrite(file, filename)
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

    @PostMapping("/workspace/project-data")
    fun saveProjectData(@RequestBody request: ProjectDataRequest): ResponseEntity<Void> {
        val ws = pdfWorkspaceRepository.findByFilename(request.filename)
        return if (ws != null) {
            ws.projectData = request.projectData
            ws.updatedAt = LocalDateTime.now()
            pdfWorkspaceRepository.save(ws)
            ResponseEntity.ok().build()
        } else {
            // Create implicitly if it doesn't exist? It should exist if the file was loaded, 
            // but let's safely create it.
            val newWs = PdfWorkspace(filename = request.filename, projectData = request.projectData)
            pdfWorkspaceRepository.save(newWs)
            ResponseEntity.ok().build()
        }
    }

    @PostMapping("/workspace/original-pdf")
    fun uploadOriginalPdf(@RequestParam("file") file: MultipartFile, @RequestParam("filename") filename: String): ResponseEntity<Void> {
        // Prefer the multipart file's original filename (Spring parses it with UTF-8 encoding filter)
        // Fall back to the explicit filename param if originalFilename is blank
        val resolvedFilename = file.originalFilename?.takeIf { it.isNotBlank() } ?: filename
        println("[PdfController] uploadOriginalPdf: filename=$resolvedFilename, fileSize=${file.size}")
        fileStorageService.saveOriginalPdf(file, resolvedFilename)
        val ws = pdfWorkspaceRepository.findByFilename(resolvedFilename) ?: PdfWorkspace(filename = resolvedFilename)
        ws.hasOriginalPdf = true
        ws.updatedAt = LocalDateTime.now()
        pdfWorkspaceRepository.save(ws)
        return ResponseEntity.ok().build()
    }

    /** Reset hasOriginalPdf flag for all workspaces (call after manually deleting originals folder) */
    @PostMapping("/workspace/reset-originals")
    fun resetOriginals(): ResponseEntity<String> {
        val all = pdfWorkspaceRepository.findAll()
        all.forEach { ws ->
            ws.hasOriginalPdf = false
            ws.updatedAt = LocalDateTime.now()
            pdfWorkspaceRepository.save(ws)
        }
        println("[PdfController] resetOriginals: cleared hasOriginalPdf for ${all.size} workspaces")
        return ResponseEntity.ok("Reset ${all.size} workspaces")
    }

    @GetMapping("/workspace/original-pdf")
    fun downloadOriginalPdf(@RequestParam("filename") filename: String): ResponseEntity<org.springframework.core.io.Resource> {
        println("[PdfController] downloadOriginalPdf: filename=$filename")
        val path = fileStorageService.getOriginalPdf(filename)
        if (path != null) {
            val resource = org.springframework.core.io.UrlResource(path.toUri())
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"${filename}\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(resource)
        }
        println("[PdfController] downloadOriginalPdf: file NOT FOUND for filename=$filename")
        return ResponseEntity.notFound().build()
    }
}
