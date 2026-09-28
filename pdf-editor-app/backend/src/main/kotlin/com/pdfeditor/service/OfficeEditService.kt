package com.pdfeditor.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.apache.poi.hslf.usermodel.*
import org.apache.poi.sl.usermodel.PictureData
import org.apache.poi.sl.usermodel.ShapeType
import org.apache.poi.xslf.usermodel.*
import java.awt.BasicStroke
import java.awt.Color
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.geom.Path2D
import java.awt.geom.Rectangle2D
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max

/**
 * Renders the app's annotation elements (pen / highlighter / shapes / text)
 * back onto the original Office slide file. The resulting document keeps the
 * original editable shapes, so the user can keep working in PowerPoint later.
 */
@Service
class OfficeEditService(private val objectMapper: ObjectMapper) {

    private data class Pt(val x: Double, val y: Double)

    fun applyEdits(fileName: String, bytes: ByteArray, elementsJson: String, pageSizesJson: String): ByteArray {
        val lower = fileName.lowercase()
        return when {
            lower.endsWith(".pptx") -> editPptx(bytes, elementsJson, pageSizesJson)
            lower.endsWith(".ppt") -> editPpt(bytes, elementsJson, pageSizesJson)
            else -> throw IllegalArgumentException("지원하지 않는 오피스 형식입니다: $fileName")
        }
    }

    // ---------------------------------------------------------------------
    // PPTX (OOXML)
    // ---------------------------------------------------------------------
    private fun editPptx(bytes: ByteArray, elementsJson: String, pageSizesJson: String): ByteArray {
        XMLSlideShow(ByteArrayInputStream(bytes)).use { show ->
            val (root, pageSizes) = parsePayload(elementsJson, pageSizesJson)
            val slides = show.slides
            val dim = show.pageSize
            val slideW = dim.width.toDouble()
            val slideH = dim.height.toDouble()

            for ((idx, slide) in slides.withIndex()) {
                val items = root.get((idx + 1).toString()) ?: continue
                if (!items.isArray) continue
                val wPt = pageSizes[(idx + 1).toString()]?.first
                val hPt = pageSizes[(idx + 1).toString()]?.second
                val sx = if (wPt != null && wPt > 0) slideW / wPt else 1.0
                val sy = if (hPt != null && hPt > 0) slideH / hPt else 1.0
                for (item in items) addElementToXslf(slide, item, sx, sy)
            }

            val out = ByteArrayOutputStream()
            show.write(out)
            return out.toByteArray()
        }
    }

    private fun addElementToXslf(slide: XSLFSlide, item: JsonNode, sx: Double, sy: Double) {
        val type = item.path("type").asText()
        val style = item.path("style")
        val color = safeColor(style.path("color").asText("#2563EB"))
        val strokeWidth = style.path("strokeWidth").asDouble(2.0)
        val opacity = style.path("opacity").asDouble(1.0)

        when (type) {
            "path" -> insertPng(
                slide,
                renderPathPng(item.path("points"), color, strokeWidth, opacity, style.path("rasterScale").asDouble(2.0)),
                item,
                sx,
                sy,
                pathBbox(item)
            )
            "text" -> addTextToXslf(slide, item, sx, sy)
            "highlight" -> addShapeToSlide(
                slide, ShapeType.RECT, xOf(item), yOf(item),
                wOf(item), hOf(item), sx, sy, style,
                fill = true, opacity = opacity
            )
            "rect" -> addShapeToSlide(
                slide, ShapeType.RECT, xOf(item), yOf(item),
                wOf(item), hOf(item), sx, sy, style,
                fill = false, opacity = opacity
            )
            "circle" -> addShapeToSlide(
                slide, ShapeType.ELLIPSE, xOf(item), yOf(item),
                wOf(item), hOf(item), sx, sy, style,
                fill = false, opacity = opacity
            )
            "arrow", "arrow-up", "arrow-down", "arrow-left", "arrow-right",
            "arrow-l-1", "arrow-l-2" -> insertPng(
                slide,
                renderArrowPng(item, color, strokeWidth, opacity),
                item,
                sx,
                sy,
                shapeBbox(item)
            )
            "image" -> insertImageElement(slide, item, sx, sy)
            "group" -> item.path("children").takeIf { it.isArray }?.forEach { child ->
                addElementToXslf(slide, child, sx, sy)
            }
        }
    }

