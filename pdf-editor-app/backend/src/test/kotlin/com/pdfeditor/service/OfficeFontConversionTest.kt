package com.pdfeditor.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.mock.web.MockMultipartFile
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import java.util.zip.ZipFile
import kotlin.test.*

class OfficeFontConversionTest {
    @TempDir lateinit var temp: Path
    @Test fun `font correction preserves source and bold flags`() {
        val input = temp.resolve("input.pptx")
        val xml = """<a:rPr b="1"><a:ea typeface="Noto Sans KR"/></a:rPr><a:rPr b="0"><a:latin typeface="Arial"/></a:rPr>"""
        ZipOutputStream(Files.newOutputStream(input)).use { it.putNextEntry(ZipEntry("ppt/slides/slide1.xml")); it.write(xml.toByteArray()); it.closeEntry() }
        val before = Files.readAllBytes(input)
        val (copy, fonts) = OfficeToPdfService().prepareStaticKoreanFonts(input)
        assertContentEquals(before, Files.readAllBytes(input))
        assertEquals(2, fonts.size)
        ZipFile(copy.toFile()).use { zip ->
            val actual = zip.getInputStream(zip.getEntry("ppt/slides/slide1.xml")).reader().readText()
            assertEquals(xml.replace("Noto Sans KR", "Workspace Noto Sans KR"), actual)
        }
    }
    @Test fun `real deck export when provided`() {
        val source = System.getenv("FONT_CHECK_PPTX") ?: return
        val result = OfficeToPdfService().convertToPdf(MockMultipartFile("file", "font-check.pptx", "application/octet-stream", Files.readAllBytes(Path.of(source))))
        assertTrue(result.bytes.size > 1000)
        Files.write(Path.of(System.getenv("FONT_CHECK_PDF")), result.bytes)
    }
}
