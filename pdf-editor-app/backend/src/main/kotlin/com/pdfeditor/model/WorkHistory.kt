package com.pdfeditor.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "work_history")
data class WorkHistory(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val originalFileName: String,

    @Column(nullable = false)
    val savedFileName: String,

    @Column(nullable = false)
    val savedFilePath: String,

    @Column(nullable = false)
    val savedAt: LocalDateTime = LocalDateTime.now(),

    val fileSize: Long = 0
)