    private fun addTextToXslf(slide: XSLFSlide, item: JsonNode, sx: Double, sy: Double) {
        val text = item.path("text").asText("")
        if (text.isBlank()) return
        val x = xOf(item)
        val y = yOf(item)
        val w = item.path("width").asDouble(200.0)
        val h = item.path("height").asDouble(item.path("fontSize").asDouble(12.0) * 1.4)
        val fontSize = item.path("fontSize").asDouble(12.0)
        val fontFamily = item.path("fontFamily").asText("Outfit, sans-serif")
        val textColor = safeColor(item.path("style").path("color").asText("#111827"))

        val tb = slide.createTextBox()
        tb.anchor = Rectangle2D.Double(x * sx, y * sy, max(1.0, w * sx), max(1.0, h * sy))
        tb.wordWrap = true

        tb.clearText()
        var offset = 0
        text.split('\n').forEach { line ->
            val paragraph = tb.addNewTextParagraph()
            styledRuns(item, line, offset).forEach { part ->
                val run = paragraph.addNewTextRun()
                run.setText(part.text)
                run.fontSize = fontSize * sy
                run.fontFamily = fontFamily
                run.setFontColor(textColor)
                run.isBold = part.bold
                run.isUnderlined = part.underline
                run.isStrikethrough = part.strike
            }
            offset += line.length + 1
        }
    }

    private fun addShapeToSlide(
        slide: XSLFSlide,
        shapeType: ShapeType,
        x: Double, y: Double, w: Double, h: Double,
        sx: Double, sy: Double,
        style: JsonNode,
        fill: Boolean,
        opacity: Double
    ) {
        if (w <= 0 || h <= 0) return
        val sh = slide.createAutoShape()
        sh.shapeType = shapeType
        sh.anchor = Rectangle2D.Double(x * sx, y * sy, w * sx, h * sy)

        val color = safeColor(style.path("color").asText("#2563EB"))
        val strokeWidth = style.path("strokeWidth").asDouble(2.0)

        if (fill) {
            sh.setFillColor(alphaColor(color, opacity))
            sh.setLineColor(null)
        } else {
            sh.setFillColor(null)
            sh.setLineColor(color)
            sh.lineWidth = strokeWidth * (sx + sy) / 2.0
        }
    }

    private fun insertPng(
        slide: XSLFSlide,
        pngBytes: ByteArray?,
        item: JsonNode,
        sx: Double, sy: Double,
        bboxOrg: FloatArray
    ) {
        if (pngBytes == null || bboxOrg == null) return
        val bw = bboxOrg[2].toDouble()
        val bh = bboxOrg[3].toDouble()
        if (bw <= 0 || bh <= 0) return
        val data = slide.slideShow.addPicture(pngBytes, PictureData.PictureType.PNG)
        val pic = slide.createPicture(data)
        pic.anchor = Rectangle2D.Double(
            bboxOrg[0] * sx,
            bboxOrg[1] * sy,
            bw * sx,
            bh * sy
        )
    }

    private fun insertImageElement(slide: XSLFSlide, item: JsonNode, sx: Double, sy: Double) {
        val src = item.path("imageSrc").asText("")
        if (!src.startsWith("data:image/")) return
        val comma = src.indexOf(',')
        if (comma < 0) return
        val base64 = src.substring(comma + 1)
        val bytes = java.util.Base64.getDecoder().decode(base64)
        val data = slide.slideShow.addPicture(bytes, PictureData.PictureType.PNG)
        val pic = slide.createPicture(data)
        pic.anchor = Rectangle2D.Double(
            xOf(item) * sx,
            yOf(item) * sy,
            max(1.0, wOf(item) * sx),
            max(1.0, hOf(item) * sy)
        )
    }

