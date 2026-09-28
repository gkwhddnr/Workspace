package com.pdfeditor.service
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.poi.hslf.usermodel.HSLFSlideShow
import org.apache.poi.hslf.usermodel.HSLFPictureShape
import org.apache.poi.xslf.usermodel.XMLSlideShow
import org.apache.poi.xslf.usermodel.XSLFPictureShape
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.test.*
class OfficeSaveQualityTest {
    @Test fun `quality increases raster resolution without changing geometry in both formats`() {
        val service=OfficeEditService(ObjectMapper())
        for (ext in listOf("ppt","pptx")) {
            val bytes=ByteArrayOutputStream().also { out ->
                if(ext=="ppt") HSLFSlideShow().use { it.createSlide();it.write(out) }
                else XMLSlideShow().use { it.createSlide();it.write(out) }
            }.toByteArray()
            fun dimensions(scale:Int): Pair<Int,Double> {
                val payload="""{"1":[{"id":"pen","type":"path","points":[{"x":10,"y":10},{"x":100,"y":80}],"style":{"color":"#2563EB","strokeWidth":3,"rasterScale":$scale}}]}"""
                val edited=service.applyEdits("test.$ext",bytes,payload,"{}")
                return if(ext=="ppt") HSLFSlideShow(ByteArrayInputStream(edited)).use { show ->
                    val pic=show.slides[0].shapes.filterIsInstance<HSLFPictureShape>().single()
                    ImageIO.read(ByteArrayInputStream(pic.pictureData.data)).width to pic.anchor.width
                } else XMLSlideShow(ByteArrayInputStream(edited)).use { show ->
                    val pic=show.slides[0].shapes.filterIsInstance<XSLFPictureShape>().single()
                    ImageIO.read(ByteArrayInputStream(pic.pictureData.data)).width to pic.anchor.width
                }
            }
            val low=dimensions(1);val high=dimensions(3)
            assertEquals(low.first*3,high.first)
            assertEquals(low.second,high.second)
        }
    }
}
