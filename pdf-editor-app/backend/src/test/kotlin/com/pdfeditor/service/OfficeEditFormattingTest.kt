package com.pdfeditor.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.poi.hslf.usermodel.HSLFSlideShow
import org.apache.poi.hslf.usermodel.HSLFTextShape
import org.apache.poi.xslf.usermodel.XMLSlideShow
import org.apache.poi.xslf.usermodel.XSLFTextShape
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OfficeEditFormattingTest {
    private val service = OfficeEditService(ObjectMapper())
    private val payload = """{"1":[{"type":"text","x":10,"y":10,"width":300,"height":100,"fontSize":20,"fontFamily":"Arial","text":"Plain Bold\nUnder Both","fontWeight":"normal","textDecoration":"","style":{"color":"#111827"},"spans":[{"start":6,"end":10,"fontWeight":"bold"},{"start":11,"end":16,"textDecoration":"underline"},{"start":17,"end":21,"fontWeight":"bold","textDecoration":"underline line-through"}]},{"type":"text","x":10,"y":150,"width":300,"height":50,"fontSize":20,"text":"ONoff","fontWeight":"bold","textDecoration":"underline","spans":[{"start":2,"end":5,"fontWeight":"normal","textDecoration":""}]}]}"""

    private fun check(runs: List<Triple<String, Boolean, Boolean>>) {
        val chars = runs.flatMap { (text, bold, underline) -> text.filter { it != '\n' && it != '\r' }.map { Triple(it,bold,underline) } }
        val expected = "Plain BoldUnder Both"
        assertEquals(expected,chars.map { it.first }.joinToString(""))
        chars.forEachIndexed { i, c ->
            assertEquals(i in 6..9 || i in 16..19,c.second,"bold at $i")
            assertEquals(i in 10..14 || i in 16..19,c.third,"underline at $i")
        }
    }

    @Test fun `pptx preserves partial styles after write and reopen`() {
        val original = XMLSlideShow().use { show -> show.createSlide(); ByteArrayOutputStream().also { show.write(it) }.toByteArray() }
        val edited = service.applyEdits("sample.pptx",original,payload,"{}")
        XMLSlideShow(ByteArrayInputStream(edited)).use { show ->
            val shapes = show.slides[0].shapes.filterIsInstance<XSLFTextShape>()
            val runs = shapes[0].textParagraphs.flatMap { it.textRuns }
            check(runs.map { Triple(it.rawText,it.isBold,it.isUnderlined) })
            assertTrue(runs.last().isStrikethrough)
            val defaults = shapes[1].textParagraphs.flatMap { it.textRuns }
            assertTrue(defaults.first().isBold && defaults.first().isUnderlined)
            assertTrue(!defaults.last().isBold && !defaults.last().isUnderlined)
        }
    }

    @Test fun `ppt preserves partial styles after write and reopen`() {
        val original = HSLFSlideShow().use { show -> show.createSlide(); ByteArrayOutputStream().also { show.write(it) }.toByteArray() }
        val edited = service.applyEdits("sample.ppt",original,payload,"{}")
        HSLFSlideShow(ByteArrayInputStream(edited)).use { show ->
            val shapes = show.slides[0].shapes.filterIsInstance<HSLFTextShape>()
            val runs = shapes[0].textParagraphs.flatMap { it.textRuns }
            check(runs.map { Triple(it.rawText,it.isBold,it.isUnderlined) })
            assertTrue(runs.last().isStrikethrough)
            val defaults = shapes[1].textParagraphs.flatMap { it.textRuns }
            assertTrue(defaults.first().isBold && defaults.first().isUnderlined)
            assertTrue(!defaults.last().isBold && !defaults.last().isUnderlined)
        }
    }
}