    // ---------------------------------------------------------------------
    // PPT (binary / HSLF)
    // ---------------------------------------------------------------------
    private fun editPpt(bytes: ByteArray, elementsJson: String, pageSizesJson: String): ByteArray {
        HSLFSlideShow(ByteArrayInputStream(bytes)).use { show ->
            val (root, pageSizes) = parsePayload(elementsJson, pageSizesJson)
            val slides = show.slides
            val dim = show.pageSize
            val slideW = dim.width.toDouble()
            val slideH = dim.height.toDouble()

            for ((idx, slide) in slides.withIndex()) {
                val items = root.get((idx + 1).toString()) ?: continue
                if (!items.isArray) continue
                val wPt = pageSizes[(idx + 1).toString()]?.first
                val hPt = pageSizes[(idx + 1).toString()]?.second
                val sx = if (wPt != null && wPt > 0) slideW / wPt else 1.0
                val sy = if (hPt != null && hPt > 0) slideH / hPt else 1.0
                for (item in items) addElementToHslf(slide, item, sx, sy)
            }

            val out = ByteArrayOutputStream()
            show.write(out)
            return out.toByteArray()
        }
    }

    private fun addElementToHslf(slide: HSLFSlide, item: JsonNode, sx: Double, sy: Double) {
        val type = item.path("type").asText()
        val style = item.path("style")
        val color = safeColor(style.path("color").asText("#2563EB"))
        val strokeWidth = style.path("strokeWidth").asDouble(2.0)
        val opacity = style.path("opacity").asDouble(1.0)

        when (type) {
            "path" -> insertPngHslf(
                slide,
                renderPathPng(item.path("points"), color, strokeWidth, opacity, style.path("rasterScale").asDouble(2.0)),
                pathBbox(item), sx, sy
            )
            "text" -> addTextToHslf(slide, item, sx, sy)
            "highlight" -> addShapeToHslf(slide, true, ShapeType.RECT, xOf(item), yOf(item), wOf(item), hOf(item), sx, sy, style, opacity)
            "rect" -> addShapeToHslf(slide, false, ShapeType.RECT, xOf(item), yOf(item), wOf(item), hOf(item), sx, sy, style, opacity)
            "circle" -> addShapeToHslf(slide, false, ShapeType.ELLIPSE, xOf(item), yOf(item), wOf(item), hOf(item), sx, sy, style, opacity)
            "arrow", "arrow-up", "arrow-down", "arrow-left", "arrow-right",
            "arrow-l-1", "arrow-l-2" -> insertPngHslf(
                slide,
                renderArrowPng(item, color, strokeWidth, opacity),
                shapeBbox(item), sx, sy
            )
            "image" -> insertImageElementHslf(slide, item, sx, sy)
        }
    }

    private fun addTextToHslf(slide: HSLFSlide, item: JsonNode, sx: Double, sy: Double) {
        val text = item.path("text").asText("")
        if (text.isBlank()) return
        val tb = slide.createTextBox()
        tb.anchor = Rectangle2D.Double(
            xOf(item) * sx,
            yOf(item) * sy,
            max(1.0, item.path("width").asDouble(200.0) * sx),
            max(1.0, item.path("height").asDouble(item.path("fontSize").asDouble(12.0) * 1.4) * sy)
        )
        val fontSize = item.path("fontSize").asDouble(12.0)
        val fontFamily = item.path("fontFamily").asText("Outfit, sans-serif")
        val textColor = safeColor(item.path("style").path("color").asText("#111827"))

        var offset = 0
        var first = true
        text.split('\n').forEachIndexed { lineIndex, line ->
            styledRuns(item, line, offset).forEachIndexed { partIndex, part ->
                val run = if (first) tb.setText(part.text)
                    else tb.appendText(part.text, lineIndex > 0 && partIndex == 0)
                first = false
                run.setFontSize(fontSize * sy)
                run.setFontFamily(fontFamily)
                run.setFontColor(textColor)
                run.setBold(part.bold)
                run.setUnderlined(part.underline)
                run.setStrikethrough(part.strike)
            }
            offset += line.length + 1
        }
    }

    private data class StyledRun(val text: String, val bold: Boolean, val underline: Boolean, val strike: Boolean)

