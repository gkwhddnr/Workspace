registerPlugin({
  id: "editorial-diagram",
  name: "Editorial Diagram",
  version: "1.2.0",
  description: "파일의 각 페이지를 요약한 SVG 다이어그램을 보관하고 페이지 이동 시 표시합니다.",
  aiTools: [
    {
      name: "create_diagram",
      description: "읽은 페이지의 핵심 내용을 summary와 flow로 요약하여 페이지별 SVG 다이어그램으로 저장합니다. 페이지 원문은 AI가 read_page로 먼저 읽어야 합니다. PDF 삽입은 하지 않습니다.",
      parameters: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, description: "대상 페이지. 생략하면 현재 페이지" },
          summary: { type: "string", description: "페이지의 핵심 내용 요약 (2,000자 이내)" },
          title: { type: "string", description: "다이어그램 제목" },
          flow: { type: "string", description: "한 줄에 하나씩 노드 흐름을 적은 텍스트. 예: 자료 수집 -> 분석 -> 결론" }
        },
        required: ["flow"],
        additionalProperties: false
      }
    },
    {
      name: "get_page_diagrams",
      description: "현재 파일의 저장된 다이어그램 페이지 목록 또는 지정한 페이지의 요약과 흐름을 조회합니다.",
      parameters: { type: "object", properties: { page: { type: "integer", minimum: 1 } }, additionalProperties: false }
    }
  ],
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
    onAiTool(ctx, toolName, args) {
      if (toolName === "get_page_diagrams") {
        const record = loadPageDiagrams(ctx);
        if (args && args.page !== undefined) {
          const page = validatePage(ctx, args.page);
          return { page, diagram: record[page] || null };
        }
        return { pages: Object.keys(record).map(Number).sort((a, b) => a - b), numPages: ctx.api.editor.getState().numPages };
      }
      if (toolName !== "create_diagram") throw new Error("지원하지 않는 AI 기능입니다.");
      if (!args || typeof args.flow !== "string") throw new Error("flow 문자열이 필요합니다.");
      const flow = args.flow.trim();
      const title = typeof args.title === "string" ? args.title.trim() : "PDF 다이어그램 흐름";
      if (!flow) throw new Error("다이어그램 흐름이 비어 있습니다.");
      if (flow.length > 12000) throw new Error("흐름 텍스트는 12,000자 이내여야 합니다.");
      if (title.length > 120) throw new Error("제목은 120자 이내여야 합니다.");
      const nodes = new Set();
      flow.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && trimmed[0] !== "#") trimmed.split("->").map((part) => part.trim()).filter(Boolean).forEach((node) => nodes.add(node));
      });
      if (!nodes.size) throw new Error("'A -> B -> C' 형식의 흐름을 입력해 주세요.");
      if (nodes.size > 40) throw new Error("다이어그램은 최대 40개 노드까지 지원합니다.");
      const page = validatePage(ctx, args.page === undefined ? ctx.api.editor.getState().currentPage : args.page);
      const summary = args.summary === undefined ? "" : args.summary;
      if (typeof summary !== "string" || summary.length > 2000) throw new Error("summary는 2,000자 이내 문자열이어야 합니다.");
      savePageDiagram(ctx, page, { title, flow, summary: summary.trim() });
      if (ui) ui.updatePage(page);
      ctx.notify(page + "페이지 요약 다이어그램을 저장했습니다.", "success");
      return { created: true, saved: true, page, title, nodeCount: nodes.size, note: "페이지별 SVG 미리보기이며 PDF 페이지에는 삽입되지 않았습니다." };
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
      const pageSelect = document.createElement("select");
      pageSelect.setAttribute("aria-label", "다이어그램 페이지");
      pageSelect.style.cssText = "padding:6px;border:1px solid #999;border-radius:4px;max-width:100%;";
      const summaryArea = document.createElement("textarea");
      summaryArea.rows = 3;
      summaryArea.placeholder = "이 페이지의 핵심 요약 (AI 코파일럿이 페이지 원문을 읽고 작성)";
      summaryArea.maxLength = 2000;
      summaryArea.style.cssText = "padding:6px;border:1px solid #999;border-radius:4px;";
      let displayedPage = ctx.api.editor.getState().currentPage;

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.value = "PDF 다이어그램 흐름";
      titleInput.placeholder = "제목";
      titleInput.style.cssText = "padding:6px;border:1px solid #999;border-radius:4px;";

      const area = document.createElement("textarea");
      area.rows = 6;
      area.value = "";
      area.style.cssText = "padding:6px;border:1px solid #999;border-radius:4px;font-family:ui-monospace,monospace;";

      const hint = document.createElement("div");
      hint.style.cssText = "font-size:11px;opacity:.6;";
      hint.textContent = "AI 코파일럿에 ‘각 페이지를 읽고 Editorial Diagram에 요약 다이어그램으로 작성해 줘’라고 요청하세요. 직접 편집할 때는 'A -> B -> C' 형식으로 입력합니다.";

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

      wrap.append(pageLabel, pageSelect, titleInput, summaryArea, area, hint, bar, preview);
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

        const layer = Object.create(null);
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

        const pos = Object.create(null);
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

      function updatePage(targetPage) {
        const s = ctx.api.editor.getState();
        displayedPage = typeof targetPage === "number" ? targetPage : s.currentPage;
        const record = loadPageDiagrams(ctx);
        pageLabel.textContent = "현재 파일: " + (ctx.api.app.getState().currentFileName || "없음") + " · 요약 페이지: " + displayedPage + " / " + s.numPages;
        pageSelect.textContent = "";
        for (let page = 1; page <= s.numPages; page++) {
          const option = document.createElement("option");
          option.value = String(page);
          option.textContent = page + "페이지" + (record[page] ? " · 요약 있음" : " · 미작성");
          pageSelect.appendChild(option);
        }
        pageSelect.value = String(displayedPage);
        const diagram = record[displayedPage];
        titleInput.value = diagram ? diagram.title : displayedPage + "페이지 요약";
        summaryArea.value = diagram ? diagram.summary || "" : "";
        area.value = diagram ? diagram.flow : "";
        render();
      }

      pageSelect.addEventListener("change", () => updatePage(Number(pageSelect.value)), opt);
      btnRender.addEventListener("click", () => {
        try {
          validatePage(ctx, displayedPage);
          if (!area.value.trim()) throw new Error("페이지의 요약 흐름을 입력해 주세요.");
          if (titleInput.value.length > 120 || area.value.length > 12000) throw new Error("제목은 120자, 흐름은 12,000자 이내여야 합니다.");
          savePageDiagram(ctx, displayedPage, { title: titleInput.value.trim(), flow: area.value.trim(), summary: summaryArea.value.trim() });
          updatePage(displayedPage);
        } catch (error) { ctx.notify(error.message, "error"); }
      }, opt);
      btnDownload.addEventListener("click", () => {
        const text = serialize();
        if (!text) { ctx.notify("먼저 다이어그램을 그려 주세요.", "warning"); return; }
        try {
          const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "diagram-page-" + displayedPage + ".svg";
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
      ui = {
        render: render,
        updatePage: updatePage,
        setDiagram(title, source) {
          titleInput.value = title;
          area.value = source;
          render();
        }
      };

      return () => {
        ac.abort();
        ui = null;
        wrap.remove();
      };
    }
  }
});

