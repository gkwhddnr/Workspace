package com.pdfeditor.controller

import com.pdfeditor.service.FlattenService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.nio.file.Files
import java.nio.file.Paths

data class FileInfo(
    val filename: String,
    val sizeBytes: Long
)

data class FlattenRequest(
    val filenames: List<String>
)

data class FlattenResponse(
    val successCount: Int,
    val results: List<FlattenResult>
)

data class FlattenResult(
    val filename: String,
    val success: Boolean,
    val outputPath: String?,
    val errorMessage: String?
)

@RestController
@RequestMapping("/api/pdf/flatten")
class FlattenController(
    private val flattenService: FlattenService
) {

    @GetMapping("/files")
    fun listOriginalsFiles(): ResponseEntity<List<FileInfo>> {
        val files = flattenService.listOriginalsFiles().map { FileInfo(it.filename, it.sizeBytes) }
        return ResponseEntity.ok(files)
    }

    @PostMapping("/process")
    fun processFlatten(@RequestBody request: FlattenRequest): ResponseEntity<FlattenResponse> {
        return try {
            val response = flattenService.processFlatten(request.filenames)
            ResponseEntity.ok(response)
        } catch (e: Exception) {
            e.printStackTrace()
            ResponseEntity.ok(
                FlattenResponse(
                    successCount = 0,
                    results = request.filenames.map { filename ->
                        FlattenResult(
                            filename = filename,
                            success = false,
                            outputPath = null,
                            errorMessage = "Unexpected error: ${e.message}"
                        )
                    }
                )
            )
        }
    }
}