    // JS and Kotlin both use UTF-16 offsets; newline offsets must count across paragraphs.
    private fun styledRuns(item: JsonNode, line: String, offset: Int): List<StyledRun> {
        val spans = item.path("spans").takeIf { it.isArray }?.toList() ?: emptyList()
        val boundaries = sortedSetOf(0, line.length)
        for (span in spans) {
            boundaries.add((span.path("start").asInt() - offset).coerceIn(0, line.length))
            boundaries.add((span.path("end").asInt() - offset).coerceIn(0, line.length))
        }
        fun part(start: Int, end: Int): StyledRun {
            var weight = item.path("fontWeight").asText("normal")
            var decoration = item.path("textDecoration").asText("")
            for (span in spans) {
                if (offset + start >= span.path("start").asInt() && offset + start < span.path("end").asInt()) {
                    if (span.hasNonNull("fontWeight")) weight = span.path("fontWeight").asText()
                    if (span.hasNonNull("textDecoration")) decoration = span.path("textDecoration").asText()
                }
            }
            return StyledRun(line.substring(start, end), weight == "bold" || weight == "700",
                decoration.contains("underline"), decoration.contains("line-through"))
        }
        return if (line.isEmpty()) listOf(part(0, 0)) else boundaries.toList().zipWithNext { start, end -> part(start, end) }
    }

    private fun addShapeToHslf(
        slide: HSLFSlide,
        fill: Boolean,
        shapeType: ShapeType,
        x: Double, y: Double, w: Double, h: Double,
        sx: Double, sy: Double,
        style: JsonNode,
        opacity: Double
    ) {
        if (w <= 0 || h <= 0) return
        val color = safeColor(style.path("color").asText("#2563EB"))
        val strokeWidth = style.path("strokeWidth").asDouble(2.0)

        if (fill) {
            // HSLF(.ppt)는 셰이프 필의 알파(투명도)를 지원하지 않는다. 불투명한 RECT를
            // 그대로 넣으면 형광펜 영역이 내용을 덮어 가리므로, pptx의 반투명 결과와
            // 동일하게 투명도가 적용된 PNG로 렌더링해 삽입한다.
            val png = renderRectPng(color, w, h, fill = true, strokeWidth = 0.0, opacity = opacity, rasterScale = style.path("rasterScale").asDouble(2.0))
            insertPngHslf(
                slide, png,
                floatArrayOf(x.toFloat(), y.toFloat(), w.toFloat(), h.toFloat()),
                sx, sy
            )
            return
        }

        val sh = HSLFAutoShape(shapeType)
        sh.anchor = Rectangle2D.Double(x * sx, y * sy, w * sx, h * sy)
        sh.fillColor = null
        sh.lineColor = color
        sh.lineWidth = strokeWidth * (sx + sy) / 2.0
        slide.addShape(sh)
    }

    private fun insertPngHslf(slide: HSLFSlide, pngBytes: ByteArray?, bboxOrg: FloatArray, sx: Double, sy: Double) {
        if (pngBytes == null) return
        val bw = bboxOrg[2].toDouble()
        val bh = bboxOrg[3].toDouble()
        if (bw <= 0 || bh <= 0) return
        val data = slide.slideShow.addPicture(pngBytes, PictureData.PictureType.PNG)
        val pic = HSLFPictureShape(data)
        pic.anchor = Rectangle2D.Double(bboxOrg[0] * sx, bboxOrg[1] * sy, bw * sx, bh * sy)
        slide.addShape(pic)
    }

    private fun insertImageElementHslf(slide: HSLFSlide, item: JsonNode, sx: Double, sy: Double) {
        val src = item.path("imageSrc").asText("")
        if (!src.startsWith("data:image/")) return
        val comma = src.indexOf(',')
        if (comma < 0) return
        val bytes = java.util.Base64.getDecoder().decode(src.substring(comma + 1))
        val data = slide.slideShow.addPicture(bytes, PictureData.PictureType.PNG)
        val pic = HSLFPictureShape(data)
        pic.anchor = Rectangle2D.Double(
            xOf(item) * sx,
            yOf(item) * sy,
            max(1.0, wOf(item) * sx),
            max(1.0, hOf(item) * sy)
        )
        slide.addShape(pic)
    }

