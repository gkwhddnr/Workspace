package com.pdfeditor.repository

import com.pdfeditor.model.WorkHistory
import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository

@Repository
interface WorkHistoryRepository : CrudRepository<WorkHistory, Long> {
    fun findAllByOrderBySavedAtDesc(): List<WorkHistory>
}
