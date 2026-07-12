
      const STORE_KEY = "quala-state-v1";
      const API_KEY_STORE_KEY = "quala-api-key-v1";
      const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
      const AUTOSAVE_HISTORY_COUNTS = [60, 30, 15, 5, 1, 0];

      const defaults = {
        docs: [],
        selectedDocId: null,
        codebook: [],
        annotations: [],
        history: [],
        auditLog: [],
        preferences: {
          apiKey: "",
          model: "gpt-4.1",
          models: ["gpt-4.1", "gpt-4.1-mini", "gpt-5"],
          verbosity: "medium",
          reasoning: "low",
          temperature: 0.2,
          maxQuotes: 12,
          codingUnitSize: 3,
          codeAbstraction: 3,
          themeGranularity: "balanced",
          lens:
            "This is a general qualitative study. Identify recurring themes, important differences between participants or documents, unexpected concerns, helpful or harmful experiences, needs, barriers, motivations, decisions, and concrete examples that answer the research question.",
          codebookPrompt:
            "Find possible new concepts in this document without using the current codebook. Focus on ideas that help answer the study question. Choose rich supporting quotes that can be understood on their own. Include the interviewer question when the response has little meaning without it. Include enough surrounding turns to preserve the participant's meaning, reasoning, and relevant details. Prefer a complete thought over a short fragment. Every supporting quote must be copied exactly from the document as one contiguous substring. Do not change spelling, punctuation, capitalization, spacing, or wording. Do not paraphrase. Do not add ellipses. Before returning a quote, check that document_text.includes(quote) would be true.",
          refinePrompt:
            "Compare scout findings with the current codebook. Mark each finding as new_code, already_covered, or possible_merge. Use only evidence quotes that were already copied exactly from the document.",
          mergePrompt:
            "Review whether candidate codes should stay separate or merge with existing codes. Argue both sides. Recommend merging only when the meaning, use case, and evidence type are the same and the merged definition would be clearer.",
          annotationPrompt:
            "Apply only the existing active codebook. Do not create codes. Choose rich quotes that can be understood on their own. Include the interviewer question when the response has little meaning without it. Include enough surrounding turns to preserve the participant's meaning, reasoning, and relevant details. Prefer a complete thought over a short fragment. Return exact verbatim quotes only. Each quote must be copied exactly from the document as one contiguous substring. Do not change spelling, punctuation, capitalization, spacing, or wording. Do not paraphrase. Do not add ellipses. Before returning a quote, check that document_text.includes(quote) would be true. If a code does not appear, list it as having no instance."
        }
      };

      const CODE_STATUSES = ["active", "merged", "dormant", "rejected", "needs_human_review", "candidate"];
      const THEME_GRANULARITY_OPTIONS = {
        broad: {
          label: "Broad",
          summary: "Use fewer, larger themes.",
          prompt:
            "Prefer fewer, broader themes. Merge closely related candidate themes when they answer the same research question, even if their wording differs. Treat low-count themes as candidates for merging unless they capture a clearly distinct or important idea."
        },
        balanced: {
          label: "Balanced",
          summary: "Balance theme clarity and detail.",
          prompt:
            "Balance theme detail with a manageable codebook. Merge candidate themes when their meaning and use are substantially the same. Keep a low-count theme only when it captures a distinct idea that would be lost by merging."
        },
        detailed: {
          label: "Detailed",
          summary: "Keep more specific themes.",
          prompt:
            "Prefer more specific themes. Do not merge candidate themes only because they are related or low count. Keep smaller themes separate when they capture a distinct participant meaning, context, mechanism, or consequence."
        }
      };
      const CODING_BEHAVIOR_DEMO = {
        paragraphs: [
          "In our team, everyone expects instant replies. I spend half my day answering Slack messages. Then I have no time left for actual work. I keep switching between Slack, email, and meetings, and I cannot focus.",
          "When deadlines are close, I reply even faster because I do not want to block anyone. By the end of the day, I feel busy but not productive."
        ],
        excerpts: {
          1: ["instant replies", "no time left for actual work"],
          2: [
            "I spend half my day answering Slack messages.",
            "I keep switching between Slack, email, and meetings, and I cannot focus."
          ],
          3: [
            "I spend half my day answering Slack messages. Then I have no time left for actual work.",
            "When deadlines are close, I reply even faster because I do not want to block anyone. By the end of the day, I feel busy but not productive."
          ],
          4: [
            "In our team, everyone expects instant replies. I spend half my day answering Slack messages. Then I have no time left for actual work. I keep switching between Slack, email, and meetings, and I cannot focus."
          ],
          5: [
            "In our team, everyone expects instant replies. I spend half my day answering Slack messages. Then I have no time left for actual work. I keep switching between Slack, email, and meetings, and I cannot focus.\n\nWhen deadlines are close, I reply even faster because I do not want to block anyone. By the end of the day, I feel busy but not productive."
          ]
        },
        codes: {
          1: ["instant replies", "busy but not productive"],
          2: ["frequent message responding", "difficulty maintaining focus"],
          3: ["communication overload", "pressure to stay responsive"],
          4: ["attention fragmentation", "responsiveness norms"],
          5: ["coordination costs reducing focused work", "availability expectations shaping productivity"]
        }
      };
      const CODING_UNIT_OPTIONS = {
        1: {
          label: "Phrase",
          explanation: "Code the smallest meaningful phrases. Use very short excerpts. Avoid combining nearby ideas.",
          exampleQuote: "I have no time left",
          exampleCode: "no time left",
          summary: "Expected excerpt length is a very short phrase.",
          prompt:
            "Use the smallest meaningful phrases as coding units. Keep excerpts very short. Do not combine separate ideas."
        },
        2: {
          label: "Sentence",
          explanation:
            "Code sentence-level meaning units. One code usually covers one sentence, or two tightly connected sentences.",
          exampleQuote: "I spend half my day answering Slack messages.",
          exampleCode: "time spent answering Slack messages",
          summary: "Expected excerpt length is usually one sentence.",
          prompt:
            "Use sentence-level meaning units. A code should usually cover one sentence, or two tightly connected sentences."
        },
        3: {
          label: "Short passage",
          explanation: "Code complete ideas. One code usually covers two to four sentences when they express the same point.",
          exampleQuote: "I spend half my day answering Slack messages. Then I have no time left for actual work.",
          exampleCode: "communication overload",
          summary: "Expected excerpt length is a short passage with one complete idea.",
          prompt:
            "Use short passages as coding units. A code should usually cover one complete idea, often two to four sentences."
        },
        4: {
          label: "Paragraph",
          explanation: "Code paragraph-sized meaning units. Merge nearby sentences when they form one coherent idea.",
          exampleQuote: "A paragraph where the participant explains one connected experience across several sentences.",
          exampleCode: "workflow disruption",
          summary: "Expected excerpt length is close to one coherent paragraph.",
          prompt:
            "Use paragraph-level meaning units. Merge adjacent sentences when they form one coherent idea."
        },
        5: {
          label: "Multi-paragraph theme",
          explanation: "Code larger sections when they express one shared theme. Use fewer, broader excerpts.",
          exampleQuote: "Several connected paragraphs that build one shared theme.",
          exampleCode: "organizational communication burden",
          summary: "Expected excerpt length can span multiple paragraphs when they share one theme.",
          prompt:
            "Use larger sections as coding units when they express one shared theme. Generate fewer, broader excerpts."
        }
      };
      const CODE_ABSTRACTION_OPTIONS = {
        1: {
          label: "In-Vivo",
          explanation: "Use the participant's own words whenever possible. Stay very close to the text. Avoid interpretation.",
          exampleQuote: "I have no time left for actual work",
          exampleCode: "no time left for actual work",
          summary: "Interpretation level is very low. Code labels should stay close to participant wording.",
          prompt:
            "Generate codes using the participant's own words whenever possible. Stay extremely close to the text. Avoid interpretation. Code labels may be direct quotes or lightly cleaned participant phrases."
        },
        2: {
          label: "Descriptive",
          explanation: "Describe observable actions, experiences, perceptions, or events. Keep interpretation low.",
          exampleQuote: "I spend half my day answering Slack messages",
          exampleCode: "excessive time spent responding to messages",
          summary: "Interpretation level is low. Code labels should describe what is visible in the excerpt.",
          prompt:
            "Generate codes that describe observable actions, experiences, perceptions, or events. Minimize interpretation. Prefer concrete labels over abstract labels."
        },
        3: {
          label: "Interpretive",
          explanation:
            "Capture the underlying meaning of the statement. Move beyond surface description, while staying grounded in the data.",
          exampleQuote: "I spend half my day answering Slack messages and then I have no time left for actual work",
          exampleCode: "communication overload",
          summary: "Interpretation level is moderate. Code labels should name the meaning behind the excerpt.",
          prompt:
            "Generate codes that capture the underlying meaning of participant statements. Move beyond surface description, but keep every code grounded in the excerpt."
        },
        4: {
          label: "Conceptual",
          explanation: "Use broader concepts that may connect multiple statements. Focus on patterns and shared meanings.",
          exampleQuote: "I keep switching between Slack, email, and meetings, and I cannot focus",
          exampleCode: "attention fragmentation",
          summary: "Interpretation level is high. Code labels may connect patterns across related excerpts.",
          prompt:
            "Generate codes that represent broader concepts and recurring patterns. Codes may synthesize related observations, but must still be traceable to the excerpt."
        },
        5: {
          label: "Theoretical",
          explanation: "Use codes that describe mechanisms, processes, structures, or theoretical constructs.",
          exampleQuote: "Everyone expects instant replies, so I keep stopping my work to respond",
          exampleCode: "coordination costs reducing knowledge-worker productivity",
          summary: "Interpretation level is very high. Code labels may describe mechanisms, but need support from the excerpt.",
          prompt:
            "Generate codes that represent mechanisms, processes, structures, or theoretical constructs that explain the observed experiences. Avoid unsupported speculation."
        }
      };
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
          "Apply only the existing active codebook. Do not create codes. Return exact verbatim quotes only. If a code does not appear, list it as having no instance.",
          "Apply only the existing active codebook. Do not create codes. Return exact verbatim quotes only. Each quote must be copied exactly from the document as one contiguous substring. Do not change spelling, punctuation, capitalization, spacing, or wording. Do not paraphrase. Do not add ellipses. Before returning a quote, check that document_text.includes(quote) would be true. If a code does not appear, list it as having no instance."
        ]
      };

      const hasDom =
        typeof document !== "undefined" &&
        typeof document.getElementById === "function" &&
        document.documentElement?.dataset?.qualaLegacyGui === "true";
      const $ = (id) => (hasDom ? document.getElementById(id) : null);
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
        auditDocFilter: $("auditDocFilter"),
        clearDocsBtn: $("clearDocsBtn"),
        codebookPrompt: $("codebookPrompt"),
        codebookRows: $("codebookRows"),
        codeAbstraction: $("codeAbstraction"),
        codeAbstractionPanel: $("codeAbstractionPanel"),
        codingBehaviorDemo: $("codingBehaviorDemo"),
        codeModal: $("codeModal"),
        codePill: $("codePill"),
        confirmExportBtn: $("confirmExportBtn"),
        confirmAddTextBtn: $("confirmAddTextBtn"),
        copyAnnotationsBtn: $("copyAnnotationsBtn"),
        copyCodebookBtn: $("copyCodebookBtn"),
        currentTitle: $("currentTitle"),
        deleteDocBtn: $("deleteDocBtn"),
        deleteCodeBtn: $("deleteCodeBtn"),
        docId: $("docId"),
        docList: $("docList"),
        docSource: $("docSource"),
        docText: $("docText"),
        codingUnitSize: $("codingUnitSize"),
        codingUnitSizePanel: $("codingUnitSizePanel"),
        editCodeDefinition: $("editCodeDefinition"),
        editCodeExample: $("editCodeExample"),
        editCodeId: $("editCodeId"),
        editCodeName: $("editCodeName"),
        autosaveStatus: $("autosaveStatus"),
        exportBtn: $("exportBtn"),
        exportExplanation: $("exportExplanation"),
        exportFormat: $("exportFormat"),
        exportModal: $("exportModal"),
        exportScope: $("exportScope"),
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
        themeGranularity: $("themeGranularity"),
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
        auditList: $("auditList"),
        auditSortBtn: $("auditSortBtn"),
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
          if (typeof localStorage === "undefined") return clone(defaults);
          const localApiKey = localStorage.getItem(API_KEY_STORE_KEY) || "";
          const raw = localStorage.getItem(STORE_KEY);
          if (!raw) {
            const empty = clone(defaults);
            empty.preferences.apiKey = localApiKey;
            return empty;
          }
          const parsed = JSON.parse(raw);
          if (parsed.tool === "Quala" && parsed.project) {
            const project = parsed.project;
            const preferences = { ...clone(defaults.preferences), ...(project.preferences || {}) };
            preferences.apiKey = localApiKey;
            migrateLegacyDefaultPrompts(preferences, project.preferences || {});
            const loaded = {
              ...clone(defaults),
              preferences,
              docs: normalizeLoadedDocs(project.docs || parsed.data || []),
              selectedDocId: project.selectedDocId || null,
              codebook: (parsed.codebook || []).map((code, index) => normalizeCode(code, index)),
              annotations: normalizeLoadedAnnotations(parsed.data || []),
              history: project.history || [],
              auditLog: parsed.audit_log || [],
              autosavedAt: parsed.exported_at || ""
            };
            if (!loaded.docs.some((doc) => doc.id === loaded.selectedDocId)) loaded.selectedDocId = loaded.docs[0]?.id || null;
            return loaded;
          }
          const preferences = { ...clone(defaults.preferences), ...(parsed.preferences || {}) };
          preferences.apiKey = localApiKey || preferences.apiKey;
          migrateLegacyDefaultPrompts(preferences, parsed.preferences || {});
          const loaded = {
            ...clone(defaults),
            ...parsed,
            preferences
          };
          loaded.codebook = (loaded.codebook || []).map((code, index) => normalizeCode(code, index));
          loaded.annotations = (loaded.annotations || []).map(normalizeAnnotationDoc);
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
        const loadedStatus = CODE_STATUSES.includes(code.status) ? code.status : "active";
        return {
          id: code.id || uid(),
          code_id: code.code_id || code.codeId || `C${String(index + 1).padStart(3, "0")}`,
          name,
          definition: String(code.definition || "").trim(),
          status: loadedStatus === "needs_human_review" || loadedStatus === "candidate" ? "active" : loadedStatus,
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
            id: quote.id,
            quote: quote.quote,
            certainty: quote.certainty,
            rationale: quote.rationale,
            code_ids: quote.code_ids || [],
            annotations: quote.annotations || []
          }))
        };
      }

      function saveState(message = "Auto-saved.") {
        const result = persistState();
        setStatus(result.ok ? message : result.message);
      }

      function persistState() {
        const autosavedAt = new Date().toISOString();
        const result = saveProjectToLocalStorage(autosavedAt);
        if (result.ok) state.autosavedAt = autosavedAt;
        try {
          localStorage.setItem(API_KEY_STORE_KEY, state.preferences.apiKey || "");
        } catch {
          result.ok = false;
          result.message = "Project saved, but the browser could not save the API key.";
        }
        autosaveWarning = result.warning || (!result.ok ? result.message : "");
        renderAutosaveStatus();
        return result;
      }

      function saveProjectToLocalStorage(autosavedAt) {
        const historyCounts = AUTOSAVE_HISTORY_COUNTS.filter((count) => count <= state.history.length);
        if (!historyCounts.includes(state.history.length)) historyCounts.unshift(state.history.length);
        let quotaError = null;
        for (const count of [...new Set(historyCounts)]) {
          try {
            const history = state.history.slice(Math.max(0, state.history.length - count));
            localStorage.setItem(STORE_KEY, JSON.stringify(exportPayload(autosavedAt, { history })));
            if (count === state.history.length) return { ok: true, warning: "" };
            const message =
              count > 0
                ? `Auto-save kept the latest ${count} history snapshots because browser storage is almost full.`
                : "Auto-save saved the current workspace without history because browser storage is almost full.";
            return { ok: true, warning: message };
          } catch (error) {
            if (!isStorageQuotaError(error)) {
              return { ok: false, message: "Auto-save failed. Export JSON to save this project.", warning: "" };
            }
            quotaError = error;
          }
        }
        if (quotaError) {
          return {
            ok: false,
            message: "Auto-save is too large for browser storage. Export JSON to save this project.",
            warning: ""
          };
        }
        return { ok: false, message: "Auto-save failed. Export JSON to save this project.", warning: "" };
      }

      function isStorageQuotaError(error) {
        return (
          error &&
          (error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            error.code === 22 ||
            error.code === 1014)
        );
      }

      function renderAutosaveStatus() {
        if (!els.autosaveStatus) return;
        if (autosaveWarning) {
          els.autosaveStatus.textContent = autosaveWarning;
          return;
        }
        if (!state.autosavedAt) {
          els.autosaveStatus.textContent = "Auto-save starting";
          return;
        }
        const saved = new Date(state.autosavedAt);
        els.autosaveStatus.textContent = `Auto-saved ${saved.toLocaleDateString()} ${saved.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        })}`;
      }

      function setStatus(message) {
        if (!els.statusLine) return;
        els.statusLine.textContent = message;
      }

      function log(message) {
        if (!els.activityLog) return;
        els.activityLog.textContent = message;
      }

      function setProcessing(active) {
        if (!els.processQueueBtn || !els.stopProcessBtn) return;
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
      let autosaveWarning = "";
      let auditDocFilter = "all";
      let auditSortDescending = true;
      let selectedAnnotationCodeId = "";

      function drawProgress(percent) {
        shownProgress = percent;
        if (!els.progressMascot) return;
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
        els.codingUnitSize.value = state.preferences.codingUnitSize || defaults.preferences.codingUnitSize;
        els.codeAbstraction.value = state.preferences.codeAbstraction || defaults.preferences.codeAbstraction;
        if (els.themeGranularity) {
          els.themeGranularity.value = THEME_GRANULARITY_OPTIONS[state.preferences.themeGranularity]
            ? state.preferences.themeGranularity
            : defaults.preferences.themeGranularity;
        }
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
        renderCodingBehaviorPanels();
        els.modelPill.textContent = state.preferences.model || "model";
      }

      function renderCodingBehaviorPanels() {
        renderCodingBehaviorDemo();
        renderCodingBehaviorPanel(els.codingUnitSizePanel, CODING_UNIT_OPTIONS, Number(els.codingUnitSize.value), "Expected excerpt length");
        renderCodingBehaviorPanel(
          els.codeAbstractionPanel,
          CODE_ABSTRACTION_OPTIONS,
          Number(els.codeAbstraction.value),
          "Level of interpretation"
        );
      }

      function renderCodingBehaviorPanel(panel, options, value, summaryLabel) {
        const item = options[value] || options[3];
        panel.innerHTML = `
          <div class="behaviorPanelTitle">${escapeHtml(item.label)}</div>
          <p>${escapeHtml(item.explanation)}</p>
          <p><strong>${escapeHtml(summaryLabel)}</strong>, ${escapeHtml(item.summary)}</p>
        `;
      }

      function renderCodingBehaviorDemo() {
        const unitValue = Number(els.codingUnitSize.value || defaults.preferences.codingUnitSize);
        const abstractionValue = Number(els.codeAbstraction.value || defaults.preferences.codeAbstraction);
        const unit = CODING_UNIT_OPTIONS[unitValue] || CODING_UNIT_OPTIONS[3];
        const abstraction = CODE_ABSTRACTION_OPTIONS[abstractionValue] || CODE_ABSTRACTION_OPTIONS[3];
        const excerpts = CODING_BEHAVIOR_DEMO.excerpts[unitValue] || CODING_BEHAVIOR_DEMO.excerpts[3];
        const codes = CODING_BEHAVIOR_DEMO.codes[abstractionValue] || CODING_BEHAVIOR_DEMO.codes[3];
        const sourceHtml = highlightedDemoSource(excerpts);
        const codeRows = excerpts
          .map(
            (excerpt, index) => `
              <div class="demoCodeRow">
                <div class="tiny muted">Excerpt ${index + 1}</div>
                <blockquote>${escapeHtml(excerpt)}</blockquote>
                <div><strong>Code</strong>, ${escapeHtml(codes[index] || codes[0])}</div>
              </div>
            `
          )
          .join("");
        els.codingBehaviorDemo.innerHTML = `
          <div class="demoText">
            <div class="behaviorPanelTitle">Example source text</div>
            ${sourceHtml}
          </div>
          <div class="demoCodes">
            <div class="behaviorPanelTitle">${escapeHtml(unit.label)} excerpts with ${escapeHtml(abstraction.label)} codes</div>
            <p class="muted small">Highlighted text shows the kind of nugget the app should usually code. It does not mean every possible nugget should be coded.</p>
            ${codeRows}
          </div>
        `;
      }

      function highlightedDemoSource(excerpts) {
        return CODING_BEHAVIOR_DEMO.paragraphs
          .map((paragraph) => `<p>${highlightDemoParagraph(paragraph, excerpts)}</p>`)
          .join("");
      }

      function highlightDemoParagraph(paragraph, excerpts) {
        let html = escapeHtml(paragraph);
        const sorted = [...excerpts].sort((a, b) => b.length - a.length);
        for (const excerpt of sorted) {
          for (const part of excerpt.split("\n\n")) {
            if (!part) continue;
            const safePart = escapeHtml(part);
            html = html.replace(safePart, `<mark>${safePart}</mark>`);
          }
        }
        return html;
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
              <span class="pill ${item.status === "coded" ? "ok" : "warn"}" title="${escapeHtml(tagTooltip("document_status", item.status || "queued"))}">${item.status || "queued"}</span>
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
        if (!state.codebook.length) {
          els.codebookRows.innerHTML = `<tr><td colspan="5" class="muted">No codes yet.</td></tr>`;
          return;
        }
        const visibleCodes = state.codebook
          .filter((item) => item.status !== "rejected")
          .map((code) => ({
            code,
            coverage: coverageForCode(code),
            example: bestQuoteForCode(code)
          }));
        sortCodebookRows(visibleCodes);
        for (const item of visibleCodes) {
          const { code, coverage, example } = item;
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>
              <button class="linkBtn" data-show-code-annotations="${escapeHtml(code.id)}">
                <strong>${escapeHtml(code.name)}</strong>
              </button>
              <div class="muted tiny">${escapeHtml(code.code_id)}</div>
              <span class="pill ${code.status === "active" ? "ok" : ""}" title="${escapeHtml(tagTooltip("code_status", code.status))}">${escapeHtml(code.status)}</span>
            </td>
            <td>${escapeHtml(code.definition || "")}</td>
            <td>
              <div class="quote small">${escapeHtml(example?.quote || "")}</div>
              ${example?.doc_id ? `<div class="muted tiny" style="margin-top: 4px">Datapoint ${escapeHtml(example.doc_id)}</div>` : ""}
            </td>
            <td>
              <span class="pill" title="${escapeHtml(tagTooltip("coverage", `${coverage.count}/${coverage.total}`))}">${coverage.percent}%</span>
              <span class="pill" title="${escapeHtml(tagTooltip("related_datapoints", coverage.docIds))}">${coverage.count}/${coverage.total}</span>
            </td>
            <td><button data-edit-code="${escapeHtml(code.id)}">Edit</button></td>
          `;
          els.codebookRows.appendChild(row);
        }
        els.codebookRows.querySelectorAll("[data-edit-code]").forEach((btn) => {
          btn.addEventListener("click", () => openCodeModal(btn.dataset.editCode));
        });
        els.codebookRows.querySelectorAll("[data-show-code-annotations]").forEach((btn) => {
          btn.addEventListener("click", () => showCodeAnnotations(btn.dataset.showCodeAnnotations));
        });
      }

      function sortCodebookRows(rows) {
        return rows.sort(
          (a, b) =>
            b.coverage.count - a.coverage.count ||
            String(a.code.name || a.code.code_id || "").localeCompare(String(b.code.name || b.code.code_id || ""))
        );
      }

      function renderAudit() {
        if (!els.auditList || !els.auditDocFilter) return;
        renderAuditControls();
        els.auditList.innerHTML = "";
        const entries = filteredAuditEntries();
        if (!entries.length) {
          els.auditList.innerHTML = `<div class="item muted small">No audit events yet.</div>`;
          return;
        }
        entries.forEach((entry) => {
            const div = document.createElement("div");
            div.className = "item";
            const actor = auditActor(entry);
            const stats = entry.stats || legacyAuditStats(entry);
            const statsHtml = Object.entries(stats)
              .map(([key, value]) => `<span class="pill" title="${escapeHtml(tagTooltip("audit_stat", key))}">${escapeHtml(humanizeKey(key))} ${escapeHtml(value)}</span>`)
              .join("");
            const detailPayload = {
              summary: entry.summary || entry.reason || "",
              stats,
              actor,
              input: entry.input || null,
              output: entry.output || null,
              details: entry.details || null
            };
            div.innerHTML = `
              <div class="itemTitle">
                <span>
                  ${escapeHtml(entry.title || humanizeKey(entry.event_type))}
                  <span class="auditActor ${escapeHtml(actor.type)}">${escapeHtml(actor.icon)} ${escapeHtml(actor.label)}</span>
                </span>
                <span class="pill" title="${escapeHtml(tagTooltip("datapoint", entry.doc_id || "system"))}">${escapeHtml(entry.doc_id || "system")}</span>
              </div>
              <div class="muted tiny">${escapeHtml(entry.timestamp)}</div>
              <p class="small" style="margin-top: 8px">${escapeHtml(entry.summary || entry.reason || "")}</p>
              <div class="row" style="margin-top: 8px">${statsHtml}</div>
              <details class="auditDetails">
                <summary>Show full details</summary>
                <pre>${escapeHtml(JSON.stringify(detailPayload, null, 2))}</pre>
              </details>
            `;
            els.auditList.appendChild(div);
          });
      }

      function auditActor(entry) {
        if (entry.actor?.label) return entry.actor;
        const actors = {
          document_scout: { id: "agent_1", label: "Agent 1 Scout", type: "agent", icon: "A1" },
          codebook_applier: { id: "agent_2", label: "Agent 2 Applier", type: "agent", icon: "A2" },
          novelty_detector: { id: "agent_3", label: "Agent 3 Novelty", type: "agent", icon: "A3" },
          merge_reviewer: { id: "agent_4", label: "Agent 4 Merge", type: "agent", icon: "A4" },
          evidence_auditor: { id: "exact_match_auditor", label: "Exact-match Auditor", type: "auditor", icon: "✓" },
          quotes_verified: { id: "exact_match_auditor", label: "Exact-match Auditor", type: "auditor", icon: "✓" },
          quote_verification_failed: { id: "exact_match_auditor", label: "Exact-match Auditor", type: "auditor", icon: "✓" },
          code_manual_edit: { id: "human", label: "Human", type: "human", icon: "H" },
          code_rejected: { id: "human", label: "Human", type: "human", icon: "H" }
        };
        return actors[entry.event_type] || { id: "quala_system", label: "Quala System", type: "system", icon: "Q" };
      }

      function renderAuditControls() {
        const docIds = ["all", ...state.docs.map((doc) => doc.id)];
        const auditOnlyDocIds = state.auditLog.map((entry) => entry.doc_id).filter(Boolean);
        for (const docId of auditOnlyDocIds) {
          if (!docIds.includes(docId)) docIds.push(docId);
        }
        if (!docIds.includes(auditDocFilter)) auditDocFilter = "all";
        els.auditDocFilter.innerHTML = "";
        for (const docId of docIds) {
          const option = document.createElement("option");
          option.value = docId;
          option.textContent = docId === "all" ? "All documents" : docId;
          option.selected = docId === auditDocFilter;
          els.auditDocFilter.appendChild(option);
        }
        els.auditSortBtn.textContent = auditSortDescending ? "Time sort descending" : "Time sort ascending";
      }

      function filteredAuditEntries() {
        return state.auditLog
          .filter((entry) => auditDocFilter === "all" || entry.doc_id === auditDocFilter)
          .slice()
          .sort((a, b) => {
            const aTime = Date.parse(a.timestamp || "") || 0;
            const bTime = Date.parse(b.timestamp || "") || 0;
            return auditSortDescending ? bTime - aTime : aTime - bTime;
          });
      }

      function legacyAuditStats(entry) {
        const stats = {};
        if (entry.code_id) stats.code_id = entry.code_id;
        if (entry.approved_by) stats.approved_by = entry.approved_by;
        return stats;
      }

      function humanizeKey(value) {
        return String(value || "")
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
      }

      function tagTooltip(type, value) {
        const codeStatuses = {
          active: "This code is available for annotation.",
          dormant: "This code stays in the codebook but currently has no recent verified use.",
          merged: "This code was combined with another code and is not applied separately.",
          rejected: "A human rejected or deleted this code.",
          candidate: "This code is proposed but has not completed review.",
          needs_human_review: "This code needs a human decision."
        };
        const documentStatuses = {
          queued: "This datapoint is waiting to be processed.",
          coded: "This datapoint completed the full coding workflow."
        };
        if (type === "code_status") return codeStatuses[value] || "Current codebook status.";
        if (type === "document_status") return documentStatuses[value] || "Current datapoint processing status.";
        if (type === "coverage") return `${value} loaded datapoints contain verified evidence for this code.`;
        if (type === "related_datapoints") {
          return value.length ? `Related datapoints: ${value.join(", ")}` : "No loaded datapoints contain verified evidence for this code.";
        }
        if (type === "certainty") return "Quala currently uses certainty 5 for exact verified code applications.";
        if (type === "code") return "Code assigned to this exact quote.";
        if (type === "datapoint") return value === "system" ? "This event applies to the project rather than one datapoint." : `This event belongs to datapoint ${value}.`;
        if (type === "count") return "Number of exact verified quotes saved for this datapoint.";
        if (type === "audit_stat") return `Audit statistic ${humanizeKey(value)}. Open full details for its inputs and outputs.`;
        return "More information about this tag.";
      }

      function renderAnnotations() {
        els.annotationList.innerHTML = "";
        const selectedCode = state.codebook.find((code) => code.id === selectedAnnotationCodeId);
        const docs = selectedCode ? annotationsForCode(selectedCode) : state.annotations;
        if (selectedCode) {
          const heading = document.createElement("div");
          heading.className = "item";
          heading.innerHTML = `
            <div class="itemTitle">
              <span>Examples for ${escapeHtml(selectedCode.name)}</span>
              <button data-clear-annotation-code>Show all annotations</button>
            </div>
            <div class="muted small">${docs.reduce((sum, doc) => sum + doc.quotes.length, 0)} exact quotes from ${docs.length} datapoints support this code.</div>
          `;
          els.annotationList.appendChild(heading);
          heading.querySelector("[data-clear-annotation-code]").addEventListener("click", () => {
            selectedAnnotationCodeId = "";
            renderAnnotations();
          });
        }
        if (!docs.length) {
          els.annotationList.innerHTML = `<div class="item muted small">No annotations yet.</div>`;
          if (selectedCode) {
            els.annotationList.innerHTML = `
              <div class="item">
                <div class="itemTitle">
                  <span>Examples for ${escapeHtml(selectedCode.name)}</span>
                  <button data-clear-annotation-code>Show all annotations</button>
                </div>
                <div class="muted small">No saved annotations support this code yet.</div>
              </div>
            `;
            els.annotationList.querySelector("[data-clear-annotation-code]").addEventListener("click", () => {
              selectedAnnotationCodeId = "";
              renderAnnotations();
            });
          }
          return;
        }
        for (const doc of docs) {
          const div = document.createElement("div");
          div.className = "item";
          const quotes = doc.quotes
            .map(
              (q) => `
                <div class="item" style="margin-top: 8px">
                  <div class="row">
                    ${(q.annotations || []).map((a) => `<span class="pill" title="${escapeHtml(tagTooltip("code", a))}">${escapeHtml(a)}</span>`).join("")}
                    <span class="pill" title="${escapeHtml(tagTooltip("certainty"))}">certainty ${Number(q.certainty || 0)}</span>
                  </div>
                  <div class="quote small" style="margin-top: 8px">${escapeHtml(q.quote)}</div>
                  <p class="muted small" style="margin-top: 8px">${escapeHtml(q.rationale || "")}</p>
                </div>`
            )
            .join("");
          div.innerHTML = `
            <div class="itemTitle">
              <span>${escapeHtml(doc.id)}</span>
              <span class="pill" title="${escapeHtml(tagTooltip("count"))}">${doc.quotes.length} quotes</span>
            </div>
            <div class="muted small">${escapeHtml(doc.source || "")}</div>
            ${quotes || `<p class="muted small" style="margin-top: 8px">No matching quotes.</p>`}
          `;
          els.annotationList.appendChild(div);
        }
      }

      function annotationsForCode(code) {
        return state.annotations
          .map((doc) => ({
            ...doc,
            quotes: (doc.quotes || []).filter((quote) => quoteMatchesCode(quote, code))
          }))
          .filter((doc) => doc.quotes.length);
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
        if (!hasDom) return state.preferences;
        state.preferences.apiKey = els.apiKey.value.trim();
        state.preferences.model = els.modelSelect.value || els.modelSelect.options[0]?.value || state.preferences.model;
        state.preferences.temperature = Number(els.temperature.value || 0.2);
        state.preferences.verbosity = els.verbosity.value;
        state.preferences.reasoning = els.reasoning.value;
        state.preferences.maxQuotes = Number(els.maxQuotes.value || 12);
        state.preferences.codingUnitSize = Number(els.codingUnitSize.value || defaults.preferences.codingUnitSize);
        state.preferences.codeAbstraction = Number(els.codeAbstraction.value || defaults.preferences.codeAbstraction);
        if (els.themeGranularity) {
          state.preferences.themeGranularity = THEME_GRANULARITY_OPTIONS[els.themeGranularity.value]
            ? els.themeGranularity.value
            : defaults.preferences.themeGranularity;
        }
        state.preferences.lens = els.lens.value.trim();
        state.preferences.codebookPrompt = els.codebookPrompt.value.trim();
        state.preferences.refinePrompt = els.refinePrompt.value.trim();
        state.preferences.mergePrompt = els.mergePrompt.value.trim();
        state.preferences.annotationPrompt = els.annotationPrompt.value.trim();
        return state.preferences;
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
        state.auditLog = clone(entry.auditLog || []);
        render();
        saveState("Snapshot restored.");
      }

      function computeCoverage() {
        const coverage = {};
        for (const code of state.codebook) {
          const details = coverageForCode(code);
          coverage[code.code_id] = details.percent;
          coverage[code.name] = details.percent;
        }
        return coverage;
      }

      function coverageForCode(code, docs = state.docs, annotations = state.annotations) {
        const docIds = new Set();
        const knownDocIds = new Set(docs.map((doc) => doc.id));
        const addDocId = (docId) => {
          if (!docId || (knownDocIds.size && !knownDocIds.has(docId))) return;
          docIds.add(docId);
        };
        for (const example of code.example_quotes || []) {
          const docId = example.doc_id || code.created_from_doc;
          if (example.verified !== false) addDocId(docId);
        }
        for (const docAnn of annotations) {
          for (const quote of docAnn.quotes || []) {
            if (quoteMatchesCode(quote, code)) addDocId(docAnn.id);
          }
        }
        const total = Math.max(1, docs.length);
        return {
          count: docIds.size,
          total,
          percent: Math.round((docIds.size / total) * 100),
          docIds: Array.from(docIds).sort((a, b) => a.localeCompare(b))
        };
      }

      function sortedCodesByPrevalence(codebook, docs = state.docs, annotations = state.annotations) {
        return [...(codebook || [])].sort((a, b) => {
          const aCoverage = coverageForCode(a, docs, annotations);
          const bCoverage = coverageForCode(b, docs, annotations);
          return (
            bCoverage.count - aCoverage.count ||
            String(a.name || a.code_id || "").localeCompare(String(b.name || b.code_id || ""))
          );
        });
      }

      function exampleDatapointsForCode(code, docs = state.docs, annotations = state.annotations) {
        const docsById = new Map((docs || []).map((doc) => [String(doc.id), doc]));
        const annotationsById = new Map((annotations || []).map((doc) => [String(doc.id), doc]));
        const docIds = new Set(coverageForCode(code, docs, annotations).docIds.map(String));
        for (const example of code.example_quotes || []) {
          const docId = example.doc_id || code.created_from_doc;
          if (docId && example.verified !== false) docIds.add(String(docId));
        }
        return Array.from(docIds)
          .sort((a, b) => a.localeCompare(b))
          .map((docId) => {
            const sourceDoc = docsById.get(docId) || {};
            const annotationDoc = annotationsById.get(docId) || {};
            const quoteRows = [];
            for (const quote of annotationDoc.quotes || []) {
              if (quoteMatchesCode(quote, code)) {
                quoteRows.push({
                  id: quote.id,
                  quote: quote.quote,
                  code_ids: quote.code_ids || [],
                  annotations: quote.annotations || [],
                  certainty: quote.certainty,
                  rationale: quote.rationale
                });
              }
            }
            for (const example of code.example_quotes || []) {
              const exampleDocId = String(example.doc_id || code.created_from_doc || "");
              if (example.verified === false || exampleDocId !== docId || !example.quote) continue;
              if (quoteRows.some((quote) => quote.quote === example.quote)) continue;
              quoteRows.push({
                id: "",
                quote: example.quote,
                code_ids: code.code_id ? [code.code_id] : [],
                annotations: code.name ? [code.name] : [],
                certainty: "",
                rationale: "Codebook example quote."
              });
            }
            return {
              id: docId,
              source: sourceDoc.source || annotationDoc.source || "",
              text: sourceDoc.text || annotationDoc.text || "",
              status: sourceDoc.status || "",
              annotation: annotationDoc.annotation || [],
              quotes: quoteRows
            };
          });
      }

      function bestQuoteForCode(code, annotations = state.annotations) {
        const candidates = (code.example_quotes || [])
          .filter((example) => example.verified !== false && example.quote)
          .map((example) => ({
            quote: example.quote,
            doc_id: example.doc_id || code.created_from_doc || ""
          }));
        for (const docAnn of annotations) {
          for (const quote of docAnn.quotes || []) {
            if (!quote.quote || !quoteMatchesCode(quote, code)) continue;
            candidates.push({ quote: quote.quote, doc_id: docAnn.id });
          }
        }
        return candidates.sort((a, b) => b.quote.trim().length - a.quote.trim().length)[0] || null;
      }

      function quoteMatchesCode(quote, code) {
        return (quote.code_ids || []).includes(code.code_id) || (quote.annotations || []).includes(code.name);
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
          auditLog: payload.audit_log || project.auditLog || payload.auditLog || [],
          autosavedAt: payload.exported_at || project.autosavedAt || ""
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
        if (entry.compression !== 8) {
          throw new Error("This DOCX file uses an unsupported ZIP compression method.");
        }
        if (typeof require === "function") {
          const zlib = require("zlib");
          return new Uint8Array(zlib.inflateRawSync(Buffer.from(compressed)));
        }
        if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress this DOCX file.");
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }

      function xmlEntityDecode(value) {
        return String(value)
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&quot;", '"')
          .replaceAll("&apos;", "'")
          .replaceAll("&amp;", "&");
      }

      function textFromDocumentXml(xml) {
        const paragraphs = String(xml).match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
        const blocks = paragraphs.length ? paragraphs : [String(xml)];
        return blocks
          .map((paragraph) => {
            const parts = [];
            const tokenPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>/g;
            let match;
            while ((match = tokenPattern.exec(paragraph))) {
              if (match[1] !== undefined) parts.push(xmlEntityDecode(match[1]));
              else if (match[0].startsWith("<w:tab")) parts.push("\t");
              else parts.push("\n");
            }
            return parts.join("");
          })
          .join("\n");
      }

      async function readDocxBytes(bytes) {
        const xmlBytes = await readZipEntry(bytes, "word/document.xml");
        const xml = new TextDecoder().decode(xmlBytes);
        return textFromDocumentXml(xml);
      }

      async function readDocx(file) {
        return readDocxBytes(new Uint8Array(await file.arrayBuffer()));
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
                    decision: { type: "string", enum: ["new_code", "already_covered", "possible_merge"] },
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
                    recommendation: { type: "string", enum: ["merge", "keep_separate"] },
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

      function refinementSchema() {
        return {
          name: "quala_code_refinement",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              mode: { type: "string", enum: ["merge", "split"] },
              summary: { type: "string" },
              replacement_codes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    temporary_id: { type: "string" },
                    name: { type: "string" },
                    definition: { type: "string" },
                    source_code_ids: { type: "array", items: { type: "string" } },
                    assignments: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          doc_id: { type: "string" },
                          quote: { type: "string" },
                          reason: { type: "string" }
                        },
                        required: ["doc_id", "quote", "reason"]
                      }
                    }
                  },
                  required: ["temporary_id", "name", "definition", "source_code_ids", "assignments"]
                }
              }
            },
            required: ["mode", "summary", "replacement_codes"]
          },
          strict: true
        };
      }

      function codebookForModel() {
        return sortedCodesByPrevalence(state.codebook)
          .filter((code) => code.status === "active" || code.status === "dormant")
          .map((code) => ({
            code_id: code.code_id,
            name: code.name,
            definition: code.definition,
            status: code.status
          }));
      }

      function currentCodebookForModel() {
        return sortedCodesByPrevalence(state.codebook)
          .filter((code) => code.status !== "rejected" && code.status !== "merged")
          .map((code) => ({
            code_id: code.code_id,
            name: code.name,
            definition: code.definition,
            status: code.status
          }));
      }

      function getCodingBehaviorPrompt(codingUnitSize, codeAbstraction) {
        const unit = CODING_UNIT_OPTIONS[Number(codingUnitSize)] || CODING_UNIT_OPTIONS[3];
        const abstraction = CODE_ABSTRACTION_OPTIONS[Number(codeAbstraction)] || CODE_ABSTRACTION_OPTIONS[3];
        return [
          "Coding behavior instructions",
          "",
          `Coding unit size, ${unit.label}`,
          unit.prompt,
          "",
          `Code abstraction, ${abstraction.label}`,
          abstraction.prompt,
          "",
          "Guardrails",
          "- Do not code every sentence unless the coding unit size setting asks for sentence-level coding.",
          "- Do not treat the whole document as one code.",
          "- Every code must be grounded in a specific excerpt.",
          "- Do not invent themes that are not supported by the text.",
          "- If two nearby excerpts express the same idea, merge or separate them based on the selected coding unit size.",
          "- The code label must follow the selected abstraction level.",
          "- The excerpt length must follow the selected coding unit size.",
          "- Prefer consistency across the whole document."
        ].join("\n");
      }

      function themeGranularityOption(value) {
        return THEME_GRANULARITY_OPTIONS[value] || THEME_GRANULARITY_OPTIONS[defaults.preferences.themeGranularity];
      }

      function getThemeGranularityPrompt(value) {
        const option = themeGranularityOption(value);
        return [
          `Theme granularity, ${option.label}`,
          option.prompt,
          "Use this setting when deciding whether a candidate theme should become a new code, be marked already covered, or be reviewed for merging.",
          "Use this setting when deciding whether low-count themes should stay separate or be merged into clearer existing themes."
        ].join("\n");
      }

      function buildScoutPrompt(doc) {
        const codingBehavior = getCodingBehaviorPrompt(state.preferences.codingUnitSize, state.preferences.codeAbstraction);
        const themeGranularity = getThemeGranularityPrompt(state.preferences.themeGranularity);
        return [
          {
            role: "system",
            content:
              "You are Agent 1, Document scout. Return only JSON that matches the schema. You must not use or ask for the current codebook. Choose rich supporting quotes that can be understood without guessing the missing context. Include the interviewer question in the same quote when the response depends on that question for meaning. Include enough surrounding turns to preserve the participant's meaning, reasoning, and relevant details. Prefer complete thought units over short fragments, but do not include unrelated transcript. Every supporting quote must be copied exactly from document_text as one contiguous substring. Do not alter spelling, punctuation, capitalization, spacing, or wording."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                doc_id: doc.id,
                study_lens: state.preferences.lens,
                scout_instruction: state.preferences.codebookPrompt,
                coding_behavior_instruction: codingBehavior,
                theme_granularity_instruction: themeGranularity,
                document_text: doc.text
              },
              null,
              2
            )
          }
        ];
      }

      function buildApplierPrompt(doc) {
        const codingBehavior = getCodingBehaviorPrompt(state.preferences.codingUnitSize, state.preferences.codeAbstraction);
        const themeGranularity = getThemeGranularityPrompt(state.preferences.themeGranularity);
        return [
          {
            role: "system",
            content:
              "You are Agent 2, Codebook applier. Return only JSON that matches the schema. You cannot create codes. Choose rich quotes that can be understood without guessing the missing context. Include the interviewer question in the same quote when the response depends on that question for meaning. Include enough surrounding turns to preserve the participant's meaning, reasoning, and relevant details. Prefer complete thought units over short fragments, but do not include unrelated transcript. Every quote must be copied exactly from document_text as one contiguous substring. Do not alter spelling, punctuation, capitalization, spacing, or wording. If a code has no quote, put its code_id in codes_with_no_instance."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                doc_id: doc.id,
                document_text: doc.text,
                codebook: codebookForModel(),
                annotation_instruction: state.preferences.annotationPrompt,
                coding_behavior_instruction: codingBehavior,
                theme_granularity_instruction: themeGranularity,
                max_quotes_per_code: state.preferences.maxQuotes,
                required_behavior: [
                  "Apply only listed code_id values.",
                  "Return exact verbatim quotes only.",
                  "Each quote must pass document_text.includes(quote).",
                  "Do not paraphrase, clean up, shorten by rewriting, merge separate passages, or add ellipses.",
                  "Choose a rich passage that preserves the participant's meaning, reasoning, and relevant details.",
                  "Include the interviewer question when the response would have little meaning without it.",
                  "Keep the question, response, and useful surrounding context in one contiguous quote.",
                  "Prefer complete thought units over short fragments, but exclude unrelated transcript.",
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
        const themeGranularity = getThemeGranularityPrompt(state.preferences.themeGranularity);
        return [
          {
            role: "system",
            content:
              "You are Agent 3, Novelty detector. Return only JSON that matches the schema. Compare scout findings with the current codebook. Use already_covered only when matched_code_id is an exact code_id from current_codebook. If current_codebook is empty, every verified scout finding must be new_code. Do not create active codes. Evidence quotes must come from the verified scout quotes without changes."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                doc_id: doc.id,
                novelty_instruction: state.preferences.refinePrompt,
                theme_granularity_instruction: themeGranularity,
                scout_codes: scoutOutput.scout_codes || [],
                current_codebook: currentCodebookForModel(),
                allowed_decisions: ["new_code", "already_covered", "possible_merge"]
              },
              null,
              2
            )
          }
        ];
      }

      function buildMergePrompt(noveltyOutput) {
        const candidates = (noveltyOutput.novelty_decisions || []).filter((item) =>
          ["new_code", "possible_merge"].includes(item.decision)
        );
        const themeGranularity = getThemeGranularityPrompt(state.preferences.themeGranularity);
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
                theme_granularity_instruction: themeGranularity,
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

      function selectedCodesForRefinement(codeIds) {
        const selected = new Set(codeIds || []);
        return state.codebook.filter((code) => selected.has(code.code_id));
      }

      function collectCodeEvidenceForRefinement(selectedCodes) {
        const selectedIds = new Set(selectedCodes.map((code) => code.code_id));
        const selectedNames = new Set(selectedCodes.map((code) => code.name));
        const docsById = new Map(state.docs.map((doc) => [doc.id, doc]));
        const evidenceByKey = new Map();
        for (const annotation of state.annotations || []) {
          const sourceDoc = docsById.get(annotation.id);
          if (!sourceDoc) continue;
          for (const quote of annotation.quotes || []) {
            const quoteCodeIds = quote.code_ids || [];
            const quoteNames = quote.annotations || [];
            const matchingCodes = selectedCodes.filter(
              (code) => quoteCodeIds.includes(code.code_id) || quoteNames.includes(code.name)
            );
            if (!matchingCodes.length) continue;
            const key = `${annotation.id}\n${quote.quote}`;
            evidenceByKey.set(key, {
              doc_id: annotation.id,
              source: sourceDoc.source || annotation.source || "",
              document_text: sourceDoc.text || annotation.text || "",
              quote: quote.quote,
              current_code_ids: matchingCodes.map((code) => code.code_id),
              current_code_names: matchingCodes.map((code) => code.name),
              rationale: quote.rationale || ""
            });
          }
        }
        for (const code of selectedCodes) {
          for (const example of code.example_quotes || []) {
            if (example.verified === false || !example.quote) continue;
            const docId = example.doc_id || code.created_from_doc || "";
            const sourceDoc = docsById.get(docId);
            if (!sourceDoc) continue;
            const key = `${docId}\n${example.quote}`;
            if (evidenceByKey.has(key)) continue;
            evidenceByKey.set(key, {
              doc_id: docId,
              source: sourceDoc.source || "",
              document_text: sourceDoc.text || "",
              quote: example.quote,
              current_code_ids: selectedIds.has(code.code_id) ? [code.code_id] : [],
              current_code_names: selectedNames.has(code.name) ? [code.name] : [],
              rationale: ""
            });
          }
        }
        return Array.from(evidenceByKey.values());
      }

      function buildRefinementPrompt(request, selectedCodes, evidence) {
        const mode = request.mode === "split" ? "split" : "merge";
        const selectedCodebook = selectedCodes.map((code) => ({
          code_id: code.code_id,
          name: code.name,
          definition: code.definition,
          status: code.status
        }));
        const task =
          mode === "split"
            ? "Split one broad selected code into smaller active replacement codes. The new codes must stay inside the meaning of the original selected code."
            : "Merge or consolidate the selected codes into a smaller, cleaner set of active replacement codes. You may return one replacement code or a few replacement codes when the evidence has meaningful subgroups.";
        return [
          {
            role: "system",
            content:
              "You are a code refinement agent for qualitative coding. Return only JSON that matches the schema. Use only the selected evidence. Every assignment quote must be copied exactly from one selected document_text value. Do not invent evidence. Do not keep weak one-example codes unless the evidence is genuinely distinct."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                mode,
                task,
                user_lens: request.lens || "",
                selected_codes: selectedCodebook,
                selected_evidence: evidence.map((item) => ({
                  doc_id: item.doc_id,
                  source: item.source,
                  document_text: item.document_text,
                  quote: item.quote,
                  current_code_ids: item.current_code_ids,
                  current_code_names: item.current_code_names,
                  rationale: item.rationale
                })),
                rules: [
                  "Return replacement_codes that should replace the selected codes.",
                  "Each replacement code needs a clear name and definition.",
                  "Each assignment quote must be an exact contiguous substring of the matching document_text.",
                  "For split, make smaller codes that remain aligned with the parent selected code.",
                  "For merge, use the user_lens as the reason these codes belong together.",
                  "It is acceptable to return two or three replacement codes instead of forcing one broad code.",
                  "Avoid tiny codes supported by only one quote unless that quote is clearly a separate concept."
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

      function buildModelRequest(input, schema, preferences) {
        const capabilities = modelCapabilities(preferences.model);
        const body = {
          model: preferences.model,
          input,
          text: {
            format: { type: "json_schema", ...schema }
          }
        };
        if (capabilities.temperature) {
          body.temperature = preferences.temperature;
        }
        if (capabilities.verbosity) {
          body.text.verbosity = preferences.verbosity;
        }
        if (capabilities.reasoning && preferences.reasoning) {
          body.reasoning = { effort: preferences.reasoning };
        }
        return body;
      }

      function createQualaApi(options = {}) {
        const baseUrl = String(options.baseUrl || OPENAI_API_BASE_URL).replace(/\/$/, "");
        const fetchImpl = options.fetch || (typeof fetch !== "undefined" ? fetch : null);
        const timeoutMs = options.timeoutMs || 120000;

        async function request(path, requestOptions = {}, signal) {
          if (!fetchImpl) throw new Error("No fetch implementation is available for API requests.");
          return fetchWithTimeout(`${baseUrl}${path}`, requestOptions, signal, fetchImpl, timeoutMs);
        }

        return {
          async createStructuredResponse({ input, schema, preferences, signal }) {
            if (!preferences?.apiKey) throw new Error("Add an OpenAI API key in Preferences.");
            const response = await request(
              "/responses",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${preferences.apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(buildModelRequest(input, schema, preferences))
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
          },

          async listModels({ apiKey, signal } = {}) {
            if (!apiKey) throw new Error("Add an API key first.");
            const response = await request(
              "/models",
              {
                headers: { Authorization: `Bearer ${apiKey}` }
              },
              signal
            );
            if (!response.ok) throw new Error(`Could not load models ${response.status}.`);
            const data = await response.json();
            return (data.data || [])
              .map((model) => model.id)
              .filter((id) => /gpt|o\d|chatgpt/i.test(id))
              .sort();
          }
        };
      }

      let qualaApi = createQualaApi();
      let auditListener = null;

      function setQualaApi(api) {
        qualaApi = api ? { ...createQualaApi(), ...api } : createQualaApi();
        return qualaApi;
      }

      async function callModel(input, schema, signal) {
        if (hasDom) readPreferences();
        return qualaApi.createStructuredResponse({
          input,
          schema,
          preferences: state.preferences,
          signal
        });
      }

      async function fetchWithTimeout(url, options, signal, fetchImpl = fetch, timeoutMs = 120000) {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
        const abortRequest = () => timeoutController.abort();
        const canListenForAbort =
          signal &&
          typeof signal.addEventListener === "function" &&
          typeof signal.removeEventListener === "function";
        if (signal?.aborted) timeoutController.abort();
        else if (canListenForAbort) {
          signal.addEventListener("abort", abortRequest, { once: true });
        }
        try {
          return await fetchImpl(url, { ...options, signal: timeoutController.signal });
        } catch (error) {
          if (timeoutController.signal.aborted) {
            throw new Error(signal?.aborted ? "Processing stopped." : "OpenAI request timed out after 2 minutes.");
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
          if (canListenForAbort) signal.removeEventListener("abort", abortRequest);
        }
      }

      async function callOpenAI(input, schema, signal) {
        return callModel(input, schema, signal);
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
          await QualaBackend.processQueue({ signal, docs, afterEach: render });
          createSnapshot("After processing queue");
          setProgress(100);
          setStatus("Queue processed.");
          log("Queue processed. Review the codebook and edit or delete codes if needed.");
          render();
        } finally {
          activeRun = null;
          setProcessing(false);
        }
      }

      async function processQualaQueue(options = {}) {
        const docs = options.docs || state.docs.filter((doc) => doc.status !== "coded");
        const signal = options.signal || null;
        if (options.onProgress) {
          options.onProgress({ processed: 0, total: docs.length, percent: docs.length ? 0 : 100, doc: null });
        }
        for (let index = 0; index < docs.length; index += 1) {
          ensureProcessingActive(signal);
          state.selectedDocId = docs[index].id;
          await processDoc(docs[index], signal, index, docs.length);
          if (options.onProgress) {
            options.onProgress({
              processed: index + 1,
              total: docs.length,
              percent: Math.round(((index + 1) / Math.max(1, docs.length)) * 100),
              doc: docs[index]
            });
          }
          if (options.afterEach) options.afterEach({ doc: docs[index], index, total: docs.length });
        }
        return { processed: docs.length };
      }

      async function runQualaBackend(payload, options = {}) {
        const previousState = state;
        const previousApi = qualaApi;
        const previousAuditListener = auditListener;
        if (options.api) setQualaApi(options.api);
        else if (options.fetch || options.baseUrl || options.timeoutMs) setQualaApi(createQualaApi(options));
        auditListener = typeof options.onAudit === "function" ? options.onAudit : null;
        const apiState = projectStateFromApiPayload(payload || {}, options);
        state = apiState;
        try {
          await processQualaQueue({ signal: options.signal, onProgress: options.onProgress });
          return exportPayload(options.exportedAt || new Date().toISOString());
        } finally {
          state = previousState;
          qualaApi = previousApi;
          auditListener = previousAuditListener;
        }
      }

      async function runCodeRefinement(payload, request = {}, options = {}) {
        const previousState = state;
        const previousApi = qualaApi;
        const previousAuditListener = auditListener;
        if (options.api) setQualaApi(options.api);
        else if (options.fetch || options.baseUrl || options.timeoutMs) setQualaApi(createQualaApi(options));
        auditListener = typeof options.onAudit === "function" ? options.onAudit : null;
        state = projectStateFromApiPayload(payload || {}, options);
        try {
          const initialAuditLength = state.auditLog.length;
          ensureProcessingActive(options.signal);
          const mode = request.mode === "split" ? "split" : "merge";
          const selectedCodeIds = Array.from(new Set(request.code_ids || request.selected_code_ids || []));
          const selectedCodes = selectedCodesForRefinement(selectedCodeIds);
          const minimumCodes = mode === "split" ? 1 : 2;
          if (selectedCodes.length < minimumCodes) {
            throw new Error(mode === "split" ? "Select one code to split." : "Select at least two codes to merge.");
          }
          const evidence = collectCodeEvidenceForRefinement(selectedCodes);
          if (!evidence.length) {
            throw new Error("No verified datapoints or quotes were found for the selected codes.");
          }
          addAuditLog({
            doc_id: "",
            event_type: "refinement_evidence",
            title: "Refinement evidence",
            summary: `${evidence.length} quotes collected for ${mode}.`,
            stats: {
              selected_codes: selectedCodes.length,
              evidence_quotes: evidence.length,
              datapoints: Array.from(new Set(evidence.map((item) => item.doc_id))).length
            },
            input: { request, selected_codes: selectedCodes.map((code) => ({ code_id: code.code_id, name: code.name })) },
            output: { evidence }
          });
          if (options.onProgress) options.onProgress({ processed: 0, total: 3, percent: 15, doc: null });
          const prompt = buildRefinementPrompt({ ...request, mode }, selectedCodes, evidence);
          const rawProposal = await callOpenAI(prompt, refinementSchema(), options.signal);
          ensureProcessingActive(options.signal);
          addAuditLog({
            doc_id: "",
            event_type: "refinement_proposal",
            title: mode === "split" ? "Split proposal" : "Merge proposal",
            summary: `${(rawProposal.replacement_codes || []).length} replacement codes proposed.`,
            stats: { replacement_codes: (rawProposal.replacement_codes || []).length },
            input: { prompt },
            output: rawProposal
          });
          if (options.onProgress) options.onProgress({ processed: 1, total: 3, percent: 55, doc: null });
          const auditedProposal = auditRefinementProposal(rawProposal, selectedCodes);
          addAuditLog({
            doc_id: "",
            event_type: "refinement_auditor",
            title: "Refinement exact-match auditor",
            summary: `${auditedProposal.stats.accepted_assignments} assignments accepted. ${auditedProposal.stats.rejected_assignments} assignments rejected.`,
            stats: auditedProposal.stats,
            input: { proposal: rawProposal },
            output: auditedProposal.audit
          });
          if (options.onProgress) options.onProgress({ processed: 3, total: 3, percent: 100, doc: null });
          return {
            mode,
            lens: request.lens || "",
            selected_codes: selectedCodes.map((code) => ({
              code_id: code.code_id,
              name: code.name,
              definition: code.definition
            })),
            proposal: auditedProposal.proposal,
            audit_log: state.auditLog.slice(initialAuditLength)
          };
        } finally {
          state = previousState;
          qualaApi = previousApi;
          auditListener = previousAuditListener;
        }
      }

      function projectStateFromApiPayload(payload, options = {}) {
        const currentPreferences = clone(defaults.preferences);
        const project = payload.project || payload;
        const projectPreferences = project.preferences || payload.preferences || {};
        const preferences = {
          ...currentPreferences,
          ...projectPreferences,
          apiKey: options.apiKey || payload.apiKey || projectPreferences.apiKey || environmentApiKey() || ""
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
          auditLog: payload.audit_log || project.auditLog || payload.auditLog || [],
          autosavedAt: payload.exported_at || project.autosavedAt || ""
        };
        if (!loaded.docs.some((doc) => doc.id === loaded.selectedDocId)) {
          loaded.selectedDocId = loaded.docs[0]?.id || null;
        }
        return loaded;
      }

      function environmentApiKey() {
        if (typeof process === "undefined" || !process.env) return "";
        return process.env.OPENAI_API_KEY || "";
      }

      async function processDoc(doc, signal, index, total) {
        const baseProgress = Math.round((index / Math.max(1, total)) * 100);
        const span = Math.round(100 / Math.max(1, total));
        const stepProgress = (value) => setProgress(baseProgress + Math.round((value / 100) * span));
        stepProgress(8);
        setStatus(`Processing ${index + 1} of ${total}. ${doc.id}.`);
        log("Running document scout.");
        const scoutPrompt = buildScoutPrompt(doc);
        const scoutOutput = await callOpenAI(scoutPrompt, scoutSchema(), signal);
        addAuditLog({
          doc_id: doc.id,
          event_type: "document_scout",
          title: "Document scout",
          summary: summarizeScoutOutput(scoutOutput),
          stats: scoutStats(scoutOutput),
          input: { prompt: scoutPrompt },
          output: scoutOutput
        });
        ensureProcessingActive(signal);
        stepProgress(28);
        const scoutQuotes = collectQuotes(scoutOutput, { applied_codes: [] });
        const scoutVerification = evidenceAuditor(doc.text, scoutQuotes);
        const verifiedScout = removeFailedScoutQuotes(scoutOutput, scoutVerification);
        log("Running novelty detector.");
        const noveltyPrompt = buildNoveltyPrompt(doc, verifiedScout);
        const noveltyOutput = await callOpenAI(noveltyPrompt, noveltySchema(), signal);
        ensureProcessingActive(signal);
        const verifiedNovelty = removeFailedNoveltyQuotes(noveltyOutput, scoutVerification, verifiedScout);
        addAuditLog({
          doc_id: doc.id,
          event_type: "novelty_detector",
          title: "Novelty detector",
          summary: summarizeNoveltyOutput(verifiedNovelty),
          stats: noveltyStats(verifiedNovelty),
          input: {
            prompt: noveltyPrompt,
            scout_output: verifiedScout,
            current_codebook: currentCodebookForModel()
          },
          output: verifiedNovelty
        });
        stepProgress(46);
        const needsMergeReview = (verifiedNovelty.novelty_decisions || []).some((item) =>
          ["new_code", "possible_merge"].includes(item.decision)
        );
        log(needsMergeReview ? "Running merge reviewer." : "No merge review needed.");
        const mergePrompt = needsMergeReview ? buildMergePrompt(verifiedNovelty) : null;
        const mergeOutput = needsMergeReview ? await callOpenAI(mergePrompt, mergeSchema(), signal) : { merge_review: [] };
        ensureProcessingActive(signal);
        addAuditLog({
          doc_id: doc.id,
          event_type: "merge_reviewer",
          title: "Merge reviewer",
          summary: needsMergeReview ? summarizeMergeOutput(mergeOutput) : "Skipped because there were no new or similar code decisions.",
          stats: mergeStats(mergeOutput),
          input: needsMergeReview ? { prompt: mergePrompt } : { reason: "No new or possible merge decisions." },
          output: mergeOutput
        });
        const updatePacket = applyCodebookUpdates(doc, verifiedNovelty, mergeOutput, scoutVerification);
        addAuditLog({
          doc_id: doc.id,
          event_type: "codebook_update",
          title: "Codebook update",
          summary: `${updatePacket.active_codes_added.length} active codes added. ${updatePacket.merged_codes.length} merge updates applied.`,
          stats: codebookUpdateStats(updatePacket),
          input: {
            novelty_output: verifiedNovelty,
            merge_output: mergeOutput
          },
          output: updatePacket
        });
        stepProgress(68);
        const hasCodebook = codebookForModel().length > 0;
        log(hasCodebook ? "Running codebook applier." : "No active codebook yet. Skipping codebook applier.");
        const applierPrompt = hasCodebook ? buildApplierPrompt(doc) : null;
        const applierOutput = hasCodebook
          ? await callOpenAI(applierPrompt, applierSchema(), signal)
          : { doc_id: doc.id, applied_codes: [], codes_with_no_instance: [] };
        addAuditLog({
          doc_id: doc.id,
          event_type: "codebook_applier",
          title: "Codebook applier",
          summary: hasCodebook ? summarizeApplierOutput(applierOutput) : "Skipped because there were no active codebook entries.",
          stats: applierStats(applierOutput, codebookForModel().length),
          input: hasCodebook ? { prompt: applierPrompt } : { reason: "No active codebook entries." },
          output: applierOutput
        });
        ensureProcessingActive(signal);
        stepProgress(84);
        log("Checking exact quotes.");
        const allQuotes = collectQuotes(scoutOutput, applierOutput);
        const verification = evidenceAuditor(doc.text, allQuotes);
        const verifiedApplier = removeFailedApplierQuotes(applierOutput, verification);
        addAuditLog({
          doc_id: doc.id,
          event_type: "evidence_auditor",
          title: "Evidence auditor",
          summary: `${verification.verified_quotes.length} quotes accepted. ${verification.failed_quotes.length} quotes rejected.`,
          stats: evidenceStats(allQuotes, verification),
          input: { quotes: allQuotes },
          output: verification
        });
        applyAnnotationResult(doc, verifiedApplier);
        updateDormantStatuses();
        doc.status = "coded";
        addAuditLog({
          doc_id: doc.id,
          event_type: "document_processed",
          title: "Document complete",
          summary: "Processing loop completed for this document.",
          reason: "Scout, novelty detector, merge reviewer, codebook update, applier, and evidence auditor completed."
        });
        stepProgress(100);
        log(`Processed ${doc.id}.`);
      }

      function ensureProcessingActive(signal) {
        if (signal?.aborted) throw new Error("Processing stopped.");
      }

      function scoutStats(output) {
        const codes = output.scout_codes || [];
        return {
          concepts_found: codes.length,
          supporting_quotes: codes.reduce((sum, code) => sum + (code.supporting_quotes || []).length, 0),
          high_confidence: codes.filter((code) => code.confidence === "high").length
        };
      }

      function summarizeScoutOutput(output) {
        const stats = scoutStats(output);
        return `${stats.concepts_found} possible concepts found with ${stats.supporting_quotes} supporting quotes.`;
      }

      function applierStats(output, activeCodeCount) {
        const applied = output.applied_codes || [];
        return {
          active_codes_checked: activeCodeCount,
          codes_with_instances: applied.length,
          quote_instances: applied.reduce((sum, code) => sum + (code.instances || []).length, 0),
          codes_with_no_instance: (output.codes_with_no_instance || []).length
        };
      }

      function summarizeApplierOutput(output) {
        const stats = applierStats(output, (output.applied_codes || []).length + (output.codes_with_no_instance || []).length);
        return `${stats.codes_with_instances} codes had instances. ${stats.quote_instances} quote instances returned.`;
      }

      function evidenceStats(inputQuotes, verification) {
        return {
          quotes_checked: inputQuotes.length,
          quotes_accepted: (verification.verified_quotes || []).length,
          quotes_rejected: (verification.failed_quotes || []).length
        };
      }

      function noveltyStats(output) {
        const decisions = output.novelty_decisions || [];
        return {
          decisions: decisions.length,
          new_code: decisions.filter((item) => item.decision === "new_code").length,
          already_covered: decisions.filter((item) => item.decision === "already_covered").length,
          possible_merge: decisions.filter((item) => item.decision === "possible_merge").length
        };
      }

      function summarizeNoveltyOutput(output) {
        const stats = noveltyStats(output);
        return `${stats.decisions} novelty decisions. ${stats.new_code} new, ${stats.already_covered} covered, ${stats.possible_merge} possible merges.`;
      }

      function mergeStats(output) {
        const reviews = output.merge_review || [];
        return {
          reviews: reviews.length,
          merge: reviews.filter((item) => item.recommendation === "merge").length,
          keep_separate: reviews.filter((item) => item.recommendation === "keep_separate").length
        };
      }

      function summarizeMergeOutput(output) {
        const stats = mergeStats(output);
        return `${stats.reviews} merge reviews. ${stats.merge} merge, ${stats.keep_separate} keep separate.`;
      }

      function codebookUpdateStats(packet) {
        const byStatus = {};
        const codes = packet.active_codes_added || [];
        for (const code of codes) {
          byStatus[code.status] = (byStatus[code.status] || 0) + 1;
        }
        return {
          active_codes_added: codes.length,
          merged_codes: (packet.merged_codes || []).length,
          ...byStatus
        };
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

      function auditRefinementProposal(rawProposal, selectedCodes) {
        const docsById = new Map(state.docs.map((doc) => [doc.id, doc]));
        const selectedCodeIds = new Set(selectedCodes.map((code) => code.code_id));
        const accepted = [];
        const rejected = [];
        const replacementCodes = (rawProposal.replacement_codes || [])
          .map((code, index) => {
            const validAssignments = [];
            for (const assignment of code.assignments || []) {
              const doc = docsById.get(assignment.doc_id);
              const quote = String(assignment.quote || "");
              const start = doc && quote ? String(doc.text || "").indexOf(quote) : -1;
              const auditItem = {
                temporary_id: code.temporary_id || `R${index + 1}`,
                code_name: code.name || "",
                doc_id: assignment.doc_id || "",
                quote,
                verified: start !== -1,
                start_char: start !== -1 ? start : null,
                end_char: start !== -1 ? start + quote.length : null
              };
              if (auditItem.verified) {
                accepted.push(auditItem);
                validAssignments.push({
                  doc_id: assignment.doc_id,
                  quote,
                  reason: assignment.reason || "",
                  verified: true,
                  start_char: auditItem.start_char,
                  end_char: auditItem.end_char
                });
              } else {
                rejected.push(auditItem);
              }
            }
            return {
              temporary_id: code.temporary_id || `R${index + 1}`,
              name: String(code.name || "").trim(),
              definition: String(code.definition || "").trim(),
              source_code_ids: (code.source_code_ids || []).filter((codeId) => selectedCodeIds.has(codeId)),
              assignments: validAssignments
            };
          })
          .filter((code) => code.name && code.assignments.length);
        return {
          proposal: {
            mode: rawProposal.mode || "",
            summary: rawProposal.summary || "",
            replacement_codes: replacementCodes
          },
          stats: {
            proposed_codes: (rawProposal.replacement_codes || []).length,
            accepted_codes: replacementCodes.length,
            accepted_assignments: accepted.length,
            rejected_assignments: rejected.length
          },
          audit: {
            verified_assignments: accepted,
            failed_assignments: rejected
          }
        };
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
            decision: "new_code",
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

      function applyCodebookUpdates(doc, noveltyOutput, mergeOutput, verification) {
        const mergeByName = new Map(
          (mergeOutput.merge_review || []).map((item) => [String(item.candidate_code_name || "").toLowerCase(), item])
        );
        const activeCodesAdded = [];
        const mergedCodes = [];
        for (const item of noveltyOutput.novelty_decisions || []) {
          if (item.decision === "already_covered" && findCoveredCode(item)) continue;
          if (!item.evidence_quotes?.length) continue;
          const merge =
            mergeByName.get(String(item.suggested_code?.name || "").toLowerCase()) ||
            mergeByName.get(String(item.scout_code_name || "").toLowerCase());
          if (merge?.recommendation === "merge" && merge.existing_code_id) {
            const merged = applyMergeUpdate(doc, item, merge, verification);
            if (merged) mergedCodes.push(merged);
            continue;
          }
          const code = ensureActiveCode(doc, item, verification);
          if (code) {
            activeCodesAdded.push({
              code_id: code.code_id,
              name: code.name,
              status: code.status
            });
          }
        }
        return {
          active_codes_added: activeCodesAdded,
          merged_codes: mergedCodes
        };
      }

      function findCoveredCode(noveltyItem) {
        const matchedCodeId = String(noveltyItem.matched_code_id || "").trim().toLowerCase();
        const suggestedName = String(noveltyItem.suggested_code?.name || noveltyItem.scout_code_name || "")
          .trim()
          .toLowerCase();
        return state.codebook.find((code) => {
          if (code.status === "rejected" || code.status === "merged") return false;
          const codeId = String(code.code_id || "").trim().toLowerCase();
          const codeName = String(code.name || "").trim().toLowerCase();
          return (matchedCodeId && (codeId === matchedCodeId || codeName === matchedCodeId)) || (suggestedName && codeName === suggestedName);
        });
      }

      function applyMergeUpdate(doc, noveltyItem, merge, verification) {
        const existing = state.codebook.find((code) => code.code_id === merge.existing_code_id);
        if (!existing) return null;
        const verifiedQuotes = verification.verified_quotes.filter((quote) => (noveltyItem.evidence_quotes || []).includes(quote.quote));
        existing.status = "active";
        existing.example_quotes = [
          ...(existing.example_quotes || []),
          ...verifiedQuotes.map((quote) => ({
            doc_id: doc.id,
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
            doc_id: doc.id,
            reason: [merge.argument_for_merge, noveltyItem.rationale].filter(Boolean).join(" ")
          }
        ];
        addAuditLog({
          doc_id: doc.id,
          event_type: "merge_applied",
          code_id: existing.code_id,
          reason: `Merged ${noveltyItem.suggested_code?.name || noveltyItem.scout_code_name} into ${existing.name}.`
        });
        return {
          code_id: existing.code_id,
          name: existing.name,
          status: existing.status
        };
      }

      function ensureActiveCode(doc, noveltyItem, verification) {
        const name = String(noveltyItem.suggested_code?.name || noveltyItem.scout_code_name || "").trim();
        if (!name) return null;
        const existing = state.codebook.find((code) => code.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (existing.status !== "active") existing.status = "active";
          return existing;
        }
        const codeId = nextCodeId();
        const verifiedQuotes = verification.verified_quotes.filter((quote) => (noveltyItem.evidence_quotes || []).includes(quote.quote));
        state.codebook.push({
          id: uid(),
          code_id: codeId,
          name,
          definition: String(noveltyItem.suggested_code?.definition || "").trim(),
          status: "active",
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
              event: "created",
              doc_id: doc.id,
              reason: noveltyItem.rationale || "Created from verified scout evidence."
            }
          ]
        });
        addAuditLog({
          doc_id: doc.id,
          event_type: "active_code_added",
          code_id: codeId,
          reason: `Active code ${name} added from verified scout evidence.`
        });
        return state.codebook[state.codebook.length - 1];
      }

      function nextCodeId() {
        const max = state.codebook.reduce((best, code) => {
          const match = String(code.code_id || "").match(/^C(\d+)$/i);
          return match ? Math.max(best, Number(match[1])) : best;
        }, 0);
        return `C${String(max + 1).padStart(3, "0")}`;
      }

      function updateDormantStatuses() {
        const activeNames = new Set(state.annotations.flatMap((doc) => doc.annotation || []));
        for (const code of state.codebook) {
          const hasVerifiedExample = (code.example_quotes || []).some((quote) => quote.verified !== false);
          const hasAnnotation = activeNames.has(code.name);
          if (code.status === "active" && !hasAnnotation && !hasVerifiedExample) code.status = "dormant";
          if (code.status === "dormant" && (hasAnnotation || hasVerifiedExample)) code.status = "active";
        }
      }

      function addAuditLog(entry) {
        const actor = auditActor(entry);
        const record = {
          timestamp: new Date().toISOString(),
          doc_id: entry.doc_id || "",
          event_type: entry.event_type,
          title: entry.title || "",
          summary: entry.summary || "",
          stats: entry.stats || {},
          input: entry.input || null,
          output: entry.output || null,
          details: entry.details || null,
          code_id: entry.code_id || "",
          reason: entry.reason || "",
          approved_by: entry.approved_by || "",
          actor
        };
        state.auditLog.push(record);
        if (auditListener) auditListener(record);
      }

      async function loadModels() {
        readPreferences();
        if (!state.preferences.apiKey) {
          setStatus("Add an API key first.");
          return;
        }
        setStatus("Loading models.");
        const models = await QualaBackend.listModels({ apiKey: state.preferences.apiKey });
        state.preferences.models = models.length ? models : state.preferences.models;
        if (!state.preferences.models.includes(state.preferences.model)) state.preferences.model = state.preferences.models[0];
        render();
        setStatus("Models loaded.");
      }

      function exportPayload(exportedAt = new Date().toISOString(), options = {}) {
        const { apiKey, ...safePreferences } = state.preferences;
        const history = Object.prototype.hasOwnProperty.call(options, "history") ? options.history : state.history;
        return {
          tool: "Quala",
          exported_at: exportedAt,
          project: {
            docs: state.docs,
            selectedDocId: state.selectedDocId,
            history,
            preferences: safePreferences,
            autosavedAt: state.autosavedAt || exportedAt
          },
          codebook: sortedCodesByPrevalence(state.codebook).map(({ id, ...code }) => {
            const coverage = coverageForCode(code);
            return {
              ...code,
              coverage_percent: coverage.percent,
              coverage_ratio: `${coverage.count}/${coverage.total}`,
              related_datapoints: coverage.docIds,
              example_datapoints: exampleDatapointsForCode(code)
            };
          }),
          audit_log: state.auditLog,
          data: state.annotations.map((doc) => ({
            id: doc.id,
            source: doc.source,
            text: doc.text,
            annotation: doc.annotation,
            quotes: (doc.quotes || []).map((quote) => ({
              id: quote.id,
              quote: quote.quote,
              code_ids: quote.code_ids || [],
              annotations: quote.annotations || [],
              certainty: quote.certainty,
              rationale: quote.rationale
            }))
          }))
        };
      }

      function exportData(scope) {
        const payload = exportPayload();
        if (scope === "codebook") {
          return {
            tool: "Quala",
            exported_at: payload.exported_at,
            export_type: "codebook",
            codebook: sortedCodesByPrevalence(payload.codebook, payload.project.docs, payload.data).map((code) => {
              const coverage = coverageForCode(code, payload.project.docs, payload.data);
              return {
                ...code,
                coverage_percent: coverage.percent,
                coverage_ratio: `${coverage.count}/${coverage.total}`,
                related_datapoints: coverage.docIds,
                example_datapoints: exampleDatapointsForCode(code, payload.project.docs, payload.data)
              };
            })
          };
        }
        if (scope === "annotations") {
          return { tool: "Quala", exported_at: payload.exported_at, export_type: "annotations", data: payload.data };
        }
        if (scope === "logs") {
          return { tool: "Quala", exported_at: payload.exported_at, export_type: "audit_logs", audit_log: payload.audit_log };
        }
        return payload;
      }

      function downloadFile(name, content, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }

      function exportRows(scope) {
        const payload = exportPayload();
        const codebook = codebookExportRows(payload);
        const annotations = payload.data.flatMap((doc) =>
          (doc.quotes || []).map((quote) => ({
            datapoint_id: doc.id,
            source: doc.source,
            quote: quote.quote,
            code_ids: (quote.code_ids || []).join(", "),
            annotations: (quote.annotations || []).join(", "),
            certainty: quote.certainty,
            rationale: quote.rationale
          }))
        );
        if (scope === "codebook") return [{ name: "Codebook", rows: codebook }];
        if (scope === "annotations") return [{ name: "Annotations", rows: annotations }];
        if (scope === "logs") return [{ name: "Audit log", rows: payload.audit_log }];
        return [
          {
            name: "Datapoints",
            rows: payload.project.docs.map((doc) => ({ id: doc.id, source: doc.source, status: doc.status, text: doc.text }))
          },
          { name: "Codebook", rows: codebook },
          { name: "Annotations", rows: annotations },
          { name: "Audit log", rows: payload.audit_log }
        ];
      }

      function codebookExportRows(payload = exportPayload()) {
        return sortedCodesByPrevalence(payload.codebook, payload.project.docs, payload.data).map((code) => {
          const coverage = coverageForCode(code, payload.project.docs, payload.data);
          return {
            code_id: code.code_id,
            name: code.name,
            definition: code.definition,
            status: code.status,
            created_from_doc: code.created_from_doc,
            coverage_percent: coverage.percent,
            coverage_ratio: `${coverage.count}/${coverage.total}`,
            related_datapoints: coverage.docIds.join(", "),
            example_datapoints: exampleDatapointsForCode(code, payload.project.docs, payload.data)
              .map((doc) => `${doc.id}${doc.source ? ` (${doc.source})` : ""}: ${doc.text}`)
              .join("\n"),
            example_quotes: (code.example_quotes || []).map((item) => `${item.doc_id}: ${item.quote}`).join("\n")
          };
        });
      }

      function xmlEscape(value) {
        return String(value ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      }

      function xmlSpreadsheetExport(scope) {
        const sheets = exportRows(scope)
          .map(({ name, rows }) => {
            const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
            const header = columns.map((column) => `<Cell><Data ss:Type="String">${xmlEscape(column)}</Data></Cell>`).join("");
            const body = rows
              .map(
                (row) =>
                  `<Row>${columns
                    .map((column) => `<Cell><Data ss:Type="String">${xmlEscape(formatCell(row[column]))}</Data></Cell>`)
                    .join("")}</Row>`
              )
              .join("");
            return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${header}</Row>${body}</Table></Worksheet>`;
          })
          .join("");
        return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets}</Workbook>`;
      }

      function formatCell(value) {
        if (value === null || value === undefined) return "";
        return typeof value === "object" ? JSON.stringify(value) : String(value);
      }

      function textExport(scope) {
        return exportRows(scope)
          .map(({ name, rows }) => {
            const records = rows.map((row) => Object.entries(row).map(([key, value]) => `${humanizeKey(key)}: ${formatCell(value)}`).join("\n"));
            return `# ${name}\n\n${records.join("\n\n")}`;
          })
          .join("\n\n");
      }

      function exportExplanation(scope, format) {
        if (scope === "all" && format === "json") {
          return "Complete project backup. Load this JSON in Quala later or use it with compatible analysis tools.";
        }
        if (scope === "logs") {
          if (format === "json") return "Complete structured audit logs with agent attribution, prompts, inputs, outputs, statistics, and errors for troubleshooting.";
          if (format === "xml") return "Audit logs in spreadsheet XML. Nested prompts, inputs, and outputs are kept as JSON text for troubleshooting.";
          return "Readable audit logs with agent attribution, prompts, inputs, outputs, statistics, and errors for troubleshooting.";
        }
        const content = scope === "all" ? "project data" : scope;
        if (format === "json") return `Structured ${content} for software and analysis tools. Partial JSON exports cannot reload the full project.`;
        if (format === "xml") return `XML spreadsheet for reviewing and analyzing ${content} in Excel or similar software.`;
        return `Plain text version of ${content} for reading, notes, and simple text tools.`;
      }

      function renderExportExplanation() {
        els.exportExplanation.textContent = exportExplanation(els.exportScope.value, els.exportFormat.value);
      }

      function runExport(scope, format) {
        const base = `quala-${scope}`;
        if (format === "json") {
          downloadFile(`${base}.json`, JSON.stringify(exportData(scope), null, 2), "application/json;charset=utf-8");
        } else if (format === "xml") {
          downloadFile(`${base}.xml`, xmlSpreadsheetExport(scope), "application/vnd.ms-excel;charset=utf-8");
        } else {
          downloadFile(`${base}.txt`, textExport(scope), "text/plain;charset=utf-8");
        }
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

      function showCodeAnnotations(id) {
        const code = state.codebook.find((item) => item.id === id);
        if (!code) return;
        selectedAnnotationCodeId = id;
        renderAnnotations();
        showView("annotations");
        setStatus(`Showing examples for ${code.name}.`);
      }

      function showView(name) {
        document.querySelectorAll(".navBtn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
        document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
        $(`${name}View`).classList.remove("hidden");
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      const QualaBackend = {
        createApi: createQualaApi,
        setApi: setQualaApi,
        getApi: () => qualaApi,
        callModel,
        listModels: (options = {}) => qualaApi.listModels(options),
        run: runQualaBackend,
        refineCodes: runCodeRefinement,
        processProject: runQualaBackend,
        processQueue: processQualaQueue,
        projectStateFromPayload: projectStateFromApiPayload,
        readDocxBytes,
        evidenceAuditor,
        modelCapabilities
      };

      if (typeof globalThis !== "undefined") {
        globalThis.QualaBackend = QualaBackend;
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = QualaBackend;
      }

      if (hasDom) {
      document.querySelectorAll(".navBtn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.dataset.view === "annotations") {
            selectedAnnotationCodeId = "";
            renderAnnotations();
          }
          showView(btn.dataset.view);
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

      els.auditDocFilter.addEventListener("change", () => {
        auditDocFilter = els.auditDocFilter.value;
        renderAudit();
        persistState();
      });

      els.auditSortBtn.addEventListener("click", () => {
        auditSortDescending = !auditSortDescending;
        renderAudit();
      });

      els.loadModelsBtn.addEventListener("click", async () => {
        try {
          await loadModels();
        } catch (err) {
          setStatus("Could not load models.");
          log(err.message);
        }
      });

      els.exportBtn.addEventListener("click", () => {
        renderExportExplanation();
        els.exportModal.classList.add("open");
      });
      els.exportScope.addEventListener("change", renderExportExplanation);
      els.exportFormat.addEventListener("change", renderExportExplanation);
      els.confirmExportBtn.addEventListener("click", () => {
        runExport(els.exportScope.value, els.exportFormat.value);
        els.exportModal.classList.remove("open");
      });
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

      els.deleteCodeBtn.addEventListener("click", () => {
        const id = els.editCodeId.value;
        const code = state.codebook.find((item) => item.id === id);
        if (!code) return;
        code.status = "rejected";
        code.history = [
          ...(code.history || []),
          {
            event: "rejected",
            doc_id: "",
            reason: "Deleted by user."
          }
        ];
        addAuditLog({
          event_type: "code_rejected",
          code_id: code.code_id,
          reason: `User deleted ${code.name}.`,
          approved_by: "human"
        });
        createSnapshot(`Deleted code ${code.name}`);
        els.codeModal.classList.remove("open");
        render();
      });

      els.snapshotBtn.addEventListener("click", () => {
        createSnapshot("Manual snapshot");
        render();
      });

      [els.codingUnitSize, els.codeAbstraction].forEach((el) => {
        el.addEventListener("input", () => {
          renderCodingBehaviorPanels();
        });
      });

      [els.apiKey, els.modelSelect, els.temperature, els.verbosity, els.reasoning, els.maxQuotes, els.codingUnitSize, els.codeAbstraction, els.themeGranularity, els.lens, els.codebookPrompt, els.refinePrompt, els.mergePrompt, els.annotationPrompt].filter(Boolean).forEach(
        (el) => el.addEventListener("change", () => {
          readPreferences();
          renderCodingBehaviorPanels();
          saveState("Preferences auto-saved.");
        })
      );

      render();
      }
    
