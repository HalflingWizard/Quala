
      const STORE_KEY = "quala-state-v1";

      const defaults = {
        docs: [],
        selectedDocId: null,
        codebook: [],
        annotations: [],
        history: [],
        reviewItems: [],
        auditLog: [],
        preferences: {
          apiKey: "",
          model: "gpt-4.1",
          models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5"],
          verbosity: "medium",
          reasoning: "low",
          temperature: 0.2,
          maxQuotes: 12,
          lens:
            "This is a general qualitative study. Identify recurring themes, important differences between participants or documents, unexpected concerns, helpful or harmful experiences, needs, barriers, motivations, decisions, and concrete examples that answer the research question.",
          codebookPrompt:
            "Find possible new concepts in this document without using the current codebook. Focus on ideas that help answer the study question. Every supporting quote must be copied exactly from the document as one contiguous substring. Do not change spelling, punctuation, capitalization, spacing, or wording. Do not paraphrase. Do not add ellipses. Before returning a quote, check that document_text.includes(quote) would be true.",
          refinePrompt:
            "Compare scout findings with the current codebook. Mark each finding as new_code, already_covered, possible_merge, or needs_human_review. Do not create active codes directly. Use only evidence quotes that were already copied exactly from the document.",
          mergePrompt:
            "Review whether candidate codes should stay separate or merge with existing codes. Argue both sides. Recommend merging only when the meaning, use case, and evidence type are the same and the merged definition would be clearer.",
          annotationPrompt:
            "Apply only the existing active codebook. Do not create codes. Return exact verbatim quotes only. Each quote must be copied exactly from the document as one contiguous substring. Do not change spelling, punctuation, capitalization, spacing, or wording. Do not paraphrase. Do not add ellipses. Before returning a quote, check that document_text.includes(quote) would be true. If a code does not appear, list it as having no instance."
        }
      };

      const CODE_STATUSES = ["candidate", "active", "merged", "dormant", "rejected", "needs_human_review"];
      const LEGACY_DEFAULT_PROMPTS = {
        lens: [
          "The study is about epilepsy self management, technology for self management, social support, and HCI design opportunities. Prefer surprising, novel, specific, and useful codes. Avoid ordinary facts that someone could learn from a quick web search.",
          "Describe the qualitative study goal here. Include the research question, population, setting, and the kinds of patterns that would be useful to find."
        ],
        codebookPrompt: [
          "Find possible new concepts in this document without using the current codebook. Focus on specific, useful, and surprising ideas. Use exact document text for every quote.",
          "Find possible new concepts in this document without using the current codebook. Focus on ideas that help answer the study question. Every supporting quote must be copied exactly from the document as one contiguous substring. Do not change spelling, punctuation, capitalization, spacing, or wording. Do not paraphrase. Do not add ellipses. Before returning a quote, check that document_text.includes(quote) would be true."
        ],
        refinePrompt: [
          "Compare scout findings with the current codebook. Mark each finding as new, already covered, possible merge, or needs human review. Do not create active codes directly.",
          "Compare scout findings with the current codebook. Mark each finding as new_code, already_covered, possible_merge, or needs_human_review. Do not create active codes directly. Use only evidence quotes that were already copied exactly from the document."
        ],
        annotationPrompt: [
          "Apply only the existing active codebook. Do not create codes. Return exact verbatim quotes only. If a code does not appear, list it as having no instance."
        ]
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
        loadProjectBtn: $("loadProjectBtn"),
        loadModelsBtn: $("loadModelsBtn"),
        maxQuotes: $("maxQuotes"),
        mergePrompt: $("mergePrompt"),
        modelPill: $("modelPill"),
        modelSelect: $("modelSelect"),
        newId: $("newId"),
        newSource: $("newSource"),
        newText: $("newText"),
        newProjectBtn: $("newProjectBtn"),
        processQueueBtn: $("processQueueBtn"),
        progressMascot: $("progressMascot"),
        projectInput: $("projectInput"),
        queuePill: $("queuePill"),
        reasoning: $("reasoning"),
        refinePrompt: $("refinePrompt"),
        reviewList: $("reviewList"),
        auditList: $("auditList"),
        saveBtn: $("saveBtn"),
        saveCodeBtn: $("saveCodeBtn"),
        snapshotBtn: $("snapshotBtn"),
        statCoded: $("statCoded"),
        statCodes: $("statCodes"),
        statDocs: $("statDocs"),
        statQuotes: $("statQuotes"),
        statusLine: $("statusLine"),
        stopProcessBtn: $("stopProcessBtn"),
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
          const preferences = { ...clone(defaults.preferences), ...(parsed.preferences || {}) };
          migrateLegacyDefaultPrompts(preferences, parsed.preferences || {});
          const loaded = {
            ...clone(defaults),
            ...parsed,
            preferences
          };
          loaded.codebook = (loaded.codebook || []).map((code, index) => normalizeCode(code, index));
          loaded.annotations = (loaded.annotations || []).map(normalizeAnnotationDoc);
          loaded.reviewItems = loaded.reviewItems || [];
          loaded.auditLog = loaded.auditLog || [];
          return loaded;
        } catch {
          return clone(defaults);
        }
      }

      function migrateLegacyDefaultPrompts(preferences, savedPreferences) {
        for (const key of Object.keys(LEGACY_DEFAULT_PROMPTS)) {
          if (LEGACY_DEFAULT_PROMPTS[key].includes(savedPreferences[key])) {
            preferences[key] = defaults.preferences[key];
          }
        }
      }

      function normalizeCode(code, index = 0) {
        const name = String(code.name || code.code || "").trim();
        return {
          id: code.id || uid(),
          code_id: code.code_id || code.codeId || `C${String(index + 1).padStart(3, "0")}`,
          name,
          definition: String(code.definition || "").trim(),
          status: CODE_STATUSES.includes(code.status) ? code.status : "active",
          created_from_doc: code.created_from_doc || code.createdFromDoc || "",
          example_quotes: Array.isArray(code.example_quotes)
            ? code.example_quotes
            : code.example
              ? [{ doc_id: code.created_from_doc || "", quote: code.example, verified: true }]
              : [],
          history: Array.isArray(code.history)
            ? code.history
            : [
                {
                  event: code.decision || "imported",
                  doc_id: code.created_from_doc || "",
                  reason: code.decision_note || "Loaded from earlier Quala state."
                }
              ]
        };
      }

      function normalizeAnnotationDoc(doc) {
        return {
          ...doc,
          quotes: (doc.quotes || []).map((quote) => ({
            ...quote,
            code_ids: quote.code_ids || [],
            annotations: quote.annotations || []
          }))
        };
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

      function setProcessing(active) {
        els.processQueueBtn.disabled = active;
        els.stopProcessBtn.disabled = !active;
      }

      function stopProcessing() {
        if (!activeRun) return;
        activeRun.stopped = true;
        activeRun.controller.abort();
        setStatus("Stopping processing.");
        log("Stopping after the current request is canceled.");
      }

      let shownProgress = 0;
      let progressFrame = null;
      let activeRun = null;

      function drawProgress(percent) {
        shownProgress = percent;
        els.progressMascot.style.setProperty("--progress", `${percent}%`);
        els.progressMascot.classList.toggle("active", percent > 0 && percent < 100);
      }

      function setProgress(value) {
        const percent = Math.max(0, Math.min(100, value));
        if (progressFrame) cancelAnimationFrame(progressFrame);
        if (percent === 0 || typeof requestAnimationFrame !== "function") {
          drawProgress(percent);
          return;
        }
        const start = shownProgress;
        const change = percent - start;
        const duration = 650;
        const startTime = performance.now();
        const step = (now) => {
          const elapsed = Math.min(1, (now - startTime) / duration);
          const eased = 1 - Math.pow(1 - elapsed, 3);
          drawProgress(start + change * eased);
          if (elapsed < 1) progressFrame = requestAnimationFrame(step);
        };
        progressFrame = requestAnimationFrame(step);
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
        renderReview();
        renderAudit();
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
        els.mergePrompt.value = state.preferences.mergePrompt;
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
        els.codePill.textContent = `${state.codebook.filter((code) => code.status !== "rejected").length} codes`;
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
          const pct = coverage[code.code_id] || coverage[code.name] || 0;
          row.innerHTML = `
            <td>
              <strong>${escapeHtml(code.name)}</strong>
              <div class="muted tiny">${escapeHtml(code.code_id)}</div>
              <span class="pill ${code.status === "active" ? "ok" : code.status === "needs_human_review" ? "warn" : ""}">${escapeHtml(code.status)}</span>
            </td>
            <td>${escapeHtml(code.definition || "")}</td>
            <td><div class="quote small">${escapeHtml(code.example_quotes?.[0]?.quote || "")}</div></td>
            <td><span class="pill">${pct}%</span></td>
            <td><button data-edit-code="${escapeHtml(code.id)}">Edit</button></td>
          `;
          els.codebookRows.appendChild(row);
        }
        els.codebookRows.querySelectorAll("[data-edit-code]").forEach((btn) => {
          btn.addEventListener("click", () => openCodeModal(btn.dataset.editCode));
        });
      }

      function renderReview() {
        if (!els.reviewList) return;
        els.reviewList.innerHTML = "";
        const openItems = state.reviewItems.filter((item) => item.status === "open");
        if (!openItems.length) {
          els.reviewList.innerHTML = `<div class="item muted small">No human review items.</div>`;
          return;
        }
        for (const item of openItems) {
          const div = document.createElement("div");
          div.className = "item";
          const quotes = (item.evidence_quotes || [])
            .map((quote) => `<div class="quote small" style="margin-top: 8px">${escapeHtml(quote)}</div>`)
            .join("");
          div.innerHTML = `
            <div class="itemTitle">
              <span>${escapeHtml(item.type.replaceAll("_", " "))}</span>
              <span class="pill">${escapeHtml(item.doc_id || "")}</span>
            </div>
            <h3 style="margin-top: 8px">${escapeHtml(item.suggested_code?.name || item.scout_code_name || "")}</h3>
            <p class="small">${escapeHtml(item.suggested_code?.definition || "")}</p>
            ${quotes}
            <p class="muted small" style="margin-top: 8px">${escapeHtml(item.rationale || "")}</p>
            <div class="row" style="margin-top: 8px">
              <button class="primary" data-approve-review="${escapeHtml(item.id)}">Approve</button>
              <button data-reject-review="${escapeHtml(item.id)}">Reject</button>
            </div>
          `;
          els.reviewList.appendChild(div);
        }
        els.reviewList.querySelectorAll("[data-approve-review]").forEach((btn) => {
          btn.addEventListener("click", () => approveReviewItem(btn.dataset.approveReview));
        });
        els.reviewList.querySelectorAll("[data-reject-review]").forEach((btn) => {
          btn.addEventListener("click", () => rejectReviewItem(btn.dataset.rejectReview));
        });
      }

      function renderAudit() {
        if (!els.auditList) return;
        els.auditList.innerHTML = "";
        if (!state.auditLog.length) {
          els.auditList.innerHTML = `<div class="item muted small">No audit events yet.</div>`;
          return;
        }
        state.auditLog
          .slice()
          .reverse()
          .forEach((entry) => {
            const div = document.createElement("div");
            div.className = "item";
            div.innerHTML = `
              <div class="itemTitle">
                <span>${escapeHtml(entry.event_type)}</span>
                <span class="pill">${escapeHtml(entry.doc_id || "system")}</span>
              </div>
              <div class="muted tiny">${escapeHtml(entry.timestamp)}</div>
              <p class="small" style="margin-top: 8px">${escapeHtml(entry.reason || "")}</p>
            `;
            els.auditList.appendChild(div);
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
        state.preferences.mergePrompt = els.mergePrompt.value.trim();
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
          annotations: clone(state.annotations),
          reviewItems: clone(state.reviewItems),
          auditLog: clone(state.auditLog)
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
        state.reviewItems = clone(entry.reviewItems || []);
        state.auditLog = clone(entry.auditLog || []);
        render();
        saveState("Snapshot restored.");
      }

      function computeCoverage() {
        const total = Math.max(1, state.docs.length);
        const coverage = {};
        for (const code of state.codebook) {
          const docIds = new Set();
          for (const example of code.example_quotes || []) {
            const docId = example.doc_id || code.created_from_doc;
            if (docId && example.verified !== false) docIds.add(docId);
          }
          for (const docAnn of state.annotations) {
            for (const quote of docAnn.quotes || []) {
              const hasCodeId = (quote.code_ids || []).includes(code.code_id);
              const hasCodeName = (quote.annotations || []).includes(code.name);
              if (hasCodeId || hasCodeName) docIds.add(docAnn.id);
            }
          }
          const pct = Math.round((docIds.size / total) * 100);
          coverage[code.code_id] = pct;
          coverage[code.name] = pct;
        }
        return coverage;
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

      function createEmptyProject(keepPreferences = true) {
        const preferences = keepPreferences ? clone(state.preferences) : clone(defaults.preferences);
        return {
          ...clone(defaults),
          preferences
        };
      }

      function newProject() {
        if (activeRun) {
          setStatus("Stop processing before starting a new project.");
          return;
        }
        if (!window.confirm("Start a new project and clear the current workspace?")) return;
        state = createEmptyProject(true);
        setProgress(0);
        render();
        saveState("New project started.");
      }

      async function loadProjectFile(file) {
        if (activeRun) {
          setStatus("Stop processing before loading a project.");
          return;
        }
        try {
          const payload = JSON.parse(await file.text());
          state = projectStateFromPayload(payload);
          setProgress(0);
          render();
          saveState("Project loaded.");
        } catch (error) {
          setStatus("Could not load project.");
          log(error.message);
        }
      }

      function projectStateFromPayload(payload) {
        const currentPreferences = clone(state.preferences);
        const project = payload.project || payload;
        const projectPreferences = project.preferences || payload.preferences || {};
        const preferences = {
          ...currentPreferences,
          ...projectPreferences,
          apiKey: currentPreferences.apiKey
        };
        migrateLegacyDefaultPrompts(preferences, projectPreferences);
        const loaded = {
          ...clone(defaults),
          preferences,
          docs: normalizeLoadedDocs(project.docs || payload.docs || payload.data || []),
          selectedDocId: project.selectedDocId || payload.selectedDocId || null,
          codebook: (payload.codebook || project.codebook || []).map((code, index) => normalizeCode(code, index)),
          annotations: normalizeLoadedAnnotations(payload.data || project.annotations || payload.annotations || []),
          history: project.history || payload.history || [],
          reviewItems: payload.review_items || project.reviewItems || payload.reviewItems || [],
          auditLog: payload.audit_log || project.auditLog || payload.auditLog || []
        };
        if (!loaded.docs.some((doc) => doc.id === loaded.selectedDocId)) {
          loaded.selectedDocId = loaded.docs[0]?.id || null;
        }
        return loaded;
      }

      function normalizeLoadedDocs(items) {
        const docs = [];
        const seen = new Set();
        for (const item of items || []) {
          const id = String(item.id || item.doc_id || `D${docs.length + 1}`).trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          docs.push({
            id,
            source: item.source || item.metadata?.source || "",
            text: item.text || "",
            status: item.status || (item.annotation || item.quotes ? "coded" : "queued")
          });
        }
        return docs;
      }

      function normalizeLoadedAnnotations(items) {
        return (items || [])
          .filter((item) => Array.isArray(item.quotes) || Array.isArray(item.annotation))
          .map((item) =>
            normalizeAnnotationDoc({
              id: item.id || item.doc_id || "",
              source: item.source || item.metadata?.source || "",
              text: item.text || "",
              annotation: item.annotation || [],
              quotes: item.quotes || []
            })
          );
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

      function scoutSchema() {
        return {
          name: "quala_document_scout",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              doc_id: { type: "string" },
              scout_codes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    temporary_code_name: { type: "string" },
                    definition: { type: "string" },
                    supporting_quotes: { type: "array", items: { type: "string" } },
                    confidence: { type: "string", enum: ["low", "medium", "high"] }
                  },
                  required: ["temporary_code_name", "definition", "supporting_quotes", "confidence"]
                }
              }
            },
            required: ["doc_id", "scout_codes"]
          },
          strict: true
        };
      }

      function applierSchema() {
        return {
          name: "quala_codebook_applier",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              doc_id: { type: "string" },
              applied_codes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    code_id: { type: "string" },
                    instances: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          quote: { type: "string" },
                          reason: { type: "string" }
                        },
                        required: ["quote", "reason"]
                      }
                    }
                  },
                  required: ["code_id", "instances"]
                }
              },
              codes_with_no_instance: { type: "array", items: { type: "string" } }
            },
            required: ["doc_id", "applied_codes", "codes_with_no_instance"]
          },
          strict: true
        };
      }

      function noveltySchema() {
        return {
          name: "quala_novelty_detector",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              doc_id: { type: "string" },
              novelty_decisions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    scout_code_name: { type: "string" },
                    decision: { type: "string", enum: ["new_code", "already_covered", "possible_merge", "needs_human_review"] },
                    matched_code_id: { type: "string" },
                    suggested_code: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        definition: { type: "string" }
                      },
                      required: ["name", "definition"]
                    },
                    evidence_quotes: { type: "array", items: { type: "string" } },
                    rationale: { type: "string" }
                  },
                  required: ["scout_code_name", "decision", "matched_code_id", "suggested_code", "evidence_quotes", "rationale"]
                }
              }
            },
            required: ["doc_id", "novelty_decisions"]
          },
          strict: true
        };
      }

      function mergeSchema() {
        return {
          name: "quala_merge_reviewer",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              merge_review: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    candidate_code_name: { type: "string" },
                    existing_code_id: { type: "string" },
                    argument_for_merge: { type: "string" },
                    argument_against_merge: { type: "string" },
                    recommendation: { type: "string", enum: ["merge", "keep_separate", "needs_human_review"] },
                    confidence: { type: "string", enum: ["low", "medium", "high"] }
                  },
                  required: [
                    "candidate_code_name",
                    "existing_code_id",
                    "argument_for_merge",
                    "argument_against_merge",
                    "recommendation",
                    "confidence"
                  ]
                }
              }
            },
            required: ["merge_review"]
          },
          strict: true
        };
      }

      function codebookForModel() {
        return state.codebook
          .filter((code) => code.status === "active" || code.status === "dormant")
          .map((code) => ({
            code_id: code.code_id,
            name: code.name,
            definition: code.definition,
            status: code.status
          }));
      }

      function currentCodebookForModel() {
        return state.codebook
          .filter((code) => code.status !== "rejected" && code.status !== "merged")
          .map((code) => ({
            code_id: code.code_id,
            name: code.name,
            definition: code.definition,
            status: code.status
          }));
      }

      function buildScoutPrompt(doc) {
        return [
          {
            role: "system",
            content:
              "You are Agent 1, Document scout. Return only JSON that matches the schema. You must not use or ask for the current codebook. Every supporting quote must be copied exactly from document_text as one contiguous substring. Do not alter spelling, punctuation, capitalization, spacing, or wording."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                doc_id: doc.id,
                study_lens: state.preferences.lens,
                scout_instruction: state.preferences.codebookPrompt,
                document_text: doc.text
              },
              null,
              2
            )
          }
        ];
      }

      function buildApplierPrompt(doc) {
        return [
          {
            role: "system",
            content:
              "You are Agent 2, Codebook applier. Return only JSON that matches the schema. You cannot create codes. Every quote must be copied exactly from document_text as one contiguous substring. Do not alter spelling, punctuation, capitalization, spacing, or wording. If a code has no quote, put its code_id in codes_with_no_instance."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                doc_id: doc.id,
                document_text: doc.text,
                codebook: codebookForModel(),
                annotation_instruction: state.preferences.annotationPrompt,
                max_quotes_per_code: state.preferences.maxQuotes,
                required_behavior: [
                  "Apply only listed code_id values.",
                  "Return exact verbatim quotes only.",
                  "Each quote must pass document_text.includes(quote).",
                  "Do not paraphrase, clean up, shorten by rewriting, merge separate passages, or add ellipses.",
                  "Include positive and negative cases when they match the code definition."
                ]
              },
              null,
              2
            )
          }
        ];
      }

      function buildNoveltyPrompt(doc, scoutOutput) {
        return [
          {
            role: "system",
            content:
              "You are Agent 3, Novelty detector. Return only JSON that matches the schema. Compare scout findings with the current codebook. Do not create active codes. Evidence quotes must come from the verified scout quotes without changes."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                doc_id: doc.id,
                novelty_instruction: state.preferences.refinePrompt,
                scout_codes: scoutOutput.scout_codes || [],
                current_codebook: currentCodebookForModel(),
                allowed_decisions: ["new_code", "already_covered", "possible_merge", "needs_human_review"]
              },
              null,
              2
            )
          }
        ];
      }

      function buildMergePrompt(noveltyOutput) {
        const candidates = (noveltyOutput.novelty_decisions || []).filter((item) =>
          ["new_code", "possible_merge", "needs_human_review"].includes(item.decision)
        );
        return [
          {
            role: "system",
            content:
              "You are Agent 4, Merge reviewer. Return only JSON that matches the schema. You must argue both sides. Recommend merge only when meaning, use case, evidence type, and definition clarity all support merging."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                merge_instruction: state.preferences.mergePrompt,
                candidates,
                current_codebook: currentCodebookForModel(),
                merge_rule: [
                  "same meaning",
                  "same use case",
                  "same type of evidence",
                  "definitions would become clearer after merge",
                  "do not merge only because words are similar"
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

      async function callOpenAI(input, schema, signal) {
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
        const response = await fetchWithTimeout(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${state.preferences.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          },
          signal
        );
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI request failed ${response.status}. ${errText}`);
        }
        const data = await response.json();
        const text = data.output_text || extractResponseText(data);
        if (!text) throw new Error("The model returned no text.");
        return JSON.parse(text);
      }

      async function fetchWithTimeout(url, options, signal) {
        const timeoutMs = 120000;
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
        const abortRequest = () => timeoutController.abort();
        if (signal) {
          if (signal.aborted) timeoutController.abort();
          else signal.addEventListener("abort", abortRequest, { once: true });
        }
        try {
          return await fetch(url, { ...options, signal: timeoutController.signal });
        } catch (error) {
          if (timeoutController.signal.aborted) {
            throw new Error(signal?.aborted ? "Processing stopped." : "OpenAI request timed out after 2 minutes.");
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
          if (signal) signal.removeEventListener("abort", abortRequest);
        }
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

      async function processQueue() {
        if (activeRun) throw new Error("Processing is already running.");
        const docs = state.docs.filter((doc) => doc.status !== "coded");
        if (!docs.length) {
          setStatus("No queued datapoints to process.");
          log("All datapoints are already coded.");
          return;
        }
        activeRun = { controller: new AbortController(), stopped: false };
        setProcessing(true);
        const signal = activeRun.controller.signal;
        try {
          createSnapshot("Before processing queue");
          for (let index = 0; index < docs.length; index += 1) {
            ensureProcessingActive(signal);
            state.selectedDocId = docs[index].id;
            await processDoc(docs[index], signal, index, docs.length);
            render();
          }
          createSnapshot("After processing queue");
          setProgress(100);
          setStatus("Queue processed.");
          log("Queue processed. Review pending codebook changes before using those codes as active codes.");
          render();
        } finally {
          activeRun = null;
          setProcessing(false);
        }
      }

      async function processDoc(doc, signal, index, total) {
        const baseProgress = Math.round((index / Math.max(1, total)) * 100);
        const span = Math.round(100 / Math.max(1, total));
        const stepProgress = (value) => setProgress(baseProgress + Math.round((value / 100) * span));
        stepProgress(8);
        setStatus(`Processing ${index + 1} of ${total}. ${doc.id}.`);
        log("Running document scout.");
        const scoutOutput = await callOpenAI(buildScoutPrompt(doc), scoutSchema(), signal);
        ensureProcessingActive(signal);
        stepProgress(28);
        const hasCodebook = codebookForModel().length > 0;
        log(hasCodebook ? "Running codebook applier." : "No active codebook yet. Skipping codebook applier.");
        const applierOutput = hasCodebook
          ? await callOpenAI(buildApplierPrompt(doc), applierSchema(), signal)
          : { doc_id: doc.id, applied_codes: [], codes_with_no_instance: [] };
        ensureProcessingActive(signal);
        stepProgress(46);
        log("Checking exact quotes.");
        const verification = evidenceAuditor(doc.text, collectQuotes(scoutOutput, applierOutput));
        const verifiedScout = removeFailedScoutQuotes(scoutOutput, verification);
        const verifiedApplier = removeFailedApplierQuotes(applierOutput, verification);
        logVerification(doc.id, verification);
        applyAnnotationResult(doc, verifiedApplier);
        stepProgress(62);
        log("Running novelty detector.");
        const noveltyOutput = await callOpenAI(buildNoveltyPrompt(doc, verifiedScout), noveltySchema(), signal);
        ensureProcessingActive(signal);
        const verifiedNovelty = removeFailedNoveltyQuotes(noveltyOutput, verification, verifiedScout);
        stepProgress(78);
        const needsMergeReview = (verifiedNovelty.novelty_decisions || []).some((item) =>
          ["new_code", "possible_merge", "needs_human_review"].includes(item.decision)
        );
        log(needsMergeReview ? "Running merge reviewer." : "No merge review needed.");
        const mergeOutput = needsMergeReview ? await callOpenAI(buildMergePrompt(verifiedNovelty), mergeSchema(), signal) : { merge_review: [] };
        ensureProcessingActive(signal);
        buildHumanReviewPacket(doc, verifiedNovelty, mergeOutput, verification);
        updateDormantStatuses();
        doc.status = "coded";
        addAuditLog({
          doc_id: doc.id,
          event_type: "document_processed",
          reason: "Scout, applier, verifier, novelty detector, merge reviewer, and review packet completed."
        });
        stepProgress(100);
        log(`Processed ${doc.id}.`);
      }

      function ensureProcessingActive(signal) {
        if (signal.aborted) throw new Error("Processing stopped.");
      }

      function collectQuotes(scoutOutput, applierOutput) {
        const quotes = [];
        for (const code of scoutOutput.scout_codes || []) {
          quotes.push(...(code.supporting_quotes || []));
        }
        for (const code of applierOutput.applied_codes || []) {
          for (const item of code.instances || []) quotes.push(item.quote);
        }
        return quotes;
      }

      function evidenceAuditor(documentText, quotes) {
        const seen = new Set();
        const verified_quotes = [];
        const failed_quotes = [];
        for (const raw of quotes) {
          const quote = String(raw || "");
          if (!quote || seen.has(quote)) continue;
          seen.add(quote);
          const start = documentText.indexOf(quote);
          const result = {
            quote,
            verified: start !== -1,
            start_char: start !== -1 ? start : null,
            end_char: start !== -1 ? start + quote.length : null
          };
          if (result.verified) verified_quotes.push(result);
          else failed_quotes.push(result);
        }
        return { verified_quotes, failed_quotes };
      }

      function verifiedQuoteSet(verification) {
        return new Set((verification.verified_quotes || []).map((item) => item.quote));
      }

      function removeFailedScoutQuotes(scoutOutput, verification) {
        const verified = verifiedQuoteSet(verification);
        return {
          ...scoutOutput,
          scout_codes: (scoutOutput.scout_codes || [])
            .map((code) => ({
              ...code,
              supporting_quotes: (code.supporting_quotes || []).filter((quote) => verified.has(quote))
            }))
            .filter((code) => code.supporting_quotes.length)
        };
      }

      function removeFailedApplierQuotes(applierOutput, verification) {
        const verified = verifiedQuoteSet(verification);
        return {
          ...applierOutput,
          applied_codes: (applierOutput.applied_codes || [])
            .map((code) => ({
              ...code,
              instances: (code.instances || []).filter((item) => verified.has(item.quote))
            }))
            .filter((code) => code.instances.length)
        };
      }

      function removeFailedNoveltyQuotes(noveltyOutput, verification, scoutOutput = { scout_codes: [] }) {
        const verified = verifiedQuoteSet(verification);
        const scoutByName = new Map(
          (scoutOutput.scout_codes || []).map((code) => [String(code.temporary_code_name || "").toLowerCase(), code])
        );
        const decisions = (noveltyOutput.novelty_decisions || []).map((item) => {
          const evidence = (item.evidence_quotes || []).filter((quote) => verified.has(quote));
          const scout = scoutByName.get(String(item.scout_code_name || "").toLowerCase());
          const fallbackEvidence = evidence.length ? evidence : scout?.supporting_quotes || [];
          return {
            ...item,
            evidence_quotes: fallbackEvidence.filter((quote) => verified.has(quote))
          };
        });
        const decidedNames = new Set(decisions.map((item) => String(item.scout_code_name || "").toLowerCase()));
        for (const scout of scoutOutput.scout_codes || []) {
          const key = String(scout.temporary_code_name || "").toLowerCase();
          if (!key || decidedNames.has(key) || !scout.supporting_quotes?.length) continue;
          decisions.push({
            scout_code_name: scout.temporary_code_name,
            decision: "needs_human_review",
            matched_code_id: "",
            suggested_code: {
              name: scout.temporary_code_name,
              definition: scout.definition || ""
            },
            evidence_quotes: scout.supporting_quotes.filter((quote) => verified.has(quote)),
            rationale: "Novelty detector returned no decision for this verified scout finding."
          });
        }
        return {
          ...noveltyOutput,
          novelty_decisions: decisions
        };
      }

      function logVerification(docId, verification) {
        addAuditLog({
          doc_id: docId,
          event_type: "quotes_verified",
          reason: `${verification.verified_quotes.length} quotes passed. ${verification.failed_quotes.length} quotes failed.`
        });
        if (verification.failed_quotes.length) {
          addAuditLog({
            doc_id: docId,
            event_type: "quote_verification_failed",
            reason: verification.failed_quotes.map((item) => item.quote).join(" | ")
          });
        }
      }

      function applyAnnotationResult(doc, applierOutput) {
        const byQuote = new Map();
        const codeById = Object.fromEntries(state.codebook.map((code) => [code.code_id, code]));
        for (const applied of applierOutput.applied_codes || []) {
          const code = codeById[applied.code_id];
          if (!code) continue;
          for (const instance of applied.instances || []) {
            const quote = {
              id: uid(),
              quote: instance.quote,
              code_ids: [code.code_id],
              annotations: [code.name],
              certainty: 5,
              polarity: "mixed",
              rationale: instance.reason || ""
            };
          const existing = byQuote.get(quote.quote);
          if (!existing) {
            byQuote.set(quote.quote, quote);
            continue;
          }
          existing.code_ids = Array.from(new Set([...(existing.code_ids || []), ...quote.code_ids]));
          existing.annotations = Array.from(new Set([...existing.annotations, ...quote.annotations]));
          existing.certainty = Math.max(existing.certainty, quote.certainty);
          existing.rationale = [existing.rationale, quote.rationale].filter(Boolean).join(" ");
          }
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

      function buildHumanReviewPacket(doc, noveltyOutput, mergeOutput, verification) {
        const mergeByName = new Map((mergeOutput.merge_review || []).map((item) => [item.candidate_code_name.toLowerCase(), item]));
        let added = 0;
        for (const item of noveltyOutput.novelty_decisions || []) {
          if (item.decision === "already_covered") continue;
          if (!item.evidence_quotes?.length) continue;
          const merge = mergeByName.get((item.suggested_code?.name || item.scout_code_name || "").toLowerCase());
          const type = merge?.recommendation === "merge" ? "merge_decision" : "new_code";
          const candidateCodeId = type === "new_code" ? ensureCandidateCode(doc, item, verification) : "";
          const reviewItem = {
            id: uid(),
            status: "open",
            type,
            candidate_code_id: candidateCodeId,
            doc_id: doc.id,
            scout_code_name: item.scout_code_name,
            suggested_code: item.suggested_code,
            evidence_quotes: item.evidence_quotes,
            verification: verification.verified_quotes.filter((quote) => item.evidence_quotes.includes(quote.quote)),
            novelty_decision: item,
            merge_review: merge || null,
            system_recommendation: merge?.recommendation === "merge" ? "review_merge" : "approve",
            rationale: [item.rationale, merge?.argument_for_merge, merge?.argument_against_merge].filter(Boolean).join(" ")
          };
          state.reviewItems.push(reviewItem);
          added += 1;
        }
        if (added) {
          addAuditLog({
            doc_id: doc.id,
            event_type: "human_review_requested",
            reason: `${added} codebook change${added === 1 ? "" : "s"} need human review.`
          });
        }
      }

      function ensureCandidateCode(doc, noveltyItem, verification) {
        const name = String(noveltyItem.suggested_code?.name || noveltyItem.scout_code_name || "").trim();
        if (!name) return "";
        const existing = state.codebook.find((code) => code.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (existing.status === "candidate") existing.status = "needs_human_review";
          return existing.code_id;
        }
        const codeId = nextCodeId();
        const verifiedQuotes = verification.verified_quotes.filter((quote) => (noveltyItem.evidence_quotes || []).includes(quote.quote));
        state.codebook.push({
          id: uid(),
          code_id: codeId,
          name,
          definition: String(noveltyItem.suggested_code?.definition || "").trim(),
          status: "needs_human_review",
          created_from_doc: doc.id,
          example_quotes: verifiedQuotes.map((quote) => ({
            doc_id: doc.id,
            quote: quote.quote,
            verified: quote.verified,
            start_char: quote.start_char,
            end_char: quote.end_char
          })),
          history: [
            {
              event: "proposed",
              doc_id: doc.id,
              reason: noveltyItem.rationale || "Proposed by novelty detector."
            }
          ]
        });
        addAuditLog({
          doc_id: doc.id,
          event_type: "candidate_code_added",
          code_id: codeId,
          reason: `Candidate code ${name} needs human review.`
        });
        return codeId;
      }

      function nextCodeId() {
        const max = state.codebook.reduce((best, code) => {
          const match = String(code.code_id || "").match(/^C(\d+)$/i);
          return match ? Math.max(best, Number(match[1])) : best;
        }, 0);
        return `C${String(max + 1).padStart(3, "0")}`;
      }

      function approveReviewItem(id) {
        const item = state.reviewItems.find((review) => review.id === id);
        if (!item || item.status !== "open") return;
        if (item.type === "merge_decision" && item.merge_review?.existing_code_id) {
          const existing = state.codebook.find((code) => code.code_id === item.merge_review.existing_code_id);
          if (!existing) return;
          existing.definition = item.suggested_code.definition || existing.definition;
          existing.status = "active";
          existing.example_quotes = [
            ...(existing.example_quotes || []),
            ...item.verification.map((quote) => ({
              doc_id: item.doc_id,
              quote: quote.quote,
              verified: quote.verified,
              start_char: quote.start_char,
              end_char: quote.end_char
            }))
          ];
          existing.history = [
            ...(existing.history || []),
            {
              event: "merged_candidate",
              doc_id: item.doc_id,
              reason: item.rationale || `Merged candidate ${item.suggested_code.name}.`
            }
          ];
          item.status = "approved";
          item.decided_at = new Date().toISOString();
          addAuditLog({
            doc_id: item.doc_id,
            event_type: "merge_approved",
            code_id: existing.code_id,
            reason: `Human merged ${item.suggested_code.name} into ${existing.name}.`,
            approved_by: "human"
          });
          createSnapshot(`Merged ${item.suggested_code.name}`);
          render();
          return;
        }
        const candidate = state.codebook.find((code) => code.code_id === item.candidate_code_id);
        if (candidate) {
          candidate.name = item.suggested_code.name;
          candidate.definition = item.suggested_code.definition;
          candidate.status = "active";
          candidate.history = [
            ...(candidate.history || []),
            {
              event: "approved",
              doc_id: item.doc_id,
              reason: item.rationale || "Approved from human review."
            }
          ];
          item.status = "approved";
          item.decided_at = new Date().toISOString();
          addAuditLog({
            doc_id: item.doc_id,
            event_type: "new_code_approved",
            code_id: candidate.code_id,
            reason: `Human approved ${candidate.name}.`,
            approved_by: "human"
          });
          createSnapshot(`Approved ${candidate.name}`);
          render();
          return;
        }
        const codeId = nextCodeId();
        state.codebook.push({
          id: uid(),
          code_id: codeId,
          name: item.suggested_code.name,
          definition: item.suggested_code.definition,
          status: "active",
          created_from_doc: item.doc_id,
          example_quotes: item.verification.map((quote) => ({
            doc_id: item.doc_id,
            quote: quote.quote,
            verified: quote.verified,
            start_char: quote.start_char,
            end_char: quote.end_char
          })),
          history: [
            {
              event: "created",
              doc_id: item.doc_id,
              reason: item.rationale || "Approved from human review."
            }
          ]
        });
        item.status = "approved";
        item.decided_at = new Date().toISOString();
        addAuditLog({
          doc_id: item.doc_id,
          event_type: "new_code_added",
          code_id: codeId,
          reason: `Human approved ${item.suggested_code.name}.`,
          approved_by: "human"
        });
        createSnapshot(`Approved ${item.suggested_code.name}`);
        render();
      }

      function rejectReviewItem(id) {
        const item = state.reviewItems.find((review) => review.id === id);
        if (!item || item.status !== "open") return;
        const candidate = state.codebook.find((code) => code.code_id === item.candidate_code_id);
        if (candidate && candidate.status === "needs_human_review") {
          candidate.status = "rejected";
          candidate.history = [
            ...(candidate.history || []),
            {
              event: "rejected",
              doc_id: item.doc_id,
              reason: "Rejected by human review."
            }
          ];
        }
        item.status = "rejected";
        item.decided_at = new Date().toISOString();
        addAuditLog({
          doc_id: item.doc_id,
          event_type: "review_item_rejected",
          reason: `Human rejected ${item.suggested_code?.name || item.scout_code_name}.`,
          approved_by: "human"
        });
        createSnapshot(`Rejected ${item.suggested_code?.name || item.scout_code_name}`);
        render();
      }

      function updateDormantStatuses() {
        const activeNames = new Set(state.annotations.flatMap((doc) => doc.annotation || []));
        for (const code of state.codebook) {
          if (code.status === "active" && !activeNames.has(code.name)) code.status = "dormant";
          if (code.status === "dormant" && activeNames.has(code.name)) code.status = "active";
        }
      }

      function addAuditLog(entry) {
        state.auditLog.push({
          timestamp: new Date().toISOString(),
          doc_id: entry.doc_id || "",
          event_type: entry.event_type,
          code_id: entry.code_id || "",
          reason: entry.reason || "",
          approved_by: entry.approved_by || ""
        });
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
        const { apiKey, ...safePreferences } = state.preferences;
        return {
          tool: "Quala",
          exported_at: new Date().toISOString(),
          project: {
            docs: state.docs,
            selectedDocId: state.selectedDocId,
            history: state.history,
            preferences: safePreferences
          },
          codebook: state.codebook.map(({ id, ...rest }) => rest),
          review_items: state.reviewItems,
          audit_log: state.auditLog,
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
        els.editCodeName.value = code?.name || "";
        els.editCodeDefinition.value = code?.definition || "";
        els.editCodeExample.value = code?.example_quotes?.[0]?.quote || "";
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

      els.newProjectBtn.addEventListener("click", newProject);
      els.loadProjectBtn.addEventListener("click", () => els.projectInput.click());
      els.projectInput.addEventListener("change", async () => {
        const file = els.projectInput.files?.[0];
        if (file) await loadProjectFile(file);
        els.projectInput.value = "";
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

      els.processQueueBtn.addEventListener("click", async () => {
        try {
          await processQueue();
        } catch (err) {
          setProgress(0);
          setStatus(err.message === "Processing stopped." ? "Processing stopped." : "Processing failed.");
          log(err.message);
        }
      });

      els.stopProcessBtn.addEventListener("click", stopProcessing);

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
        const existing = state.codebook.find((code) => code.id === id);
        const next = {
          id,
          code_id: existing?.code_id || nextCodeId(),
          name: els.editCodeName.value.trim(),
          definition: els.editCodeDefinition.value.trim(),
          status: existing?.status || "active",
          created_from_doc: existing?.created_from_doc || "",
          example_quotes: els.editCodeExample.value.trim()
            ? [
                {
                  doc_id: existing?.created_from_doc || "",
                  quote: els.editCodeExample.value.trim(),
                  verified: true
                }
              ]
            : [],
          history: [
            ...(existing?.history || []),
            {
              event: "manual_edit",
              doc_id: existing?.created_from_doc || "",
              reason: "Edited by user."
            }
          ]
        };
        if (!next.name) return;
        state.codebook = state.codebook.filter((code) => code.id !== id);
        state.codebook.push(next);
        addAuditLog({
          event_type: "code_manual_edit",
          code_id: next.code_id,
          reason: `User edited ${next.name}.`,
          approved_by: "human"
        });
        createSnapshot(`Edited code ${next.name}`);
        els.codeModal.classList.remove("open");
        render();
      });

      els.snapshotBtn.addEventListener("click", () => {
        createSnapshot("Manual snapshot");
        render();
      });

      [els.apiKey, els.modelSelect, els.temperature, els.verbosity, els.reasoning, els.maxQuotes, els.lens, els.codebookPrompt, els.refinePrompt, els.mergePrompt, els.annotationPrompt].forEach(
        (el) => el.addEventListener("change", () => {
          readPreferences();
          saveState("Preferences saved.");
        })
      );

      render();
    
