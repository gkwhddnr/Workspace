registerPlugin({
  id: "editorial-diagram",
  name: "Editorial Diagram",
  version: "1.5.0",
  description: "페이지 본문을 AI로 요약한 개념 SVG 다이어그램을 자동 생성하고 파일·페이지별로 보관합니다.",
  aiTools: [
    {
      name: "create_diagram",
      description: "읽은 페이지의 핵심 내용을 summary와 flow로 요약하여 페이지별 SVG 다이어그램으로 저장합니다. 페이지 원문은 AI가 read_page로 먼저 읽어야 합니다. PDF 삽입은 하지 않습니다.",
      parameters: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, description: "대상 페이지. 생략하면 현재 페이지" },
          glossary: { type: "array", maxItems: 8, description: "원문에 등장하는 생소한 용어·기법·법칙의 보충설명", items: { type: "object", properties: { term: { type: "string", maxLength: 80 }, explanation: { type: "string", maxLength: 800 } }, required: ["term", "explanation"], additionalProperties: false } },
          summary: { type: "string", description: "페이지의 핵심 내용 요약 (2,000자 이내)" },
          title: { type: "string", description: "다이어그램 제목" },
          flow: { type: "string", description: "한 줄에 하나씩 노드 흐름을 적은 텍스트. 예: 자료 수집 -> 분석 -> 결론" }
        },
        required: ["flow"],
        additionalProperties: false
      }
    },
    {
      name: "summarize_page",
      description: "지정 페이지의 실제 본문을 선택한 AI로 요약하고 다이어그램을 저장합니다. 저장된 결과는 재사용합니다.",
      parameters: { type: "object", properties: { page: { type: "integer", minimum: 1 } }, additionalProperties: false }
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
    async onAiTool(ctx, toolName, args) {
      if (toolName === "summarize_page") {
        const page = validatePage(ctx, args && args.page !== undefined ? args.page : ctx.api.editor.getState().currentPage);
        const diagram = await generatePageDiagram(ctx, page, ctx.signal);
        if (ui) ui.updatePage(page);
        return { created: true, saved: true, page, title: diagram.title, summary: diagram.summary };
      }
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
      savePageDiagram(ctx, page, { title, flow, summary: summary.trim(), glossary: validateGlossary(args.glossary === undefined ? loadPageDiagrams(ctx)[page]?.glossary : args.glossary) });
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
      wrap.className = "ed-workbench";
      const style = document.createElement("style");
      style.textContent = `
        .ed-workbench{--ed-accent:#4f46e5;box-sizing:border-box;container-type:inline-size;display:flex;flex-direction:column;gap:12px;padding:16px;min-width:0;color:#24324a;background:#f4f6fb;font:13px/1.55 system-ui,'Malgun Gothic',sans-serif;min-height:100%}
        .ed-workbench *{box-sizing:border-box;min-width:0}
        .ed-workbench .ed-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .ed-workbench h2{font-size:18px;letter-spacing:-.5px;margin:0;font-weight:750}
        .ed-workbench .ed-eyebrow{color:#6366a6;font-size:10px;font-weight:750;letter-spacing:1.5px}
        .ed-workbench .ed-card{background:#fff;border:1px solid #e0e5ef;border-radius:14px;padding:12px;box-shadow:0 2px 5px #22335504}
        .ed-workbench .ed-fields{display:grid;gap:10px;margin-top:12px}
        .ed-workbench label{display:grid;gap:5px;font-size:12px;font-weight:650;color:#526079}
        .ed-workbench input,.ed-workbench textarea,.ed-workbench select{width:100%;padding:9px 11px;border:1px solid #d8deea;border-radius:9px;background:#fff;color:#24324a;font:inherit}
        .ed-workbench textarea{resize:vertical;min-height:70px;font-weight:400}
        .ed-workbench button{border:1px solid #dce2ed;border-radius:9px;background:#fff;color:#34415b;padding:8px 11px;font:inherit;font-weight:600;cursor:pointer;white-space:nowrap;min-height:36px}
        .ed-workbench button:hover{background:#eef0ff;border-color:#a6a5e9}
        .ed-workbench :is(button,input,textarea,select,summary):focus-visible{outline:2px solid #6366f1;outline-offset:2px}
        .ed-workbench button.ed-primary{background:var(--ed-accent);border-color:var(--ed-accent);color:#fff}
        .ed-workbench button[aria-pressed=true]{background:#eef0ff;color:#4338ca;border-color:#b9b5f6}
        .ed-workbench button:disabled{opacity:.45;cursor:default}
        .ed-workbench .ed-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
        .ed-workbench .ed-muted{font-size:11px;color:#6b7890;overflow-wrap:anywhere}
        .ed-workbench .ed-status{border-left:3px solid #a5b4fc;background:#eef2ff;border-radius:6px;padding:9px 12px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
        .ed-workbench summary{cursor:pointer;font-weight:700;list-style-position:inside}
        .ed-workbench .ed-preview{height:clamp(280px,52vh,640px);overflow:auto;position:relative;border:1px solid #e0e5ef;border-radius:12px;background:#f6f3ec;touch-action:pan-x pan-y;cursor:grab;overscroll-behavior:contain}
        .ed-workbench .ed-preview:active{cursor:grabbing}
        .ed-workbench .ed-preview svg{display:block;max-width:none!important;margin:auto;flex:none}
        .ed-workbench .ed-toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-bottom:10px}
        .ed-workbench .ed-zoom{width:68px;text-align:center;padding:6px}
        .ed-workbench .ed-empty{display:grid;place-content:center;text-align:center;min-height:260px;padding:24px;color:#7a8497}
        .ed-workbench .ed-empty strong{display:block;font-size:16px;color:#43506a;margin-bottom:6px}
        @container (max-width:360px){.ed-workbench .ed-actions{gap:5px}.ed-workbench button{padding:7px 8px;font-size:12px}.ed-workbench .ed-heading{align-items:flex-start}.ed-workbench .ed-toolbar{flex-direction:column}}
      `;
      wrap.appendChild(style);

      const pageLabel = document.createElement("div");
      const pageSelect = document.createElement("select");
      pageSelect.setAttribute("aria-label", "다이어그램 페이지");
      const summaryArea = document.createElement("textarea");
      summaryArea.rows = 3;
      summaryArea.placeholder = "이 페이지의 핵심 요약 (AI 코파일럿이 페이지 원문을 읽고 작성)";
      summaryArea.maxLength = 2000;
      let displayedPage = ctx.api.editor.getState().currentPage;
      let autoEnabled = localStorage.getItem("editorialDiagram.auto.v1") !== "false";
      let autoTimer = null;
      let request = null;
      let allRequest = null;
      let allDocument = null;
      let zoom = 1;
      let fit = true;
      const status = document.createElement("div");
      status.setAttribute("role", "status");
      status.className = "ed-status";

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.value = "PDF 다이어그램 흐름";
      titleInput.placeholder = "제목";

      const area = document.createElement("textarea");
      area.rows = 4;
      area.placeholder = "핵심 개념 -> 설명 -> 결론\n한 줄에 하나의 연결을 작성하세요.";
      area.value = "";

      const hint = document.createElement("div");
      hint.textContent = "페이지 자동은 현재 PDF 본문을 선택한 AI로 요약합니다. 저장된 페이지는 재요청하지 않습니다. 전체 페이지 요약은 미작성 페이지를 순서대로 처리합니다. API 사용 비용이 발생할 수 있습니다.";

      const bar = document.createElement("div");
      function makeBtn(label) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        bar.appendChild(b);
        return b;
      }
      const btnRender = makeBtn("그리기");
      const btnAuto = makeBtn(autoEnabled ? "페이지 자동 ON" : "페이지 자동 OFF");
      const btnAi = makeBtn("현재 페이지 AI 요청");
      const btnRefresh = makeBtn("현재 페이지 요약 업데이트");
      btnRefresh.title = "저장된 요약을 새 AI 결과로 교체합니다. API 비용이 발생합니다.";
      const btnAll = makeBtn("전체 페이지 요약");
      const btnStop = makeBtn("요약 중단");
      const btnMinus = makeBtn("−");
      const zoomLabel = document.createElement("input");
      zoomLabel.type = "number"; zoomLabel.min = "10"; zoomLabel.max = "400";
      zoomLabel.className = "ed-zoom"; zoomLabel.setAttribute("aria-label", "다이어그램 확대 비율 (%)");
      bar.appendChild(zoomLabel);
      const btnPlus = makeBtn("+");
      const btnReset = makeBtn("100%");
      const btnFit = makeBtn("맞춤");
      const btnDownload = makeBtn("SVG 다운로드");
      const btnCopy = makeBtn("SVG 복사");

      const preview = document.createElement("div");

      const heading = document.createElement("div");
      heading.className = "ed-heading";
      const headingText = document.createElement("div");
      const eyebrow = document.createElement("div"); eyebrow.className = "ed-eyebrow"; eyebrow.textContent = "PAGE INSIGHTS";
      const headingTitle = document.createElement("h2"); headingTitle.textContent = "페이지를 한눈에";
      headingText.append(eyebrow, headingTitle); heading.append(headingText);
      pageLabel.className = "ed-muted";
      const sourceCard = document.createElement("section"); sourceCard.className = "ed-card";
      function field(label, input) { const node = document.createElement("label"); node.append(document.createTextNode(label), input); return node; }
      const actions = document.createElement("div"); actions.className = "ed-actions"; actions.style.marginTop = "10px";
      actions.append(btnAi, btnAuto, btnAll, btnStop, btnRefresh);
      btnAi.className = "ed-primary"; btnAuto.setAttribute("aria-pressed", String(autoEnabled));
      hint.className = "ed-muted"; hint.style.marginTop = "9px";
      sourceCard.append(field("페이지 선택", pageSelect), actions, hint);
      const editor = document.createElement("details"); editor.className = "ed-card";
      const editorTitle = document.createElement("summary"); editorTitle.textContent = "요약 · 연결 직접 편집";
      const fields = document.createElement("div"); fields.className = "ed-fields";
      fields.append(field("제목",titleInput), field("핵심 요약",summaryArea), field("개념 연결",area), btnRender);
      editor.append(editorTitle, fields);
      const viewer = document.createElement("section"); viewer.className = "ed-card";
      const toolbar = document.createElement("div"); toolbar.className = "ed-toolbar";
      const zoomTools = document.createElement("div"); zoomTools.className = "ed-actions";
      const exportTools = document.createElement("div"); exportTools.className = "ed-actions";
      btnMinus.setAttribute("aria-label","축소"); btnPlus.setAttribute("aria-label","확대");
      const percent = document.createElement("span"); percent.textContent = "%";
      zoomTools.append(btnMinus, zoomLabel, percent, btnPlus, btnReset, btnFit);
      exportTools.append(btnDownload,btnCopy); toolbar.append(zoomTools,exportTools);
      preview.className = "ed-preview"; preview.tabIndex = 0;
      preview.setAttribute("role","region"); preview.setAttribute("aria-label","다이어그램 미리보기. Ctrl 휠로 확대, 드래그로 이동");
      const navigationHint = document.createElement("div"); navigationHint.className = "ed-muted";
      navigationHint.textContent = "Ctrl + 휠 확대 · 드래그 이동 · 0 원본 크기 · F 화면 맞춤";
      const glossaryPanel = document.createElement("section");
      glossaryPanel.className = "ed-card";
      glossaryPanel.setAttribute("aria-label", "용어 · 보충설명");
      function renderGlossary(items) {
        glossaryPanel.replaceChildren();
        const heading = document.createElement("h3"); heading.textContent = "용어 · 보충설명";
        heading.style.cssText = "margin:0 0 8px;font-size:14px";
        const note = document.createElement("p"); note.className = "ed-muted";
        note.textContent = "용어를 클릭하면 뜻풀이가 펼쳐집니다. AI 보충설명은 원문 요약과 별도로 제공됩니다.";
        glossaryPanel.append(heading, note);
        const entries = validateGlossary(items);
        if (!entries.length) {
          note.textContent = "저장된 뜻풀이가 없습니다. 새 요약 또는 ‘현재 페이지 요약 업데이트’ 시 필요한 용어 설명을 함께 작성합니다.";
        }
        entries.forEach(item => {
          const details = document.createElement("details");
          details.style.cssText = "padding:10px 0;border-top:1px solid #e0e5ef";
          const label = document.createElement("summary"); label.textContent = item.term + "?";
          const explanation = document.createElement("p"); explanation.textContent = item.explanation;
          explanation.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;line-height:1.7";
          details.append(label, explanation); glossaryPanel.appendChild(details);
        });
      }
      viewer.append(toolbar,preview,navigationHint);
      wrap.append(heading,pageLabel,sourceCard,status,viewer,glossaryPanel,editor);
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

        // Lay out weakly connected components independently; unrelated branches
        // must never share a column's row ordering or connector lanes.
        const adjacent = new Map(nodes.map(n => [n, []]));
        edges.forEach(([a,b]) => { adjacent.get(a).push(b); adjacent.get(b).push(a); });
        const seen = new Set(), groups = [];
        nodes.forEach(root => {
          if (seen.has(root)) return;
          const group = [], queue = [root]; seen.add(root);
          for (let i=0; i<queue.length; i++) {
            const n=queue[i]; group.push(n);
            adjacent.get(n).forEach(next => { if (!seen.has(next)) { seen.add(next); queue.push(next); } });
          }
          groups.push(group);
        });
        const layer = Object.create(null);
        const lines = Object.create(null);
        nodes.forEach(n => {
          const result = []; let line = "";
          for (const ch of n) {
            if (line && textWidth(line + ch) > 210) { result.push(line); line = ""; }
            line += ch;
          }
          if (line) result.push(line);
          lines[n] = result;
        });
        const H = Math.max(56, ...nodes.map(n => lines[n].length * 19 + 24));
        const GAP_X = 80, ROW = H + 32, PAD = 32, TOP = 76;
        const pos = Object.create(null), routes = new Map(), sections = [];
        let width = 0, bottom = TOP;
        groups.forEach((group, groupIndex) => {
          const members = new Set(group);
          const links = edges.filter(([a,b]) => members.has(a) && members.has(b));
          // Back edges are routed outside the nodes, not allowed to inflate ranks.
          const visiting = new Set(), done = new Set(), back = new Set();
          function visit(n) {
            visiting.add(n);
            links.filter(e => e[0] === n).forEach(e => {
              if (visiting.has(e[1])) back.add(e);
              else if (!done.has(e[1])) visit(e[1]);
            });
            visiting.delete(n); done.add(n);
          }
          group.forEach(n => { if (!done.has(n)) visit(n); layer[n]=0; });
          for (let i=0; i<group.length; i++) links.forEach(e => {
            if (!back.has(e)) layer[e[1]]=Math.max(layer[e[1]],layer[e[0]]+1);
          });
          const cols = [];
          group.forEach(n => (cols[layer[n]] ||= []).push(n));
          // Alternate barycentric sweeps to place children near their parents.
          for (let pass=0; pass<6; pass++) {
            const forward = pass%2===0;
            const order = cols.map((_,i)=>i); if (!forward) order.reverse();
            order.forEach(rank => {
              const score = n => {
                const neighbors=links.filter(e=>!back.has(e) && (forward ? e[1]===n && layer[e[0]]<rank : e[0]===n && layer[e[1]]>rank))
                  .map(e=>{const other=forward?e[0]:e[1];return cols[layer[other]].indexOf(other);});
                return neighbors.length ? neighbors.reduce((a,b)=>a+b,0)/neighbors.length : cols[rank].indexOf(n);
              };
              const scores=new Map(cols[rank].map(n=>[n,score(n)]));
              cols[rank].sort((a,b)=>scores.get(a)-scores.get(b));
            });
          }
          const external=links.filter(e=>layer[e[1]]!==layer[e[0]]+1);
          const laneSpace=external.length*16+20;
          const top=bottom+laneSpace;
          const maxCount=Math.max(...cols.map(c=>c.length));
          let x=PAD+16;
          cols.forEach(col=>{
            const w=Math.min(250,Math.max(160,...col.map(n=>textWidth(n)+32)));
            col.forEach((n,i)=>{pos[n]={x,y:top+(maxCount-col.length)*ROW/2+i*ROW,w,group:groupIndex};});
            x+=w+GAP_X;
          });
          external.forEach((e,i)=>routes.set(e,bottom+12+i*16));
          const sectionBottom=top+maxCount*ROW;
          sections.push({top:bottom-6,bottom:sectionBottom});
          width=Math.max(width,x-GAP_X+PAD+16);
          bottom=sectionBottom+42;
        });
        const height=bottom+20;

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

        sections.forEach((section,index)=>{
          if (groups.length>1) svg.appendChild(el("rect", {x:PAD-8,y:section.top,width:width-2*PAD+16,height:section.bottom-section.top,rx:14,fill:index%2?"#eef1f5":"#fffaf1",stroke:"#dedbd4","data-diagram-group":index}));
        });
        edges.forEach((edge) => {
          const [a,b]=edge, pa=pos[a], pb=pos[b];
          const outgoing=edges.filter(e=>e[0]===a).sort((e,f)=>pos[e[1]].y-pos[f[1]].y);
          const incoming=edges.filter(e=>e[1]===b).sort((e,f)=>pos[e[0]].y-pos[f[0]].y);
          const sy=pa.y+H*(outgoing.indexOf(edge)+1)/(outgoing.length+1);
          const ey=pb.y+H*(incoming.indexOf(edge)+1)/(incoming.length+1);
          const sx=pa.x+pa.w, ex=pb.x;
          let d;
          if (routes.has(edge)) {
            const lane=routes.get(edge);
            d="M"+sx+","+sy+" H"+(sx+16)+" V"+lane+" H"+(ex-16)+" V"+ey+" H"+ex;
          } else {
            const mx=(sx+ex)/2;
            d="M"+sx+","+sy+" C"+mx+","+sy+" "+mx+","+ey+" "+ex+","+ey;
          }
          svg.appendChild(el("path", {d,fill:"none",stroke:INK,"stroke-width":"1.2","stroke-linejoin":"round","marker-end":"url(#arrow)","data-edge-from":a,"data-edge-to":b}));
        });

        nodes.forEach((n) => {
          const p = pos[n];
          svg.appendChild(el("rect", { x: p.x, y: p.y, width: p.w, height: H, "data-node": n, "data-group": p.group, rx: 10, fill: "#ffffff", stroke: INK, "stroke-width": "1" }));
          const label = el("text", {
            x:p.x+p.w/2, "text-anchor":"middle", fill:INK, "font-size":"13",
            "font-family":"system-ui, Malgun Gothic, sans-serif", "font-weight":"500"
          });
          lines[n].forEach((line, index) => label.appendChild(el("tspan", {
            x:p.x+p.w/2, y:p.y+(H-lines[n].length*19)/2+15+index*19
          }, line)));
          svg.appendChild(label);
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
          msg.className = "ed-empty";
          const emptyTitle = document.createElement("strong"); emptyTitle.textContent = "아직 다이어그램이 없어요";
          msg.append(emptyTitle, document.createTextNode("현재 페이지 AI 요청을 누르거나 아래에서 개념 연결을 직접 작성하세요."));
          preview.appendChild(msg);
          applyZoom();
          return;
        }
        preview.appendChild(currentSvg);
        applyZoom();
      }

      function serialize() {
        if (!currentSvg) return null;
        const exportSvg = currentSvg.cloneNode(true);
        exportSvg.style.removeProperty("width");
        exportSvg.style.removeProperty("height");
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(exportSvg);
      }

      function updatePage(targetPage) {
        clearTimeout(autoTimer);
        if (request) { request.abort(); request = null; }
        if (allRequest && allDocument !== ctx.api.app.getState().pdfOriginalData) allRequest.abort();
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
        btnRefresh.disabled = !diagram || !!request || !!allRequest;
        titleInput.value = diagram ? diagram.title : displayedPage + "페이지 요약";
        summaryArea.value = diagram ? diagram.summary || "" : "";
        renderGlossary(diagram?.glossary);
        area.value = diagram ? diagram.flow : "";
        render();
        status.textContent = diagram ? "이 페이지의 본문 요약을 불러왔습니다." : "이 페이지는 아직 요약되지 않았습니다.";
        if (!diagram && autoEnabled && s.numPages && ctx.api.app.getState().pdfOriginalData && !allRequest) {
          const page = displayedPage;
          autoTimer = setTimeout(() => requestPage(page), 350);
        }
      }

      function applyZoom() {
        if (currentSvg) {
          const box = currentSvg.viewBox.baseVal;
          if (fit) zoom = Math.min(1, Math.max(.01, Math.min((preview.clientWidth - 24) / box.width, (preview.clientHeight - 24) / box.height)));
          currentSvg.style.width = box.width * zoom + "px";
          currentSvg.style.height = box.height * zoom + "px";
        }
        zoomLabel.value = String(Math.round(zoom * 100));
        btnFit.setAttribute("aria-pressed", String(fit));
        btnDownload.disabled = btnCopy.disabled = !currentSvg;
      }
      function setZoom(value, x = preview.clientWidth / 2, y = preview.clientHeight / 2) {
        const old = zoom;
        const left = currentSvg ? (currentSvg.getBoundingClientRect().left - preview.getBoundingClientRect().left + preview.scrollLeft) : 0;
        const pointX = (preview.scrollLeft + x - left) / old;
        const pointY = (preview.scrollTop + y) / old;
        fit = false; zoom = Math.max(.1, Math.min(4, value)); applyZoom();
        preview.scrollLeft = pointX * zoom + (currentSvg ? (currentSvg.getBoundingClientRect().left - preview.getBoundingClientRect().left + preview.scrollLeft) : 0) - x;
        preview.scrollTop = pointY * zoom - y;
      }
      const resizeObserver = new ResizeObserver(() => { if (fit) applyZoom(); });
      resizeObserver.observe(preview);
      preview.addEventListener("wheel", (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault(); event.stopPropagation();
        const rect = preview.getBoundingClientRect();
        setZoom(zoom * Math.exp(-event.deltaY / 500), event.clientX - rect.left, event.clientY - rect.top);
      }, { signal: ac.signal, passive: false });
      preview.addEventListener("keydown", (event) => {
        if (!["+", "=", "-", "0", "f", "F"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key.toLowerCase() === "f") { fit = true; applyZoom(); }
        else setZoom(event.key === "0" ? 1 : zoom * (event.key === "-" ? 1 / 1.2 : 1.2));
      }, opt);
      let drag = null;
      preview.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.pointerType === "touch") return;
        drag = { x:event.clientX, y:event.clientY, left:preview.scrollLeft, top:preview.scrollTop };
        preview.setPointerCapture(event.pointerId); event.preventDefault();
      }, opt);
      preview.addEventListener("pointermove", (event) => {
        if (!drag) return;
        preview.scrollLeft = drag.left - event.clientX + drag.x;
        preview.scrollTop = drag.top - event.clientY + drag.y;
      }, opt);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) preview.addEventListener(type, () => { drag = null; }, opt);
      zoomLabel.addEventListener("change", () => { const value = Number(zoomLabel.value); if (Number.isFinite(value) && value > 0) setZoom(value / 100); else applyZoom(); }, opt);

      async function requestPage(page, refresh = false) {
        if (allRequest || ac.signal.aborted) return;
        if (request) request.abort();
        const controller = new AbortController();
        request = controller;
        btnRefresh.disabled = true;
        status.textContent = page + "페이지 본문을 읽고 요약하는 중…";
        try {
          await generatePageDiagram(ctx, page, controller.signal, refresh);
          if (controller.signal.aborted || ac.signal.aborted) return;
          request = null;
          updatePage(page);
        } catch (error) {
          if (!controller.signal.aborted && !ac.signal.aborted) status.textContent = "요약 실패: " + error.message;
        } finally {
          if (request === controller) request = null;
          btnRefresh.disabled = !!request || !!allRequest || !loadPageDiagrams(ctx)[displayedPage];
        }
      }

      async function requestAll() {
        if (allRequest) return;
        clearTimeout(autoTimer);
        if (request) { request.abort(); request = null; }
        const controller = new AbortController();
        allRequest = controller;
        allDocument = ctx.api.app.getState().pdfOriginalData;
        let completed = 0;
        let reused = 0;
        btnRefresh.disabled = true;
        const skipped = [];
        const total = ctx.api.editor.getState().numPages;
        try {
          const fileKey = documentStorageKey(ctx);
          for (let page = 1; page <= total; page++) {
            if (controller.signal.aborted || ac.signal.aborted) break;
            if (documentStorageKey(ctx) !== fileKey) throw new Error("문서가 변경되어 전체 요약을 중단했습니다.");
            if (loadPageDiagrams(ctx)[page]) { reused++; continue; }
            status.textContent = "전체 요약: " + page + " / " + total + "페이지";
            try {
              await generatePageDiagram(ctx, page, controller.signal);
              completed++;
            } catch (error) {
              if (!controller.signal.aborted && /텍스트를 추출하지 못했습니다|32,000자를 초과/.test(error.message)) skipped.push(page + "페이지: " + error.message);
              else throw error;
            }
          }
          if (!ac.signal.aborted) {
            updatePage();
            status.textContent = controller.signal.aborted ? "요약 중단 · " + completed + "페이지 결과 저장됨" : skipped.length ? "전체 요약: 저장 " + completed + " / " + total + "페이지 · 미작성\n" + skipped.join("\n") : "전체 " + completed + "페이지 요약 완료";
          }
        } catch (error) {
          if (!ac.signal.aborted) status.textContent = controller.signal.aborted ? "요약 중단 · " + completed + "페이지 결과 저장됨" : "전체 요약 중단: " + error.message + " · " + completed + "페이지 결과 저장됨";
        } finally {
          allRequest = null;
          btnRefresh.disabled = !loadPageDiagrams(ctx)[displayedPage];
          if (!ac.signal.aborted) status.textContent += " · 기존 " + reused + "페이지 유지";
        }
      }

      btnAuto.addEventListener("click", () => {
        autoEnabled = !autoEnabled;
        localStorage.setItem("editorialDiagram.auto.v1", String(autoEnabled));
        btnAuto.setAttribute("aria-pressed", String(autoEnabled));
        btnAuto.textContent = autoEnabled ? "페이지 자동 ON" : "페이지 자동 OFF";
        updatePage(displayedPage);
      }, opt);
      btnAi.addEventListener("click", () => { clearTimeout(autoTimer); requestPage(displayedPage); }, opt);
      btnRefresh.addEventListener("click", () => {
        clearTimeout(autoTimer);
        if (!request && !allRequest) requestPage(displayedPage, true);
      }, opt);
      btnAll.addEventListener("click", requestAll, opt);
      btnStop.addEventListener("click", () => {
        clearTimeout(autoTimer);
        if (request) { request.abort(); request = null; }
        if (allRequest) allRequest.abort();
        status.textContent = "요약 요청을 중단했습니다. 저장된 결과는 유지됩니다.";
      }, opt);
      btnMinus.addEventListener("click", () => { setZoom(zoom / 1.2); }, opt);
      btnPlus.addEventListener("click", () => { setZoom(zoom * 1.2); }, opt);
      btnReset.addEventListener("click", () => { setZoom(1); }, opt);
      btnFit.addEventListener("click", () => { fit = true; applyZoom(); }, opt);

      pageSelect.addEventListener("change", () => updatePage(Number(pageSelect.value)), opt);
      btnRender.addEventListener("click", () => {
        try {
          validatePage(ctx, displayedPage);
          if (!area.value.trim()) throw new Error("페이지의 요약 흐름을 입력해 주세요.");
          if (titleInput.value.length > 120 || area.value.length > 12000) throw new Error("제목은 120자, 흐름은 12,000자 이내여야 합니다.");
          savePageDiagram(ctx, displayedPage, { title: titleInput.value.trim(), flow: area.value.trim(), summary: summaryArea.value.trim(), glossary: loadPageDiagrams(ctx)[displayedPage]?.glossary || [] });
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
        resizeObserver.disconnect();
        ac.abort();
        clearTimeout(autoTimer);
        if (request) request.abort();
        if (allRequest) allRequest.abort();
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
async function generatePageDiagram(ctx, page, signal, refresh = false) {
  validatePage(ctx, page);
  const key = documentStorageKey(ctx);
  const existing = loadPageDiagrams(ctx)[page];
  if (existing && !refresh) return existing;
  if (!ctx.api.document || typeof ctx.api.document.summarizePage !== "function") throw new Error("PDF Editor를 최신 버전으로 다시 실행해 주세요. 본문 요약 API가 필요합니다.");
  const diagram = await ctx.api.document.summarizePage(page, signal, { refresh });
  signal.throwIfAborted();
  ctx.signal.throwIfAborted();
  if (documentStorageKey(ctx) !== key) throw new Error("요약 중 문서가 변경되었습니다.");
  const current = loadPageDiagrams(ctx)[page];
  if (current && !refresh) return current;
  savePageDiagram(ctx, page, { title: diagram.title, summary: diagram.summary, flow: diagram.flow, glossary: validateGlossary(diagram.glossary) });
  return diagram;
}

function validateGlossary(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8 || value.some(item => !item || typeof item.term !== "string" || !item.term.trim() || item.term.length > 80 || typeof item.explanation !== "string" || !item.explanation.trim() || item.explanation.length > 800)) throw new Error("보충설명은 최대 8개, 용어 80자, 설명 800자 이내로 작성하세요.");
  return value.map(item => ({term:item.term.trim(), explanation:item.explanation.trim()}));
}