    // ---------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------
    private fun parsePayload(elementsJson: String, pageSizesJson: String): Pair<JsonNode, Map<String, Pair<Double, Double>>> {
        val root = if (elementsJson.isBlank()) objectMapper.createObjectNode() else objectMapper.readTree(elementsJson)
        val sizesNode = if (pageSizesJson.isBlank()) null else try {
            objectMapper.readTree(pageSizesJson)
        } catch (e: Exception) {
            null
        }
        val pageSizes = mutableMapOf<String, Pair<Double, Double>>()
        sizesNode?.fields()?.forEach { (k, v) ->
            if (v.isArray && v.size() >= 2) {
                pageSizes[k] = v[0].asDouble(0.0) to v[1].asDouble(0.0)
            }
        }
        return root to pageSizes
    }

    private fun safeColor(hex: String): Color = try {
        Color.decode(hex.trim())
    } catch (e: Exception) {
        Color(0x25, 0x63, 0xEB)
    }

    private fun alphaColor(base: Color, alpha: Double): Color {
        val a = (alpha.coerceIn(0.0, 1.0) * 255).toInt()
        return Color(base.red, base.green, base.blue, a)
    }

    private fun xOf(item: JsonNode) = item.path("x").asDouble(0.0)
    private fun yOf(item: JsonNode) = item.path("y").asDouble(0.0)
    private fun wOf(item: JsonNode) = item.path("width").asDouble(0.0)
    private fun hOf(item: JsonNode) = item.path("height").asDouble(0.0)

    /** Bounding box of a path element (x, y, w, h) including stroke padding. */
    private fun pathBbox(item: JsonNode): FloatArray {
        val pts = item.path("points")
        if (!pts.isArray || pts.isEmpty) return FloatArray(4)
        var minX = Double.MAX_VALUE
        var minY = Double.MAX_VALUE
        var maxX = -Double.MAX_VALUE
        var maxY = -Double.MAX_VALUE
        for (p in pts) {
            val px = p.path("x").asDouble(0.0)
            val py = p.path("y").asDouble(0.0)
            if (px < minX) minX = px
            if (px > maxX) maxX = px
            if (py < minY) minY = py
            if (py > maxY) maxY = py
        }
        val pad = item.path("style").path("strokeWidth").asDouble(2.0) / 2.0
        return floatArrayOf(
            (minX - pad).toFloat(),
            (minY - pad).toFloat(),
            (maxX - minX + item.path("style").path("strokeWidth").asDouble(2.0)).toFloat(),
            (maxY - minY + item.path("style").path("strokeWidth").asDouble(2.0)).toFloat()
        )
    }

    /** Bounding box of a shape element (x, y, w, h). */
    private fun shapeBbox(item: JsonNode): FloatArray =
        floatArrayOf(xOf(item).toFloat(), yOf(item).toFloat(), wOf(item).toFloat(), hOf(item).toFloat())

    private fun renderPathPng(pointsNode: JsonNode, color: Color, strokeWidth: Double, opacity: Double, rasterScale: Double): ByteArray? {
        if (!pointsNode.isArray || pointsNode.isEmpty) return null
        val pts = ArrayList<Pt>(pointsNode.size())
        for (p in pointsNode) {
            pts.add(Pt(p.path("x").asDouble(0.0), p.path("y").asDouble(0.0)))
        }
        return renderPng(
            strokeWidth, opacity,
            minX = pts.minOf { it.x }, minY = pts.minOf { it.y },
            maxX = pts.maxOf { it.x }, maxY = pts.maxOf { it.y }, rasterScale = rasterScale
        ) { g2d, pad ->
            val path = Path2D.Double()
            path.moveTo(pts[0].x, pts[0].y)
            for (i in 1 until pts.size) path.lineTo(pts[i].x, pts[i].y)
            g2d.color = color
            g2d.stroke = BasicStroke(strokeWidth.toFloat(), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND)
            g2d.draw(path)
        }
    }

    /** Filled (highlight) or outlined rect as a transparent PNG for HSLF (.ppt). */
    private fun renderRectPng(color: Color, w: Double, h: Double, fill: Boolean, strokeWidth: Double, opacity: Double, rasterScale: Double = 2.0): ByteArray? {
        return renderPng(
            if (fill) 0.0 else strokeWidth, opacity, 0.0, 0.0, w, h, rasterScale
        ) { g2d, _ ->
            if (fill) {
                // opacity를 알파 채널에 반영 → 사각형이 내용을 가리지 않고 반투명하게 보인다
                g2d.color = alphaColor(color, opacity)
                g2d.fillRect(0, 0, w.toInt(), h.toInt())
            } else {
                g2d.color = color
                g2d.stroke = BasicStroke(strokeWidth.toFloat(), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND)
                g2d.drawRect(0, 0, w.toInt(), h.toInt())
            }
        }
    }

