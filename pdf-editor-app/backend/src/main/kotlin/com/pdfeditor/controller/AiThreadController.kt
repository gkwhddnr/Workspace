package com.pdfeditor.controller

import com.pdfeditor.model.AiThread
import com.pdfeditor.repository.AiThreadRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

data class AiThreadRequest(
    val id: String = "",
    val title: String = "새 대화",
    val messagesJson: String = "[]"
)

data class AiThreadResponse(
    val id: String,
    val title: String,
    val messagesJson: String,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
)

@RestController
@RequestMapping("/api/pdf/ai-threads")
class AiThreadController(
    private val repository: AiThreadRepository
) {

    @GetMapping
    fun list(): List<AiThreadResponse> =
        repository.findAllByOrderByUpdatedAtDesc().map { toResponse(it) }

    @GetMapping("/{id}")
    fun get(@PathVariable id: String): ResponseEntity<AiThreadResponse> {
        val thread = repository.findById(id).orElse(null) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(toResponse(thread))
    }

    @PostMapping
    fun save(@RequestBody request: AiThreadRequest): ResponseEntity<AiThreadResponse> {
        if (request.id.isBlank()) {
            return ResponseEntity.badRequest().build()
        }
        val now = LocalDateTime.now()
        val title = request.title.ifBlank { "새 대화" }
        val existing = repository.findById(request.id).orElse(null)
        val thread: AiThread = if (existing != null) {
            existing.title = title
            existing.messagesJson = request.messagesJson
            existing.updatedAt = now
            existing
        } else {
            AiThread(
                id = request.id,
                title = title,
                messagesJson = request.messagesJson,
                createdAt = now,
                updatedAt = now
            )
        }
        val saved = repository.save(thread)
        return ResponseEntity.ok(toResponse(saved))
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: String): ResponseEntity<Void> {
        repository.deleteById(id)
        return ResponseEntity.ok().build()
    }

    private fun toResponse(thread: AiThread): AiThreadResponse {
        val messagesJson = thread.messagesJson?.takeIf { it.isNotBlank() } ?: "[]"
        return AiThreadResponse(
            id = thread.id,
            title = thread.title,
            messagesJson = messagesJson,
            createdAt = thread.createdAt,
            updatedAt = thread.updatedAt
        )
    }
}