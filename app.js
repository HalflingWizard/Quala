
      const STORE_KEY = "quala-state-v1";

      const defaults = {
        docs: [],
        selectedDocId: null,
        codebook: [],
        annotations: [],
        history: [],
        preferences: {
          apiKey: "",
          model: "gpt-4.1",
          models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5"],
          verbosity: "medium",
          reasoning: "low",
          temperature: 0.2,
          maxQuotes: 12,
          lens:
            "The study is about epilepsy self management, technology for self management, social support, and HCI design opportunities. Prefer surprising, novel, specific, and useful codes. Avoid ordinary facts that someone could learn from a quick web search.",
          codebookPrompt:
            "Create or update a qualitative codebook from this datapoint. Focus on surprising, novel, and useful HCI insights. Include positive and negative examples. Do not invent quotes. Use exact transcript text for examples.",
          refinePrompt:
            "Revise the current codebook using the new datapoint. Keep useful existing codes, add new codes when needed, merge codes that are too similar, and remove codes that are weak, ordinary, rarely useful, or not interesting. Do not delete rare codes if they are important or surprising.",
          annotationPrompt:
            "For each code, inspect the entire datapoint and return exact verbatim quotes that match the code definition. If a code does not appear, return an empty list for that code. Include positive and negative cases. Do not paraphrase, shorten, merge, or add ellipses."
        }
      };

      const $ = (id) => document.getElementById(id);
      const clone = (obj) => JSON.parse(JSON.stringify(obj));
      const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

      let state = loadState();

      const els = {
        activityLog: $("activityLog"),
        addCodeBtn: $("addCodeBtn"),
        addTextBtn: $("addTextBtn"),
        annPill: $("annPill"),
        annotationList: $("annotationList"),
        annotationPrompt: $("annotationPrompt"),
        apiKey: $("apiKey"),
        clearDocsBtn: $("clearDocsBtn"),
        codebookPrompt: $("codebookPrompt"),
        codebookRows: $("codebookRows"),
        codeModal: $("codeModal"),
        codePill: $("codePill"),
        confirmAddTextBtn: $("confirmAddTextBtn"),
        copyAnnotationsBtn: $("copyAnnotationsBtn"),
        copyCodebookBtn: $("copyCodebookBtn"),
        currentTitle: $("currentTitle"),
        deleteDocBtn: $("deleteDocBtn"),
        docId: $("docId"),
        docList: $("docList"),
        docSource: $("docSource"),
        docText: $("docText"),
        editCodeDefinition: $("editCodeDefinition"),
        editCodeExample: $("editCodeExample"),
        editCodeId: $("editCodeId"),
        editCodeName: $("editCodeName"),
        exportBtn: $("exportBtn"),
        fileInput: $("fileInput"),
        histPill: $("histPill"),
        historyList: $("historyList"),
        importBtn: $("importBtn"),
        lens: $("lens"),
        loadModelsBtn: $("loadModelsBtn"),
        maxQuotes: $("maxQuotes"),
        modelPill: $("modelPill"),
        modelSelect: $("modelSelect"),
        newId: $("newId"),
        newSource: $("newSource"),
        newText: $("newText"),
        processCurrentBtn: $("processCurrentBtn"),
        processNextBtn: $("processNextBtn"),
        progressBar: $("progressBar"),
        progressMascot: $("progressMascot"),
        queuePill: $("queuePill"),
        reasoning: $("reasoning"),
        refinePrompt: $("refinePrompt"),
        saveBtn: $("saveBtn"),
        saveCodeBtn: $("saveCodeBtn"),
        snapshotBtn: $("snapshotBtn"),
        statCoded: $("statCoded"),
        statCodes: $("statCodes"),
        statDocs: $("statDocs"),
        statQuotes: $("statQuotes"),
        statusLine: $("statusLine"),
        temperature: $("temperature"),
        textModal: $("textModal"),
        updateDocBtn: $("updateDocBtn"),
        verbosity: $("verbosity")
      };

      function loadState() {
        try {
          const raw = localStorage.getItem(STORE_KEY);
          if (!raw) return clone(defaults);
          const parsed = JSON.parse(raw);
          return {
            ...clone(defaults),
            ...parsed,
            preferences: { ...clone(defaults.preferences), ...(parsed.preferences || {}) }
          };
        } catch {
          return clone(defaults);
        }
      }

      function saveState(message = "Saved.") {
        persistState();
        setStatus(message);
      }

      function persistState() {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      }

      function setStatus(message) {
        els.statusLine.textContent = message;
      }

      function log(message) {
        els.activityLog.textContent = message;
      }

      function setProgress(value) {
        const percent = Math.max(0, Math.min(100, value));
        els.progressBar.style.width = `${percent}%`;
        els.progressMascot.style.setProperty("--progress", `${percent}%`);
        els.progressMascot.classList.toggle("active", percent > 0 && percent < 100);
      }

      function selectedDoc() {
        return state.docs.find((doc) => doc.id === state.selectedDocId) || state.docs[0] || null;
      }

      function render() {
        renderPreferences();
        renderStats();
        renderDocs();
        renderCodebook();
        renderAnnotations();
        renderHistory();
        persistState();
      }

      function renderPreferences() {
        els.apiKey.value = state.preferences.apiKey || "";
        els.temperature.value = state.preferences.temperature;
        els.verbosity.value = state.preferences.verbosity;
        els.reasoning.value = state.preferences.reasoning;
        els.maxQuotes.value = state.preferences.maxQuotes;
        els.lens.value = state.preferences.lens;
        els.codebookPrompt.value = state.preferences.codebookPrompt;
        els.refinePrompt.value = state.preferences.refinePrompt;
        els.annotationPrompt.value = state.preferences.annotationPrompt;
        els.modelSelect.innerHTML = "";
        for (const model of state.preferences.models) {
          const option = document.createElement("option");
          option.value = model;
          option.textContent = model;
          option.selected = model === state.preferences.model;
          els.modelSelect.appendChild(option);
        }
        els.modelPill.textContent = state.preferences.model || "model";
      }

      function renderStats() {
        const coded = state.docs.filter((doc) => doc.status === "coded").length;
        const quoteCount = state.annotations.reduce((sum, doc) => sum + doc.quotes.length, 0);
        els.statDocs.textContent = state.docs.length;
        els.statCoded.textContent = coded;
        els.statCodes.textContent = state.codebook.length;
        els.statQuotes.textContent = quoteCount;
        els.queuePill.textContent = `${state.docs.length} docs`;
        els.codePill.textContent = `${state.codebook.length} codes`;
        els.annPill.textContent = `${quoteCount} quotes`;
        els.histPill.textContent = state.history.length;
      }

      function renderDocs() {
        const doc = selectedDoc();
        if (doc && !state.selectedDocId) state.selectedDocId = doc.id;
        els.docList.innerHTML = "";
        if (!state.docs.length) {
          els.docList.innerHTML = `<div class="item muted small">No datapoints yet.</div>`;
        }
        for (const item of state.docs) {
          const div = document.createElement("button");
          div.className = `item ${item.id === state.selectedDocId ? "active" : ""}`;
          div.type = "button";
          div.innerHTML = `
            <div class="itemTitle">
              <span>${escapeHtml(item.id)}</span>
              <span class="pill ${item.status === "coded" ? "ok" : "warn"}">${item.status || "queued"}</span>
            </div>
            <div class="muted small">${escapeHtml(item.source || "No source")}</div>
            <div class="muted tiny">${item.text.length.toLocaleString()} characters</div>
          `;
          div.addEventListener("click", () => {
            state.selectedDocId = item.id;
            renderDocs();
            saveState("Selected datapoint.");
          });
          els.docList.appendChild(div);
        }
        const current = selectedDoc();
        els.currentTitle.textContent = current ? `Selected datapoint ${current.id}` : "Selected datapoint";
        els.docId.value = current?.id || "";
        els.docSource.value = current?.source || "";
        els.docText.value = current?.text || "";
      }

      function renderCodebook() {
        els.codebookRows.innerHTML = "";
        const coverage = computeCoverage();
        if (!state.codebook.length) {
          els.codebookRows.innerHTML = `<tr><td colspan="5" class="muted">No codes yet.</td></tr>`;
          return;
        }
        for (const code of state.codebook) {
          const row = document.createElement("tr");
          const pct = coverage[code.code] || 0;
          row.innerHTML = `
            <td><strong>${escapeHtml(code.code)}</strong></td>
            <td>${escapeHtml(code.definition || "")}</td>
            <td><div class="quote small">${escapeHtml(code.example || "")}</div></td>
            <td><span class="pill">${pct}%</span></td>
            <td><button data-edit-code="${escapeHtml(code.id)}">Edit</button></td>
          `;
          els.codebookRows.appendChild(row);
        }
        els.codebookRows.querySelectorAll("[data-edit-code]").forEach((btn) => {
          btn.addEventListener("click", () => openCodeModal(btn.dataset.editCode));
        });
      }

      function renderAnnotations() {
        els.annotationList.innerHTML = "";
        if (!state.annotations.length) {
          els.annotationList.innerHTML = `<div class="item muted small">No annotations yet.</div>`;
          return;
        }
        for (const doc of state.annotations) {
          const div = document.createElement("div");
          div.className = "item";
          const quotes = doc.quotes
            .map(
              (q) => `
                <div class="item" style="margin-top: 8px">
                  <div class="row">
                    ${(q.annotations || []).map((a) => `<span class="pill">${escapeHtml(a)}</span>`).join("")}
                    <span class="pill ${q.polarity === "positive" ? "ok" : q.polarity === "negative" ? "bad" : ""}">${escapeHtml(q.polarity || "mixed")}</span>
                    <span class="pill">certainty ${Number(q.certainty || 0)}</span>
                  </div>
                  <div class="quote small" style="margin-top: 8px">${escapeHtml(q.quote)}</div>
                  <p class="muted small" style="margin-top: 8px">${escapeHtml(q.rationale || "")}</p>
                </div>`
            )
            .join("");
          div.innerHTML = `
            <div class="itemTitle">
              <span>${escapeHtml(doc.id)}</span>
              <span class="pill">${doc.quotes.length} quotes</span>
            </div>
            <div class="muted small">${escapeHtml(doc.source || "")}</div>
            ${quotes || `<p class="muted small" style="margin-top: 8px">No matching quotes.</p>`}
          `;
          els.annotationList.appendChild(div);
        }
      }

      function renderHistory() {
        els.historyList.innerHTML = "";
        if (!state.history.length) {
          els.historyList.innerHTML = `<div class="item muted small">No history snapshots yet.</div>`;
          return;
        }
        state.history
          .slice()
          .reverse()
          .forEach((entry, reverseIndex) => {
            const index = state.history.length - 1 - reverseIndex;
            const div = document.createElement("div");
            div.className = "item";
            div.innerHTML = `
              <div class="itemTitle">
                <span>${escapeHtml(entry.label)}</span>
                <span class="pill">${new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <div class="muted small">${entry.codebook.length} codes, ${entry.annotations.length} annotated datapoints</div>
              <div class="row" style="margin-top: 8px">
                <button data-restore="${index}" class="primary">Restore</button>
                <button data-preview="${index}">Preview JSON</button>
              </div>
            `;
            els.historyList.appendChild(div);
          });
        els.historyList.querySelectorAll("[data-restore]").forEach((btn) => {
          btn.addEventListener("click", () => restoreSnapshot(Number(btn.dataset.restore)));
        });
        els.historyList.querySelectorAll("[data-preview]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const entry = state.history[Number(btn.dataset.preview)];
            copyText(JSON.stringify(entry, null, 2));
          });
        });
      }

      function readPreferences() {
        state.preferences.apiKey = els.apiKey.value.trim();
        state.preferences.model = els.modelSelect.value || els.modelSelect.options[0]?.value || state.preferences.model;
        state.preferences.temperature = Number(els.temperature.value || 0.2);
        state.preferences.verbosity = els.verbosity.value;
        state.preferences.reasoning = els.reasoning.value;
        state.preferences.maxQuotes = Number(els.maxQuotes.value || 12);
        state.preferences.lens = els.lens.value.trim();
        state.preferences.codebookPrompt = els.codebookPrompt.value.trim();
        state.preferences.refinePrompt = els.refinePrompt.value.trim();
        state.preferences.annotationPrompt = els.annotationPrompt.value.trim();
      }

      function createSnapshot(label) {
        state.history.push({
          id: uid(),
          label,
          createdAt: new Date().toISOString(),
          docs: clone(state.docs),
          selectedDocId: state.selectedDocId,
          codebook: clone(state.codebook),
          annotations: clone(state.annotations)
        });
        if (state.history.length > 60) state.history.shift();
      }

      function restoreSnapshot(index) {
        const entry = state.history[index];
        if (!entry) return;
        state.docs = clone(entry.docs);
        state.selectedDocId = entry.selectedDocId;
        state.codebook = clone(entry.codebook);
        state.annotations = clone(entry.annotations);
        render();
        saveState("Snapshot restored.");
      }

      function computeCoverage() {
        const total = Math.max(1, state.docs.length);
        const codeToDocs = {};
        for (const docAnn of state.annotations) {
          const codes = new Set();
          for (const quote of docAnn.quotes) {
            for (const code of quote.annotations || []) codes.add(code);
          }
          for (const code of codes) codeToDocs[code] = (codeToDocs[code] || 0) + 1;
        }
        return Object.fromEntries(Object.entries(codeToDocs).map(([code, count]) => [code, Math.round((count / total) * 100)]));
      }

      function addDocuments(docs) {
        for (const doc of docs) {
          if (!doc.text.trim()) continue;
          state.docs.push({
            id: doc.id || `D${state.docs.length + 1}`,
            source: doc.source || "",
            text: doc.text,
            status: "queued"
          });
        }
        if (!state.selectedDocId && state.docs.length) state.selectedDocId = state.docs[0].id;
        createSnapshot("Documents added");
        render();
      }

      function findZipEntry(bytes, entryName) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let endOffset = -1;
        const searchStart = Math.max(0, bytes.length - 65557);
        for (let offset = bytes.length - 22; offset >= searchStart; offset--) {
          if (view.getUint32(offset, true) === 0x06054b50) {
            endOffset = offset;
            break;
          }
        }
        if (endOffset < 0) throw new Error("The DOCX file is not a valid ZIP archive.");

        const decoder = new TextDecoder();
        const entryCount = view.getUint16(endOffset + 10, true);
        let offset = view.getUint32(endOffset + 16, true);
        for (let index = 0; index < entryCount; index++) {
          if (view.getUint32(offset, true) !== 0x02014b50) break;
          const nameLength = view.getUint16(offset + 28, true);
          const extraLength = view.getUint16(offset + 30, true);
          const commentLength = view.getUint16(offset + 32, true);
          const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
          if (name === entryName) {
            return {
              compression: view.getUint16(offset + 10, true),
              compressedSize: view.getUint32(offset + 20, true),
              localOffset: view.getUint32(offset + 42, true)
            };
          }
          offset += 46 + nameLength + extraLength + commentLength;
        }
        throw new Error("The DOCX file does not contain a main document.");
      }

      async function readZipEntry(bytes, entryName) {
        const entry = findZipEntry(bytes, entryName);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (view.getUint32(entry.localOffset, true) !== 0x04034b50) {
          throw new Error("The DOCX document entry is invalid.");
        }
        const nameLength = view.getUint16(entry.localOffset + 26, true);
        const extraLength = view.getUint16(entry.localOffset + 28, true);
        const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
        const compressed = bytes.slice(dataOffset, dataOffset + entry.compressedSize);
        if (entry.compression === 0) return compressed;
        if (entry.compression !== 8 || typeof DecompressionStream === "undefined") {
          throw new Error("This browser cannot decompress this DOCX file.");
        }
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }

      async function readDocx(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const xmlBytes = await readZipEntry(bytes, "word/document.xml");
        const xml = new TextDecoder().decode(xmlBytes);
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        if (doc.querySelector("parsererror")) throw new Error("The DOCX document XML is invalid.");

        function nodeText(node) {
          if (node.nodeType === 3) return node.parentNode.localName === "t" ? node.nodeValue : "";
          if (node.localName === "tab") return "\t";
          if (node.localName === "br" || node.localName === "cr") return "\n";
          return Array.from(node.childNodes).map(nodeText).join("");
        }

        const paragraphs = Array.from(doc.getElementsByTagNameNS("*", "p"));
        return paragraphs.map(nodeText).join("\n");
      }

      async function handleFiles(files) {
        const docs = [];
        const errors = [];
        for (const file of files) {
          const name = file.name.toLowerCase();
          const isTxt = name.endsWith(".txt") || file.type === "text/plain";
          const isDocx =
            name.endsWith(".docx") ||
            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          if (!isTxt && !isDocx) {
            errors.push(`${file.name} is not a TXT or DOCX file.`);
            continue;
          }
          try {
            const text = isDocx ? await readDocx(file) : await file.text();
            if (!text.trim()) {
              errors.push(`${file.name} does not contain readable text.`);
              continue;
            }
            docs.push({ id: file.name, source: file.name, text });
          } catch (error) {
            errors.push(`${file.name} could not be opened. ${error.message}`);
          }
        }
        if (docs.length) addDocuments(docs);
        if (errors.length) setStatus(errors.join(" "));
        else if (docs.length) setStatus(`${docs.length} file${docs.length === 1 ? "" : "s"} added.`);
      }

      function codebookSchema() {
        return {
          name: "quala_codebook_step",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              codebook: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    code: { type: "string" },
                    definition: { type: "string" },
                    example: { type: "string" },
                    decision: { type: "string", enum: ["keep", "add", "modify", "delete"] },
                    decision_note: { type: "string" }
                  },
                  required: ["code", "definition", "example", "decision", "decision_note"]
                }
              },
              notes: { type: "string" }
            },
            required: ["codebook", "notes"]
          },
          strict: true
        };
      }

      function annotationSchema() {
        return {
          name: "quala_annotation_step",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    quote: { type: "string" },
                    certainty: { type: "integer", minimum: 1, maximum: 5 },
                    polarity: { type: "string", enum: ["positive", "negative", "mixed"] },
                    rationale: { type: "string" }
                  },
                  required: ["quote", "certainty", "polarity", "rationale"]
                }
              },
              notes: { type: "string" }
            },
            required: ["matches", "notes"]
          },
          strict: true
        };
      }

      function buildCodebookPrompt(doc) {
        const coverage = computeCoverage();
        const codebookForModel = state.codebook.map((code) => ({
          code: code.code,
          definition: code.definition,
          example: code.example,
          coverage_percent: coverage[code.code] || 0
        }));
        const phasePrompt = state.codebook.length ? state.preferences.refinePrompt : state.preferences.codebookPrompt;
        return [
          {
            role: "system",
            content:
              "You are a qualitative analysis agent. Return only JSON that matches the schema. You must only use exact quotes from the datapoint. Do not invent quotes. Do not paraphrase quotes. Prefer codes that are specific, useful, and surprising."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                task: "Update the codebook from this datapoint.",
                lens: state.preferences.lens,
                codebook_instruction: phasePrompt,
                current_codebook: codebookForModel,
                datapoint: {
                  id: doc.id,
                  source: doc.source,
                  text: doc.text
                },
                required_behavior: [
                  "Return a complete updated codebook after this datapoint.",
                  "Use code names that are 2 to 5 words long.",
                  "Definitions must be clear to someone who has not read the datapoint.",
                  "Delete weak codes by omitting them from the updated codebook.",
                  "Use exact transcript text for each code example.",
                  "A code can be rare if it is important, surprising, or useful."
                ]
              },
              null,
              2
            )
          }
        ];
      }

      function buildAnnotationPrompt(doc, code) {
        return [
          {
            role: "system",
            content:
              "You are a qualitative annotation agent. Return only JSON that matches the schema. You must only use exact quotes from the datapoint. Do not invent quotes. Do not paraphrase quotes. Return an empty matches array if the code does not appear."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                task: "Find all datapoint passages that match this one code.",
                lens: state.preferences.lens,
                annotation_instruction: state.preferences.annotationPrompt,
                max_quotes: state.preferences.maxQuotes,
                code: {
                  code: code.code,
                  definition: code.definition,
                  example: code.example
                },
                datapoint: {
                  id: doc.id,
                  source: doc.source,
                  text: doc.text
                },
                required_behavior: [
                  "Inspect the entire datapoint for this code.",
                  "Return exact verbatim quotes only.",
                  "If an interviewer question is needed, include the full question and answer in the quote.",
                  "Do not use partial quotes or ellipses.",
                  "Use certainty from 1 to 5.",
                  "Positive means useful, trustworthy, easy, wanted, or appropriate.",
                  "Negative means confusing, not useful, untrustworthy, unwanted, inappropriate, or better handled by another person, tool, or method."
                ]
              },
              null,
              2
            )
          }
        ];
      }

      function modelCapabilities(model) {
        const id = String(model || "").toLowerCase();
        const isGpt5 = id.startsWith("gpt-5");
        const isOSeries = /^o\d/.test(id) || id.startsWith("o-");
        const isKnownGpt = id.startsWith("gpt-3") || id.startsWith("gpt-4");
        return {
          temperature: isKnownGpt && !isOSeries,
          verbosity: isGpt5,
          reasoning: isGpt5 || isOSeries
        };
      }

      async function callOpenAI(input, schema) {
        readPreferences();
        if (!state.preferences.apiKey) throw new Error("Add an OpenAI API key in Preferences.");
        const capabilities = modelCapabilities(state.preferences.model);
        const body = {
          model: state.preferences.model,
          input,
          text: {
            format: { type: "json_schema", ...schema }
          }
        };
        if (capabilities.temperature) {
          body.temperature = state.preferences.temperature;
        }
        if (capabilities.verbosity) {
          body.text.verbosity = state.preferences.verbosity;
        }
        if (capabilities.reasoning && state.preferences.reasoning) {
          body.reasoning = { effort: state.preferences.reasoning };
        }
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.preferences.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI request failed ${response.status}. ${errText}`);
        }
        const data = await response.json();
        const text = data.output_text || extractResponseText(data);
        if (!text) throw new Error("The model returned no text.");
        return JSON.parse(text);
      }

      function extractResponseText(data) {
        const parts = [];
        for (const item of data.output || []) {
          for (const content of item.content || []) {
            if (content.type === "output_text" && content.text) parts.push(content.text);
          }
        }
        return parts.join("");
      }

      async function processDoc(doc) {
        if (!doc) return;
        setProgress(8);
        setStatus(`Processing ${doc.id}.`);
        log("Preparing codebook request.");
        createSnapshot(`Before processing ${doc.id}`);
        const codebookResult = await callOpenAI(buildCodebookPrompt(doc), codebookSchema());
        applyCodebookResult(codebookResult);
        setProgress(35);
        log("Codebook updated. Starting one annotation pass per code.");
        const quotes = [];
        for (let i = 0; i < state.codebook.length; i += 1) {
          const code = state.codebook[i];
          setProgress(35 + Math.round(((i + 1) / Math.max(1, state.codebook.length)) * 55));
          log(`Annotation agent ${i + 1} of ${state.codebook.length}. ${code.code}`);
          const result = await callOpenAI(buildAnnotationPrompt(doc, code), annotationSchema());
          quotes.push(...verifyAnnotationMatches(doc, code, result.matches || []));
        }
        applyAnnotationResult(doc, quotes);
        doc.status = "coded";
        createSnapshot(`After processing ${doc.id}`);
        setProgress(100);
        log(codebookResult.notes || `Processed ${doc.id}.`);
        render();
      }

      function applyCodebookResult(result) {
        const nextCodebook = [];
        const seen = new Set();
        for (const item of result.codebook || []) {
          if (item.decision === "delete") continue;
          const code = String(item.code || "").trim();
          if (!code || seen.has(code.toLowerCase())) continue;
          seen.add(code.toLowerCase());
          const existing = state.codebook.find((c) => c.code.toLowerCase() === code.toLowerCase());
          nextCodebook.push({
            id: existing?.id || uid(),
            code,
            definition: String(item.definition || "").trim(),
            example: String(item.example || "").trim(),
            decision: item.decision || "keep",
            decision_note: item.decision_note || ""
          });
        }
        state.codebook = nextCodebook;
      }

      function verifyAnnotationMatches(doc, code, matches) {
        const verified = [];
        const seen = new Set();
        for (const match of matches) {
          const text = String(match.quote || "");
          if (!text || !doc.text.includes(text) || seen.has(text)) continue;
          seen.add(text);
          verified.push({
            id: uid(),
            quote: text,
            annotations: [code.code],
            certainty: Number(match.certainty || 3),
            polarity: match.polarity || "mixed",
            rationale: match.rationale || ""
          });
        }
        return verified;
      }

      function applyAnnotationResult(doc, quotes) {
        const byQuote = new Map();
        for (const quote of quotes) {
          const existing = byQuote.get(quote.quote);
          if (!existing) {
            byQuote.set(quote.quote, quote);
            continue;
          }
          existing.annotations = Array.from(new Set([...existing.annotations, ...quote.annotations]));
          existing.certainty = Math.max(existing.certainty, quote.certainty);
          existing.rationale = [existing.rationale, quote.rationale].filter(Boolean).join(" ");
          if (existing.polarity !== quote.polarity) existing.polarity = "mixed";
        }
        const verifiedQuotes = Array.from(byQuote.values());
        const docOutput = {
          id: doc.id,
          source: doc.source,
          text: doc.text,
          annotation: Array.from(new Set(verifiedQuotes.flatMap((q) => q.annotations))),
          quotes: verifiedQuotes
        };
        state.annotations = state.annotations.filter((item) => item.id !== doc.id);
        state.annotations.push(docOutput);
      }

      async function loadModels() {
        readPreferences();
        if (!state.preferences.apiKey) {
          setStatus("Add an API key first.");
          return;
        }
        setStatus("Loading models.");
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${state.preferences.apiKey}` }
        });
        if (!response.ok) throw new Error(`Could not load models ${response.status}.`);
        const data = await response.json();
        const models = (data.data || [])
          .map((model) => model.id)
          .filter((id) => /gpt|o\d|chatgpt/i.test(id))
          .sort();
        state.preferences.models = models.length ? models : state.preferences.models;
        if (!state.preferences.models.includes(state.preferences.model)) state.preferences.model = state.preferences.models[0];
        render();
        setStatus("Models loaded.");
      }

      function exportPayload() {
        return {
          tool: "Quala",
          exported_at: new Date().toISOString(),
          codebook: state.codebook.map(({ id, ...rest }) => rest),
          data: state.annotations.map((doc) => ({
            id: doc.id,
            source: doc.source,
            text: doc.text,
            annotation: doc.annotation,
            quotes: doc.quotes
          }))
        };
      }

      function downloadJson(name, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }

      function copyText(text) {
        navigator.clipboard.writeText(text);
        setStatus("Copied to clipboard.");
      }

      function openCodeModal(id = "") {
        const code = state.codebook.find((item) => item.id === id);
        els.editCodeId.value = code?.id || "";
        els.editCodeName.value = code?.code || "";
        els.editCodeDefinition.value = code?.definition || "";
        els.editCodeExample.value = code?.example || "";
        els.codeModal.classList.add("open");
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      document.querySelectorAll(".navBtn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".navBtn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
          $(`${btn.dataset.view}View`).classList.remove("hidden");
        });
      });

      document.querySelectorAll("[data-close-modal]").forEach((btn) => {
        btn.addEventListener("click", () => btn.closest(".modalBackdrop").classList.remove("open"));
      });

      els.addTextBtn.addEventListener("click", () => {
        els.newId.value = `D${state.docs.length + 1}`;
        els.newSource.value = "";
        els.newText.value = "";
        els.textModal.classList.add("open");
      });

      els.confirmAddTextBtn.addEventListener("click", () => {
        addDocuments([{ id: els.newId.value.trim(), source: els.newSource.value.trim(), text: els.newText.value }]);
        els.textModal.classList.remove("open");
      });

      els.importBtn.addEventListener("click", () => els.fileInput.click());
      els.fileInput.addEventListener("change", async () => {
        await handleFiles(Array.from(els.fileInput.files || []));
        els.fileInput.value = "";
      });

      els.updateDocBtn.addEventListener("click", () => {
        const doc = selectedDoc();
        if (!doc) return;
        doc.id = els.docId.value.trim() || doc.id;
        doc.source = els.docSource.value.trim();
        doc.text = els.docText.value;
        state.selectedDocId = doc.id;
        createSnapshot(`Updated ${doc.id}`);
        render();
      });

      els.deleteDocBtn.addEventListener("click", () => {
        const doc = selectedDoc();
        if (!doc) return;
        state.docs = state.docs.filter((item) => item.id !== doc.id);
        state.annotations = state.annotations.filter((item) => item.id !== doc.id);
        state.selectedDocId = state.docs[0]?.id || null;
        createSnapshot(`Deleted ${doc.id}`);
        render();
      });

      els.clearDocsBtn.addEventListener("click", () => {
        createSnapshot("Before clearing datapoints");
        state.docs = [];
        state.annotations = [];
        state.selectedDocId = null;
        render();
      });

      els.processCurrentBtn.addEventListener("click", async () => {
        try {
          await processDoc(selectedDoc());
        } catch (err) {
          setProgress(0);
          setStatus("Processing failed.");
          log(err.message);
        }
      });

      els.processNextBtn.addEventListener("click", async () => {
        try {
          const next = state.docs.find((doc) => doc.status !== "coded") || selectedDoc();
          state.selectedDocId = next?.id || null;
          await processDoc(next);
        } catch (err) {
          setProgress(0);
          setStatus("Processing failed.");
          log(err.message);
        }
      });

      els.loadModelsBtn.addEventListener("click", async () => {
        try {
          await loadModels();
        } catch (err) {
          setStatus("Could not load models.");
          log(err.message);
        }
      });

      els.saveBtn.addEventListener("click", () => {
        readPreferences();
        saveState("Saved.");
        render();
      });

      els.exportBtn.addEventListener("click", () => downloadJson("quala_annotations.json", exportPayload()));
      els.copyAnnotationsBtn.addEventListener("click", () => copyText(JSON.stringify(exportPayload().data, null, 2)));
      els.copyCodebookBtn.addEventListener("click", () => copyText(JSON.stringify(state.codebook, null, 2)));

      els.addCodeBtn.addEventListener("click", () => openCodeModal());
      els.saveCodeBtn.addEventListener("click", () => {
        const id = els.editCodeId.value || uid();
        const next = {
          id,
          code: els.editCodeName.value.trim(),
          definition: els.editCodeDefinition.value.trim(),
          example: els.editCodeExample.value.trim(),
          decision: "manual",
          decision_note: "Edited by user"
        };
        if (!next.code) return;
        state.codebook = state.codebook.filter((code) => code.id !== id);
        state.codebook.push(next);
        createSnapshot(`Edited code ${next.code}`);
        els.codeModal.classList.remove("open");
        render();
      });

      els.snapshotBtn.addEventListener("click", () => {
        createSnapshot("Manual snapshot");
        render();
      });

      [els.apiKey, els.modelSelect, els.temperature, els.verbosity, els.reasoning, els.maxQuotes, els.lens, els.codebookPrompt, els.refinePrompt, els.annotationPrompt].forEach(
        (el) => el.addEventListener("change", () => {
          readPreferences();
          saveState("Preferences saved.");
        })
      );

      render();
    
