package com.pdfeditor.repository

import com.pdfeditor.model.AiThread
import org.springframework.data.jpa.repository.JpaRepository

interface AiThreadRepository : JpaRepository<AiThread, String> {
    fun findAllByOrderByUpdatedAtDesc(): List<AiThread>
}