var ui = null;
var cachedDocumentBytes = null;
var cachedDocumentHash = "";
function documentStorageKey(ctx) {
  const app = ctx.api.app.getState();
  const bytes = app.pdfOriginalData;
  if (!bytes || !bytes.length || !ctx.api.editor.getState().numPages) throw new Error("문서를 먼저 열어 주세요.");
  if (cachedDocumentBytes !== bytes) {
    let hash = 2166136261;
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
    cachedDocumentBytes = bytes;
    cachedDocumentHash = (hash >>> 0).toString(16) + "-" + bytes.length;
  }
  return "editorialDiagram.pages.v1:" + encodeURIComponent(app.currentFilePath || app.currentFileName || "document") + ":" + cachedDocumentHash;
}
function validatePage(ctx, page) {
  if (!Number.isInteger(page) || page < 1 || page > ctx.api.editor.getState().numPages) throw new Error("현재 문서에 존재하는 페이지 번호가 필요합니다.");
  return page;
}
function loadPageDiagrams(ctx) {
  if (!ctx.api.app.getState().pdfOriginalData || !ctx.api.editor.getState().numPages) return {};
  const key = documentStorageKey(ctx);
  const stored = JSON.parse(localStorage.getItem(key) || "{}");
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return Object.fromEntries(Object.entries(stored).filter(([page, item]) => /^\d+$/.test(page) && item && typeof item.title === "string" && typeof item.flow === "string"));
}
function savePageDiagram(ctx, page, diagram) {
  const record = loadPageDiagrams(ctx);
  record[page] = diagram;
  localStorage.setItem(documentStorageKey(ctx), JSON.stringify(record));
}
