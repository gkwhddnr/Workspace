package com.pdfeditor.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "pdf_workspace")
data class PdfWorkspace(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true)
    val filename: String,

    @Column(nullable = false)
    var lastViewedPage: Int = 1,

    @Column(nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(columnDefinition = "TEXT")
    var projectData: String? = null,

    @Column(nullable = true)
    var hasOriginalPdf: Boolean? = false
)
