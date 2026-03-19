package com.pdfeditor.repository

import com.pdfeditor.model.PdfWorkspace
import org.springframework.data.jpa.repository.JpaRepository

interface PdfWorkspaceRepository : JpaRepository<PdfWorkspace, Long> {
    fun findByFilename(filename: String): PdfWorkspace?
}
