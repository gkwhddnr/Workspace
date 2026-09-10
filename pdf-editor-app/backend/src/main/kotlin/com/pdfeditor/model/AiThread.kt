package com.pdfeditor.model

import jakarta.persistence.*
import java.time.LocalDateTime

// AI 코파일럿 대화 스레드
// - id: 클라이언트가 생성한 스레드 식별자 (thread-...)
// - messagesJson: 메시지 배열을 JSON 문자열로 저장 (목록/본문을 한 번에 보관)
@Entity
@Table(name = "ai_thread")
data class AiThread(
    @Id
    @Column(length = 64)
    val id: String,

    @Column(nullable = false)
    var title: String = "새 대화",

    @Column(columnDefinition = "TEXT")
    var messagesJson: String? = null,

    @Column(nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
)