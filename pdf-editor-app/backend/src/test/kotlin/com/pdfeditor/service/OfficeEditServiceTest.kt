package com.pdfeditor.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.poi.hslf.usermodel.HSLFAutoShape
import org.apache.poi.hslf.usermodel.HSLFSlideShow
import org.apache.poi.hslf.usermodel.HSLFTextBox
import org.apache.poi.hslf.usermodel.HSLFPictureShape
import org.apache.poi.sl.usermodel.ShapeType
import org.junit.jupiter.api.Test
import java.awt.geom.Rectangle2D
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OfficeEditServiceTest {

    private val service = OfficeEditService(ObjectMapper())

    private fun createBasePpt(): ByteArray {
        val show = HSLFSlideShow()
        val slide = show.createSlide()
        val tb = HSLFTextBox()
        tb.text = "Underline content"
        tb.anchor = Rectangle2D.Double(20.0, 20.0, 300.0, 40.0)
        slide.addShape(tb)
        val out = ByteArrayOutputStream()
        show.write(out)
        return out.toByteArray()
    }

    @Test
    fun `highlight is inserted as semi-transparent PNG, not an opaque rect`() {
        val elementsJson = """
            {
              "1": [
                {"type":"highlight","x":30.0,"y":80.0,"width":320.0,"height":160.0,
                 "style":{"color":"#FFEB3B","opacity":0.3,"strokeWidth":2.0}}
              ]
            }
        """.trimIndent()
        val pageSizesJson = """{"1":[720.0,540.0]}"""

        val edited = service.applyEdits("test.ppt", createBasePpt(), elementsJson, pageSizesJson)

        HSLFSlideShow(ByteArrayInputStream(edited)).use { show ->
            val slide = show.slides.first()
            // 불투명 사각형(HSLFAutoShape fill)이 남아 있으면 안 된다
            assertTrue(
                slide.shapes.none { it is HSLFAutoShape },
                "highlight는 RECT 셰이프가 아니라 PNG여야 합니다 (불투명 사각형 금지)"
            )
            val pic = slide.shapes.filterIsInstance<HSLFPictureShape>().firstOrNull()
            assertTrue(pic != null, "형광펜 PNG 이미지가 삽입되어야 합니다")
            val png = pic.pictureData.data
            val img = ImageIO.read(ByteArrayInputStream(png))
            assertTrue(img != null, "PNG 디코딩 실패")
            // PNG 내부 픽셀 중 반투명(0 < alpha < 255)한 것이 있어야 한다
            var translucent = false
            for (y in 0 until img.height step 4) {
                for (x in 0 until img.width step 4) {
                    val rgb = img.getRGB(x, y)
                    val a = (rgb ushr 24) and 0xFF
                    if (a in 1..254) { translucent = true; break }
                }
                if (translucent) break
            }
            assertTrue(translucent, "형광펜 PNG는 반투명(alpha 0< a <255)해야 합니다")
        }
    }

    @Test
    fun `rect and circle keep their own shape types in ppt`() {
        val elementsJson = """
            {
              "1": [
                {"type":"rect","x":40.0,"y":40.0,"width":120.0,"height":80.0,
                 "style":{"color":"#FF0000","opacity":1.0,"strokeWidth":3.0}},
                {"type":"circle","x":200.0,"y":40.0,"width":80.0,"height":80.0,
                 "style":{"color":"#00FF00","opacity":1.0,"strokeWidth":3.0}}
              ]
            }
        """.trimIndent()
        val pageSizesJson = """{"1":[720.0,540.0]}"""

        val edited = service.applyEdits("test.ppt", createBasePpt(), elementsJson, pageSizesJson)

        HSLFSlideShow(ByteArrayInputStream(edited)).use { show ->
            val shapes = show.slides.first().shapes.filterIsInstance<HSLFAutoShape>()
            assertEquals(2, shapes.size, "rect + circle 2개 셰이프 생성")
            assertEquals(ShapeType.RECT, shapes[0].shapeType, "rect는 RECT 타입")
            assertEquals(ShapeType.ELLIPSE, shapes[1].shapeType, "circle은 ELLIPSE 타입")
        }
    }
}