    private fun renderArrowPng(item: JsonNode, color: Color, strokeWidth: Double, opacity: Double): ByteArray? {
        val ptsNode = item.path("points")
        if (!ptsNode.isArray || ptsNode.size() < 2) return null

        val pts = ArrayList<Pt>(ptsNode.size())
        for (p in ptsNode) {
            pts.add(Pt(p.path("x").asDouble(0.0), p.path("y").asDouble(0.0)))
        }

        val shapeType = item.path("shapeType").asText("arrow")
        val elbow = if (shapeType.startsWith("arrow-l-") && pts.size == 2) {
            Pt(if (shapeType == "arrow-l-2") pts[0].x else pts[1].x,
               if (shapeType == "arrow-l-2") pts[1].y else pts[0].y)
        } else null

        val pts2 = if (elbow != null) listOf(pts[0], elbow, pts[1]) else pts
        val arrowFrom = if (elbow != null) elbow else pts[pts.size - 2]
        val arrowTo = pts[pts.size - 1]

        var minX = pts2.minOf { it.x }
        var minY = pts2.minOf { it.y }
        var maxX = pts2.maxOf { it.x }
        var maxY = pts2.maxOf { it.y }

        val headLen = (item.path("style").path("arrowHeadSize").asDouble(12.0))
            .coerceAtLeast(strokeWidth * 2.5)
        minX = minOf(minX, arrowTo.x - headLen)
        minY = minOf(minY, arrowTo.y - headLen)
        maxX = maxOf(maxX, arrowTo.x + headLen)
        maxY = maxOf(maxY, arrowTo.y + headLen)

        return renderPng(
            strokeWidth, opacity, minX, minY, maxX, maxY, item.path("style").path("rasterScale").asDouble(2.0)
        ) { g2d, _ ->
            g2d.color = color
            g2d.stroke = BasicStroke(strokeWidth.toFloat(), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND)

            val strokePath = Path2D.Double()
            strokePath.moveTo(pts2[0].x, pts2[0].y)
            for (i in 1 until pts2.size) strokePath.lineTo(pts2[i].x, pts2[i].y)
            g2d.draw(strokePath)

            // Arrow head
            val angle = Math.atan2(arrowTo.y - arrowFrom.y, arrowTo.x - arrowFrom.x)
            val tx = arrowTo.x
            val ty = arrowTo.y
            val headPath = Path2D.Double()
            headPath.moveTo(tx, ty)
            headPath.lineTo(tx - headLen * Math.cos(angle - Math.PI / 6), ty - headLen * Math.sin(angle - Math.PI / 6))
            headPath.moveTo(tx, ty)
            headPath.lineTo(tx - headLen * Math.cos(angle + Math.PI / 6), ty - headLen * Math.sin(angle + Math.PI / 6))
            g2d.draw(headPath)
        }
    }

    private inline fun renderPng(
        strokeWidth: Double,
        opacity: Double,
        minX: Double, minY: Double, maxX: Double, maxY: Double,
        rasterScale: Double = 2.0,
        draw: (Graphics2D, Double) -> Unit
    ): ByteArray? {
        val pad = strokeWidth
        val w = maxX - minX + pad * 2
        val h = maxY - minY + pad * 2
        if (w <= 0 || h <= 0) return null

        val scale = if (rasterScale.isFinite()) rasterScale.coerceIn(1.0, 3.0) else 2.0
        val imgW = max(1, ceil(w * scale).toInt())
        val imgH = max(1, ceil(h * scale).toInt())
        val img = BufferedImage(imgW, imgH, BufferedImage.TYPE_INT_ARGB)
        val g2d = img.createGraphics()
        try {
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
            g2d.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE)
            g2d.translate((-minX + pad) * scale, (-minY + pad) * scale)
            g2d.scale(scale, scale)
            draw(g2d, pad)
        } finally {
            g2d.dispose()
        }

        val out = ByteArrayOutputStream()
        ImageIO.write(img, "png", out)
        return out.toByteArray()
    }
}