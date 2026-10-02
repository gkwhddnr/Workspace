registerPlugin({
  id: "editorial-diagram",
  name: "Editorial Diagram",
  version: "1.0.0",
  description: "텍스트(A -> B -> C)로 에디토리얼 스타일 SVG 다이어그램을 만들고 내려받습니다.",
  hooks: {
    onActivate(ctx) {
      ctx.log("editorial-diagram activated");
    },
    onRun(ctx) {
      const s = ctx.api.editor.getState();
      ctx.notify("현재 " + s.currentPage + " / " + s.numPages + " 페이지 · 다이어그램을 다시 그립니다.", "info");
      if (ui) ui.render();
    },
    onDeactivate(ctx) {
      ctx.log("editorial-diagram deactivated");
    },
    onDocumentChange(ctx, payload) {
      if (ui && (payload.type === "page" || payload.type === "document")) ui.updatePage();
    }
  },
  render: {
    kind: "component",
    mount(container, ctx) {
      const ac = new AbortController();
      const opt = { signal: ac.signal };
      const NS = "http://www.w3.org/2000/svg";
      const INK = "#1a1a1a", PAPER = "#f6f3ec", ACCENT = "#b5482a", MUTED = "#8a8578";

      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:10px;font:13px system-ui,sans-serif;";

      const pageLabel = document.createElement("div");
      pageLabel.style.cssText = "font-size:12px;opacity:.7;";

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.value = "PDF 다이어그램 흐름";
      titleInput.placeholder = "제목";
      titleInput.style.cssText = "padding:6px;border:1px solid #999;border-radius:4px;";

      const area = document.createElement("textarea");
      area.rows = 6;
      area.value = "PDF 열기 -> 페이지 분석 -> 다이어그램 생성 -> SVG 내보내기\n페이지 분석 -> 요약 메모";
      area.style.cssText = "padding:6px;border:1px solid #999;border-radius:4px;font-family:ui-monospace,monospace;";

      const hint = document.createElement("div");
      hint.style.cssText = "font-size:11px;opacity:.6;";
      hint.textContent = "한 줄에 하나씩 'A -> B -> C' 형식으로 입력합니다. '#'으로 시작하는 줄은 무시합니다.";

      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
      function makeBtn(label) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText = "padding:6px 10px;border:1px solid #999;border-radius:4px;cursor:pointer;";
        bar.appendChild(b);
        return b;
      }
      const btnRender = makeBtn("그리기");
      const btnDownload = makeBtn("SVG 다운로드");
      const btnCopy = makeBtn("SVG 복사");

      const preview = document.createElement("div");
      preview.style.cssText = "overflow-x:auto;border:1px solid #999;border-radius:4px;background:" + PAPER + ";min-height:80px;";

      wrap.append(pageLabel, titleInput, area, hint, bar, preview);
      container.appendChild(wrap);

      let currentSvg = null;

      function el(tag, attrs, text) {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        if (text != null) e.textContent = text;
        return e;
      }

      function textWidth(str) {
        let w = 0;
        for (const ch of str) w += ch.charCodeAt(0) > 255 ? 13 : 7.4;
        return w;
      }

      function parse(src) {
        const nodes = [];
        const edges = [];
        const add = (n) => { if (!nodes.includes(n) && nodes.length < 40) nodes.push(n); };
        src.split(/\r?\n/).forEach((raw) => {
          const line = raw.trim();
          if (!line || line[0] === "#") return;
          const parts = line.split("->").map((p) => p.trim()).filter(Boolean);
          parts.forEach(add);
          for (let i = 1; i < parts.length; i++) {
            if (nodes.includes(parts[i - 1]) && nodes.includes(parts[i])) edges.push([parts[i - 1], parts[i]]);
          }
        });
        return { nodes, edges };
      }

      function buildSvg(title, src) {
        const { nodes, edges } = parse(src);
        if (!nodes.length) return null;

        const layer = {};
        nodes.forEach((n) => { layer[n] = 0; });
        for (let iter = 0; iter < nodes.length; iter++) {
          let changed = false;
          edges.forEach(([a, b]) => {
            if (a !== b && layer[b] < layer[a] + 1 && layer[a] + 1 < nodes.length) {
              layer[b] = layer[a] + 1;
              changed = true;
            }
          });
          if (!changed) break;
        }

        const H = 44, GAP_X = 70, ROW = 70, PAD = 40, TOP = 64;
        const cols = [];
        nodes.forEach((n) => { (cols[layer[n]] = cols[layer[n]] || []).push(n); });
        const colList = cols.filter(Boolean);
        const maxCount = Math.max.apply(null, colList.map((c) => c.length));

        const pos = {};
        let x = PAD;
        colList.forEach((col) => {
          const w = Math.max(120, Math.max.apply(null, col.map((n) => textWidth(n))) + 32);
          col.forEach((n, i) => {
            pos[n] = { x: x, y: TOP + (maxCount - col.length) * ROW / 2 + i * ROW, w: w };
          });
          x += w + GAP_X;
        });

        const width = x - GAP_X + PAD;
        const height = TOP + maxCount * ROW + 50;

        const svg = el("svg", {
          xmlns: NS, viewBox: "0 0 " + width + " " + height,
          width: width, height: height
        });
        svg.style.maxWidth = "none";

        const defs = el("defs", {});
        const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
        marker.appendChild(el("path", { d: "M0,0 L10,5 L0,10 z", fill: INK }));
        defs.appendChild(marker);
        svg.appendChild(defs);

        svg.appendChild(el("rect", { x: 0, y: 0, width: width, height: height, fill: PAPER }));
        svg.appendChild(el("text", {
          x: PAD, y: 32, fill: INK, "font-size": "16", "font-weight": "600",
          "font-family": "Georgia, 'Noto Serif KR', serif"
        }, title || "Diagram"));
        svg.appendChild(el("line", { x1: PAD, y1: 42, x2: width - PAD, y2: 42, stroke: ACCENT, "stroke-width": "1.5" }));

        edges.forEach(([a, b]) => {
          const pa = pos[a], pb = pos[b];
          let d;
          if (layer[b] > layer[a]) {
            const sx = pa.x + pa.w, sy = pa.y + H / 2, ex = pb.x, ey = pb.y + H / 2;
            const mx = (sx + ex) / 2;
            d = "M" + sx + "," + sy + " C" + mx + "," + sy + " " + mx + "," + ey + " " + ex + "," + ey;
          } else {
            const sx = pa.x + pa.w / 2, sy = pa.y + H, ex = pb.x + pb.w / 2, ey = pb.y + H;
            d = "M" + sx + "," + sy + " C" + sx + "," + (sy + 36) + " " + ex + "," + (ey + 36) + " " + ex + "," + ey;
          }
          svg.appendChild(el("path", { d: d, fill: "none", stroke: INK, "stroke-width": "1", "marker-end": "url(#arrow)" }));
        });

        nodes.forEach((n) => {
          const p = pos[n];
          svg.appendChild(el("rect", { x: p.x, y: p.y, width: p.w, height: H, rx: 3, fill: "#ffffff", stroke: INK, "stroke-width": "1" }));
          svg.appendChild(el("text", {
            x: p.x + p.w / 2, y: p.y + H / 2 + 4, "text-anchor": "middle", fill: INK, "font-size": "12",
            "font-family": "ui-monospace, 'D2Coding', monospace"
          }, n));
        });

        svg.appendChild(el("text", {
          x: width - PAD, y: height - 14, "text-anchor": "end", fill: MUTED, "font-size": "9",
          "font-family": "ui-monospace, monospace"
        }, nodes.length + " nodes · " + edges.length + " edges"));

        return svg;
      }

      function render() {
        preview.textContent = "";
        currentSvg = buildSvg(titleInput.value.trim(), area.value);
        if (!currentSvg) {
          const msg = document.createElement("div");
          msg.style.cssText = "padding:12px;color:" + MUTED + ";";
          msg.textContent = "그릴 내용이 없습니다. 'A -> B' 형식으로 입력해 주세요.";
          preview.appendChild(msg);
          return;
        }
        preview.appendChild(currentSvg);
      }

      function serialize() {
        if (!currentSvg) return null;
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(currentSvg);
      }

      function updatePage() {
        const s = ctx.api.editor.getState();
        pageLabel.textContent = "현재 페이지: " + s.currentPage + " / " + s.numPages;
      }

      btnRender.addEventListener("click", render, opt);
      btnDownload.addEventListener("click", () => {
        const text = serialize();
        if (!text) { ctx.notify("먼저 다이어그램을 그려 주세요.", "warning"); return; }
        try {
          const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "diagram.svg";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          ctx.notify("SVG 다운로드를 시작했습니다.", "success");
        } catch (e) {
          ctx.notify("다운로드에 실패했습니다.", "error");
        }
      }, opt);
      btnCopy.addEventListener("click", async () => {
        const text = serialize();
        if (!text) { ctx.notify("먼저 다이어그램을 그려 주세요.", "warning"); return; }
        try {
          await navigator.clipboard.writeText(text);
          if (!ctx.signal.aborted) ctx.notify("SVG 코드를 복사했습니다.", "success");
        } catch (e) {
          if (!ctx.signal.aborted) ctx.notify("클립보드 복사에 실패했습니다.", "error");
        }
      }, opt);

      updatePage();
      render();
      ui = { render: render, updatePage: updatePage };

      return () => {
        ac.abort();
        ui = null;
        wrap.remove();
      };
    }
  }
});

var ui = null;