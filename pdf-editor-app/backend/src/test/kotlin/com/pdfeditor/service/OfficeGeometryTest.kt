package com.pdfeditor.service
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.poi.hslf.usermodel.*
import org.apache.poi.xslf.usermodel.*
import org.junit.jupiter.api.Test
import java.awt.Dimension
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.test.*

class OfficeGeometryTest {
 private val service=OfficeEditService(ObjectMapper())
 private val payload="""{"1":[{"type":"text","x":100,"y":80,"width":200,"height":60,"fontSize":20,"fontFamily":"'Arial', sans-serif","text":"시제\nsecond","style":{"color":"#ff0000"}},{"type":"path","points":[{"x":100,"y":80},{"x":150,"y":120}],"style":{"color":"#ff0000","strokeWidth":4,"rasterScale":2}},{"type":"arrow","shapeType":"arrow","points":[{"x":200,"y":100},{"x":200,"y":180}],"x":200,"y":100,"width":0,"height":80,"style":{"color":"#ff0000","strokeWidth":2,"arrowHeadSize":12,"rasterScale":2}}]}"""
 @Test fun preservesPageCoordinatesAcrossFormatsAndSizes() {
  for(ext in listOf("ppt","pptx")) for(size in listOf(Dimension(720,540),Dimension(960,540),Dimension(540,720))) {
   val source=ByteArrayOutputStream().also { out ->
    if(ext=="ppt") HSLFSlideShow().use { it.pageSize=size;it.createSlide();it.write(out) }
    else XMLSlideShow().use { it.pageSize=size;it.createSlide();it.write(out) }
   }.toByteArray()
   val result=service.applyEdits("test."+ext,source,payload,"""{"1":[720,540]}""")
   val sx=size.width/720.0;val sy=size.height/540.0
   fun check(anchor:java.awt.geom.Rectangle2D,x:Double,y:Double,w:Double,h:Double) {
    assertEquals(x*sx,anchor.x,.15);assertEquals(y*sy,anchor.y,.15)
    assertEquals(w*sx,anchor.width,.15);assertEquals(h*sy,anchor.height,.15)
   }
   fun pixels(bytes:ByteArray) {val img=ImageIO.read(ByteArrayInputStream(bytes));assertEquals(116,img.width);assertEquals(96,img.height);assertTrue((img.getRGB(8,8) ushr 24)>0,"pen starts at its exact source coordinate within image padding")}
   if(ext=="ppt") HSLFSlideShow(ByteArrayInputStream(result)).use { show ->
    val shapes=show.slides[0].shapes
    val text=shapes.filterIsInstance<HSLFTextShape>().single();check(text.anchor,100.0,80.0,200.0,60.0)
    assertEquals(0.0,text.leftInset);assertEquals(0.0,text.topInset)
    assertEquals("Arial",text.textParagraphs.first().textRuns.first().fontFamily)
    assertEquals(120.0,text.textParagraphs.first().lineSpacing)
    val pictures=shapes.filterIsInstance<HSLFPictureShape>();assertEquals(2,pictures.size)
    check(pictures[0].anchor,96.0,76.0,58.0,48.0);pixels(pictures[0].pictureData.data)
    check(pictures[1].anchor,186.0,98.0,28.0,96.0)
   } else XMLSlideShow(ByteArrayInputStream(result)).use { show ->
    val shapes=show.slides[0].shapes
    val text=shapes.filterIsInstance<XSLFTextShape>().single();check(text.anchor,100.0,80.0,200.0,60.0)
    assertEquals(0.0,text.leftInset);assertEquals(0.0,text.topInset)
    assertEquals("Arial",text.textParagraphs.first().textRuns.first().fontFamily)
    assertEquals(120.0,text.textParagraphs.first().lineSpacing)
    val pictures=shapes.filterIsInstance<XSLFPictureShape>();assertEquals(2,pictures.size)
    check(pictures[0].anchor,96.0,76.0,58.0,48.0);pixels(pictures[0].pictureData.data)
    check(pictures[1].anchor,186.0,98.0,28.0,96.0)
   }
  }
 }
}
