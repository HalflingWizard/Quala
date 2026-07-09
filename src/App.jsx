import React, { useState } from "react";
import "../app.js";
import "./styles.css";

const defaultProjectName = "project.json";
const envApiKey =
  typeof __QUALA_OPENAI_API_KEY__ !== "undefined" ? __QUALA_OPENAI_API_KEY__ : import.meta.env.VITE_OPENAI_API_KEY || "";

function nowIso() {
  return new Date().toISOString();
}

function blankProject() {
  const exportedAt = nowIso();
  return {
    tool: "Quala",
    exported_at: exportedAt,
    project: {
      docs: [],
      selectedDocId: null,
      history: [],
      preferences: envApiKey ? { apiKey: envApiKey } : {},
      autosavedAt: exportedAt
    },
    codebook: [],
    audit_log: [],
    data: []
  };
}

function normalizeProject(payload) {
  const base = blankProject();
  const project = payload.project || {};
  const docs = project.docs || payload.docs || payload.data || [];
  const preferences = project.preferences || payload.preferences || {};
  return {
    ...base,
    ...payload,
    project: {
      docs,
      selectedDocId: project.selectedDocId || payload.selectedDocId || docs[0]?.id || null,
      history: project.history || payload.history || [],
      preferences: {
        ...preferences,
        apiKey: preferences.apiKey || envApiKey
      },
      autosavedAt: project.autosavedAt || payload.exported_at || base.exported_at
    },
    codebook: payload.codebook || project.codebook || [],
    audit_log: payload.audit_log || project.auditLog || payload.auditLog || [],
    data: payload.data || project.annotations || payload.annotations || []
  };
}

function uniqueList(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function nextCodeIdFromCodebook(codebook) {
  const max = (codebook || []).reduce((best, code) => {
    const match = String(code.code_id || "").match(/^C(\d+)$/i);
    return match ? Math.max(best, Number(match[1])) : best;
  }, 0);
  return `C${String(max + 1).padStart(3, "0")}`;
}

function downloadJson(name, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsText(file);
  });
}

async function readDatapointFile(file) {
  const isDocx =
    file.name.toLowerCase().endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isDocx) return readFileAsText(file);
  if (!window.QualaBackend?.readDocxBytes) throw new Error("DOCX reader did not load.");
  return window.QualaBackend.readDocxBytes(new Uint8Array(await file.arrayBuffer()));
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ progress, isProcessing }) {
  if (!isProcessing && progress.percent === 0) return null;
  return (
    <section className="progressPanel" aria-label="Processing progress">
      <div className="progressHeader">
        <span>{isProcessing ? "Processing queue" : "Queue progress"}</span>
        <strong>{progress.percent}%</strong>
      </div>
      <div className="progressTrack" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.percent}>
        <div className="progressFill" style={{ width: `${progress.percent}%` }} />
      </div>
      <p>
        {progress.total
          ? `${progress.processed} of ${progress.total} datapoints processed${progress.currentDoc ? `, current item ${progress.currentDoc}` : ""}.`
          : "No queued datapoints."}
      </p>
    </section>
  );
}

function ProjectControls({ onNew, onLoad, onDownload, fileName, setFileName }) {
  return (
    <section className="panel controls">
      <div>
        <h2>Project</h2>
        <p>Create, load, process, and download a Quala project JSON file.</p>
      </div>
      <div className="buttonRow">
        <button type="button" onClick={onNew}>New project</button>
        <label className="button secondary">
          Load JSON
          <input type="file" accept="application/json,.json" onChange={onLoad} />
        </label>
        <input
          aria-label="Export file name"
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          className="fileName"
        />
        <button type="button" className="secondary" onClick={onDownload}>Download JSON</button>
      </div>
    </section>
  );
}

function Navigation({ activeView, setActiveView }) {
  const views = [
    ["project", "Project"],
    ["queue", "Queue"],
    ["results", "Results"],
    ["codeRefinement", "Code Refinement"],
    ["audit", "Agent Outputs"],
    ["settings", "Settings"]
  ];
  return (
    <nav className="appNav" aria-label="Main navigation">
      {views.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={activeView === id ? "navButton active" : "navButton"}
          onClick={() => setActiveView(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function Preferences({ preferences, setPreference }) {
  return (
    <section className="panel">
      <h2>Preferences</h2>
      <div className="formGrid">
        <label>
          OpenAI API key
          <input
            type="password"
            value={preferences.apiKey || ""}
            onChange={(event) => setPreference("apiKey", event.target.value)}
            placeholder={envApiKey ? "Loaded from .env" : "Used for this browser session only"}
          />
        </label>
        <label>
          Model
          <input value={preferences.model || "gpt-4.1"} onChange={(event) => setPreference("model", event.target.value)} />
        </label>
        <label>
          Max quotes
          <input
            type="number"
            min="1"
            max="50"
            value={preferences.maxQuotes || 12}
            onChange={(event) => setPreference("maxQuotes", Number(event.target.value))}
          />
        </label>
        <label>
          Temperature
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={preferences.temperature ?? 0.2}
            onChange={(event) => setPreference("temperature", Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}

function AddDatapoint({ onAdd, onAddMany, nextId, onFileError }) {
  const [id, setId] = useState("D1");
  const [source, setSource] = useState("pasted");
  const [text, setText] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (!id.trim() || !text.trim()) return;
    onAdd({ id: id.trim(), source: source.trim() || "pasted", text, status: "queued" });
    const nextNumber = Number((id.match(/\d+$/) || ["0"])[0]) + 1;
    setId(`D${nextNumber || 1}`);
    setText("");
  }

  async function addDataFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      const docs = [];
      let nextNumber = Number((nextId().match(/\d+$/) || ["0"])[0]);
      for (const file of files) {
        const fileText = await readDatapointFile(file);
        docs.push({
          id: files.length === 1 && id.trim() ? id.trim() : `D${nextNumber}`,
          source: file.name,
          text: fileText,
          status: "queued"
        });
        nextNumber += 1;
      }
      onAddMany(docs);
    } catch (error) {
      onFileError(error.message || "Could not read one or more files.");
    }
  }

  async function addDataFile(event) {
    try {
      await addDataFiles(event.target.files);
    } finally {
      event.target.value = "";
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer?.types?.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setIsDraggingFiles(true);
    }
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingFiles(false);
  }

  async function handleDrop(event) {
    event.preventDefault();
    setIsDraggingFiles(false);
    await addDataFiles(event.dataTransfer.files);
  }

  return (
    <section className="panel addPanel">
      <h2>Add Datapoint</h2>
      <form onSubmit={submit}>
        <div className="formGrid">
          <label>
            ID
            <input value={id} onChange={(event) => setId(event.target.value)} />
          </label>
          <label>
            Source
            <input value={source} onChange={(event) => setSource(event.target.value)} />
          </label>
        </div>
        <label>
          Text
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} />
        </label>
        <div className="buttonRow">
          <button type="submit">Add pasted text</button>
          <label className="button secondary">
            Add TXT or DOCX files
            <input
              type="file"
              accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              onChange={addDataFile}
            />
          </label>
        </div>
        <div
          className={isDraggingFiles ? "dropZone active" : "dropZone"}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <strong>Drop TXT or DOCX files here</strong>
          <span>Files are added to the queue as datapoints.</span>
        </div>
      </form>
    </section>
  );
}

function Workspace({ project, selectedDocId, setSelectedDocId }) {
  const docs = project.project.docs || [];
  const selected = docs.find((doc) => doc.id === selectedDocId) || docs[0];
  const queuedCount = docs.filter((doc) => doc.status !== "coded").length;
  return (
    <section className="panel workspacePanel">
      <div className="sectionTitle">
        <h2>Process Queue</h2>
        <span>{queuedCount} queued</span>
      </div>
      <div className="workspace">
        <div className="list">
          {docs.length ? (
            docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={doc.id === selected?.id ? "listItem active" : "listItem"}
                onClick={() => setSelectedDocId(doc.id)}
              >
                <strong>{doc.id}</strong>
                <span>{doc.source || "No source"}</span>
                <small>{doc.status || "queued"}</small>
              </button>
            ))
          ) : (
            <p className="empty">No datapoints yet.</p>
          )}
        </div>
        <div className="documentPreview">
          {selected ? (
            <>
              <h3>{selected.id}</h3>
              <p className="muted">{selected.source || "No source"}</p>
              <pre>{selected.text}</pre>
            </>
          ) : (
            <p className="empty">Select a datapoint to preview it.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function quoteMatchesCode(quote, code) {
  const codeId = String(code.code_id || "").trim();
  const codeName = String(code.name || "").trim();
  return (
    (quote.code_ids || []).map(String).includes(codeId) ||
    (quote.annotations || []).map(String).includes(codeName)
  );
}

function relatedDatapointsForCode(code, docs, annotations) {
  if (Array.isArray(code.related_datapoints)) return code.related_datapoints;
  const knownDocIds = new Set((docs || []).map((doc) => doc.id));
  const docIds = new Set();
  const addDocId = (docId) => {
    if (!docId || (knownDocIds.size && !knownDocIds.has(docId))) return;
    docIds.add(docId);
  };
  for (const example of code.example_quotes || []) {
    if (example.verified !== false) addDocId(example.doc_id || code.created_from_doc);
  }
  for (const docAnn of annotations || []) {
    for (const quote of docAnn.quotes || []) {
      if (quoteMatchesCode(quote, code)) addDocId(docAnn.id);
    }
  }
  return Array.from(docIds).sort((a, b) => a.localeCompare(b));
}

function Codebook({ codebook, docs, annotations }) {
  return (
    <section className="panel">
      <h2>Codebook</h2>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
              <th>Datapoints</th>
              <th>Definition</th>
            </tr>
          </thead>
          <tbody>
            {codebook.length ? (
              codebook.map((code) => {
                const relatedDatapoints = relatedDatapointsForCode(code, docs, annotations);
                return (
                  <tr key={code.code_id || code.name}>
                    <td>{code.code_id}</td>
                    <td>{code.name}</td>
                    <td>{code.status}</td>
                    <td>
                      {relatedDatapoints.length ? (
                        <div className="tagList">
                          {relatedDatapoints.map((docId) => (
                            <span key={docId} className="tag">{docId}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="empty">None yet</span>
                      )}
                    </td>
                    <td>{code.definition}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="empty">No codes yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CodeRefinement({ codebook, docs, annotations, onQuickMerge, onRunRefinement, onApplyProposal, isProcessing }) {
  const [mode, setMode] = useState("agentMerge");
  const [selectedCodeIds, setSelectedCodeIds] = useState([]);
  const [mergedName, setMergedName] = useState("");
  const [mergedDefinition, setMergedDefinition] = useState("");
  const [lens, setLens] = useState("");
  const [proposal, setProposal] = useState(null);
  const [evidencePopup, setEvidencePopup] = useState(null);

  function toggleCode(codeId) {
    setProposal(null);
    setSelectedCodeIds((current) => {
      if (mode === "split") return current.includes(codeId) ? [] : [codeId];
      return current.includes(codeId) ? current.filter((item) => item !== codeId) : [...current, codeId];
    });
  }

  function submitQuickMerge(event) {
    event.preventDefault();
    if (onQuickMerge(selectedCodeIds, mergedName, mergedDefinition)) {
      setSelectedCodeIds([]);
      setMergedName("");
      setMergedDefinition("");
      setProposal(null);
    }
  }

  async function submitAgentRefinement(event) {
    event.preventDefault();
    const result = await onRunRefinement({
      mode: mode === "split" ? "split" : "merge",
      codeIds: selectedCodeIds,
      lens
    });
    if (result) setProposal(result);
  }

  function applyProposal() {
    if (onApplyProposal(proposal, lens)) {
      setSelectedCodeIds([]);
      setLens("");
      setProposal(null);
      setEvidencePopup(null);
    }
  }

  function openCodeDatapoint(code, docId) {
    const sourceDoc = (docs || []).find((doc) => String(doc.id) === String(docId)) || {};
    const annotationDoc = (annotations || []).find((doc) => String(doc.id) === String(docId)) || {};
    const quotes = (annotationDoc.quotes || []).filter((quote) => quoteMatchesCode(quote, code));
    setEvidencePopup({
      assignment: {
        doc_id: docId,
        quote: quotes[0]?.quote || "",
        reason: `Evidence for ${code.name || code.code_id || "this code"}.`
      },
      doc: { ...annotationDoc, ...sourceDoc, id: docId },
      quotes
    });
  }

  const activeCodes = codebook.filter((code) => !["merged", "rejected"].includes(String(code.status || "").toLowerCase()));
  const needsMultiple = mode !== "split";
  const canRunAgent = selectedCodeIds.length >= (needsMultiple ? 2 : 1) && !isProcessing;

  return (
    <section className="panel">
      <h2>Code Refinement</h2>
      <div className="modeTabs" role="tablist" aria-label="Code refinement modes">
        {[
          ["agentMerge", "Agent-guided merge"],
          ["split", "Agent-guided split"],
          ["quickMerge", "Quick merge"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mode === id ? "navButton active" : "navButton"}
            onClick={() => {
              setMode(id);
              setSelectedCodeIds([]);
              setProposal(null);
              setEvidencePopup(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mergeLayout">
        <div className="mergeCodeList">
          {codebook.length ? (
            codebook.map((code) => {
              const codeId = code.code_id || code.name;
              const relatedDatapoints = relatedDatapointsForCode(code, docs, annotations);
              const canSelect = activeCodes.some((activeCode) => (activeCode.code_id || activeCode.name) === codeId);
              return (
                <label key={codeId} className={canSelect ? "mergeCodeItem" : "mergeCodeItem disabled"}>
                  <input
                    className="checkboxInput"
                    type="checkbox"
                    checked={selectedCodeIds.includes(codeId)}
                    disabled={!canSelect}
                    onChange={() => toggleCode(codeId)}
                  />
                  <span>
                    <strong>{code.name || codeId}</strong>
                    <span className="muted">
                      {code.code_id} - {code.status || "active"}
                    </span>
                    <span>{code.definition || "No definition yet."}</span>
                    {relatedDatapoints.length ? (
                      <span className="tagList">
                        {relatedDatapoints.map((docId) => (
                          <button
                            key={docId}
                            type="button"
                            className="tag tagButton"
                            onClick={(event) => {
                              event.preventDefault();
                              openCodeDatapoint(code, docId);
                            }}
                          >
                            {docId}
                          </button>
                        ))}
                      </span>
                    ) : (
                      <span className="empty">No datapoints yet.</span>
                    )}
                  </span>
                </label>
              );
            })
          ) : (
            <p className="empty">No codes have been found yet.</p>
          )}
        </div>

        <div className="mergePanel">
          {mode === "quickMerge" ? (
            <form className="mergePanel" onSubmit={submitQuickMerge}>
              <label>
                New merged code name
                <input
                  value={mergedName}
                  onChange={(event) => setMergedName(event.target.value)}
                  placeholder="Enter your merged code name"
                />
              </label>
              <label>
                New merged definition
                <textarea
                  rows={6}
                  value={mergedDefinition}
                  onChange={(event) => setMergedDefinition(event.target.value)}
                  placeholder="Describe what these codes mean together"
                />
              </label>
              <div className="buttonRow">
                <button type="submit" disabled={selectedCodeIds.length < 2 || !mergedName.trim()}>
                  Merge selected codes
                </button>
                <span className="muted">{selectedCodeIds.length} selected</span>
              </div>
            </form>
          ) : (
            <form className="mergePanel" onSubmit={submitAgentRefinement}>
              <label>
                {mode === "split" ? "Split guidance" : "Merge lens"}
                <textarea
                  rows={6}
                  value={lens}
                  onChange={(event) => setLens(event.target.value)}
                  placeholder={
                    mode === "split"
                      ? "Optional. Describe what smaller distinctions should matter inside this broad code."
                      : "Describe the shared idea that connects these codes."
                  }
                />
              </label>
              <div className="buttonRow">
                <button type="submit" disabled={!canRunAgent}>
                  {mode === "split" ? "Split with agents" : "Merge with agents"}
                </button>
                <span className="muted">{selectedCodeIds.length} selected</span>
              </div>
            </form>
          )}

          {proposal ? (
            <div className="proposalPanel">
              <h3>Proposed replacement codes</h3>
              <p className="muted">{proposal.proposal?.summary || "Review the proposed code changes."}</p>
              {(proposal.proposal?.replacement_codes || []).length ? (
                proposal.proposal.replacement_codes.map((code) => (
                  <article key={code.temporary_id || code.name} className="findingCard">
                    <h3>{code.name}</h3>
                    <p>{code.definition}</p>
                    <p className="muted">{(code.assignments || []).length} verified quote assignments</p>
                    <EvidenceQuoteList
                      assignments={code.assignments || []}
                      docs={docs}
                      annotations={annotations}
                      onOpen={setEvidencePopup}
                    />
                  </article>
                ))
              ) : (
                <p className="empty">No verified replacement codes were proposed.</p>
              )}
              <button type="button" disabled={!(proposal.proposal?.replacement_codes || []).length} onClick={applyProposal}>
                Apply proposal
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {evidencePopup ? (
        <EvidencePopup evidence={evidencePopup} onClose={() => setEvidencePopup(null)} />
      ) : null}
    </section>
  );
}

function findEvidenceDoc(assignment, docs, annotations) {
  const docId = String(assignment?.doc_id || "");
  return (
    (docs || []).find((doc) => String(doc.id) === docId) ||
    (annotations || []).find((doc) => String(doc.id) === docId) ||
    null
  );
}

function EvidenceQuoteList({ assignments, docs, annotations, onOpen }) {
  if (!assignments?.length) return <p className="empty">No quotes.</p>;
  return (
    <ul className="compactList evidenceQuoteList">
      {assignments.map((assignment, index) => {
        const doc = findEvidenceDoc(assignment, docs, annotations);
        const docLabel = assignment.doc_id || doc?.id || "datapoint";
        return (
          <li key={`${assignment.doc_id || "doc"}-${assignment.quote}-${index}`}>
            <button
              type="button"
              className="evidenceQuoteButton"
              onClick={() => onOpen({ assignment, doc })}
            >
              <span className="tag">{docLabel}</span>
              <q>{assignment.quote}</q>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EvidencePopup({ evidence, onClose }) {
  const assignment = evidence.assignment || {};
  const doc = evidence.doc || {};
  const quotes = evidence.quotes?.length ? evidence.quotes : assignment.quote ? [assignment] : [];
  const docText = String(doc.text || "");
  const quote = String(assignment.quote || "");
  const quoteStart = docText.indexOf(quote);
  const hasQuoteInText = quote && quoteStart !== -1;
  const beforeQuote = hasQuoteInText ? docText.slice(0, quoteStart) : docText;
  const afterQuote = hasQuoteInText ? docText.slice(quoteStart + quote.length) : "";
  const title = doc.id || assignment.doc_id || "Datapoint";

  return (
    <div className="modalOverlay" role="presentation" onMouseDown={onClose}>
      <section
        className="evidenceModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-popup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <h3 id="evidence-popup-title">{title}</h3>
            <p className="muted">{doc.source || "Evidence datapoint"}</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        {quotes.length ? (
          <div className="evidenceStack">
            {quotes.map((item, index) => (
              <blockquote key={`${item.quote}-${index}`}>
                <p>{item.quote}</p>
                <footer>
                  {item.reason || item.rationale || (item.annotations || []).join(", ") || "Verified evidence quote"}
                </footer>
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="empty">No quote was returned for this datapoint.</p>
        )}
        <div className="datapointText">
          {docText ? (
            <p>
              {beforeQuote}
              {hasQuoteInText ? <mark>{quote}</mark> : null}
              {afterQuote}
            </p>
          ) : (
            <p className="empty">This datapoint text is not loaded.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Annotations({ data }) {
  return (
    <section className="panel">
      <h2>Annotations</h2>
      {data.length ? (
        data.map((doc) => (
          <article key={doc.id} className="annotationDoc">
            <h3>{doc.id}</h3>
            <p className="tagLine">{(doc.annotation || []).join(", ") || "No annotations"}</p>
            {(doc.quotes || []).map((quote, index) => (
              <blockquote key={`${doc.id}-${index}`}>
                <p>{quote.quote}</p>
                <footer>
                  {(quote.annotations || []).join(", ")}
                  {quote.rationale ? ` - ${quote.rationale}` : ""}
                </footer>
              </blockquote>
            ))}
          </article>
        ))
      ) : (
        <p className="empty">No annotations yet.</p>
      )}
    </section>
  );
}

function auditActor(entry) {
  if (entry.actor?.label) return entry.actor;
  const actors = {
    document_scout: { label: "Agent 1 Scout", type: "agent" },
    codebook_applier: { label: "Agent 2 Applier", type: "agent" },
    novelty_detector: { label: "Agent 3 Novelty", type: "agent" },
    merge_reviewer: { label: "Agent 4 Merge", type: "agent" },
    evidence_auditor: { label: "Exact-match Auditor", type: "auditor" },
    quotes_verified: { label: "Exact-match Auditor", type: "auditor" },
    quote_verification_failed: { label: "Exact-match Auditor", type: "auditor" },
    codebook_update: { label: "Quala System", type: "system" },
    document_processed: { label: "Quala System", type: "system" },
    active_code_added: { label: "Quala System", type: "system" },
    merge_applied: { label: "Quala System", type: "system" },
    refinement_evidence: { label: "Refinement Agent", type: "agent" },
    refinement_proposal: { label: "Refinement Agent", type: "agent" },
    refinement_auditor: { label: "Exact-match Auditor", type: "auditor" }
  };
  return actors[entry.event_type] || { label: "Quala System", type: "system" };
}

function QuoteList({ quotes }) {
  if (!quotes?.length) return <p className="empty">No quotes.</p>;
  return (
    <ul className="compactList">
      {quotes.map((quote, index) => (
        <li key={`${quote}-${index}`}><q>{quote}</q></li>
      ))}
    </ul>
  );
}

function StageFindings({ entry }) {
  const output = entry.output || {};
  if (entry.event_type === "document_scout") {
    return (
      <div className="stageFindings">
        {(output.scout_codes || []).map((code, index) => (
          <article key={`${code.temporary_code_name}-${index}`} className="findingCard">
            <h3>{code.temporary_code_name || "Unnamed concept"}</h3>
            <p>{code.definition || "No definition returned."}</p>
            <p className="muted">Confidence {code.confidence || "not reported"}</p>
            <QuoteList quotes={code.supporting_quotes || []} />
          </article>
        ))}
      </div>
    );
  }
  if (entry.event_type === "novelty_detector") {
    return (
      <div className="stageFindings">
        {(output.novelty_decisions || []).map((item, index) => (
          <article key={`${item.scout_code_name}-${index}`} className="findingCard">
            <h3>{item.suggested_code?.name || item.scout_code_name || "Unnamed decision"}</h3>
            <p><strong>Decision</strong> {item.decision || "not reported"}</p>
            {item.matched_code_id ? <p><strong>Matched code</strong> {item.matched_code_id}</p> : null}
            <p>{item.suggested_code?.definition || item.rationale || "No rationale returned."}</p>
            <QuoteList quotes={item.evidence_quotes || []} />
          </article>
        ))}
      </div>
    );
  }
  if (entry.event_type === "merge_reviewer") {
    return (
      <div className="stageFindings">
        {(output.merge_review || []).length ? (
          output.merge_review.map((item, index) => (
            <article key={`${item.candidate_code_name}-${index}`} className="findingCard">
              <h3>{item.candidate_code_name || "Merge candidate"}</h3>
              <p><strong>Recommendation</strong> {item.recommendation || "not reported"}</p>
              <p><strong>Existing code</strong> {item.existing_code_id || "none"}</p>
              <p>{item.argument_for_merge || item.argument_for_separation || "No merge argument returned."}</p>
            </article>
          ))
        ) : (
          <p className="empty">No merge review items.</p>
        )}
      </div>
    );
  }
  if (entry.event_type === "codebook_update") {
    return (
      <div className="stageFindings">
        <article className="findingCard">
          <h3>Active codes added</h3>
          {(output.active_codes_added || []).length ? (
            <ul className="compactList">
              {output.active_codes_added.map((code) => (
                <li key={code.code_id}>{code.code_id} {code.name}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">No active codes added.</p>
          )}
        </article>
        <article className="findingCard">
          <h3>Merged codes</h3>
          {(output.merged_codes || []).length ? (
            <ul className="compactList">
              {output.merged_codes.map((code) => (
                <li key={code.code_id}>{code.code_id} {code.name}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">No codes merged.</p>
          )}
        </article>
      </div>
    );
  }
  if (entry.event_type === "codebook_applier") {
    return (
      <div className="stageFindings">
        {(output.applied_codes || []).map((code) => (
          <article key={code.code_id} className="findingCard">
            <h3>{code.code_id}</h3>
            {(code.instances || []).map((instance, index) => (
              <blockquote key={`${code.code_id}-${index}`}>
                <p>{instance.quote}</p>
                <footer>{instance.reason || "No reason returned."}</footer>
              </blockquote>
            ))}
          </article>
        ))}
        {(output.codes_with_no_instance || []).length ? (
          <article className="findingCard">
            <h3>Codes with no instance</h3>
            <p>{output.codes_with_no_instance.join(", ")}</p>
          </article>
        ) : null}
      </div>
    );
  }
  if (entry.event_type === "evidence_auditor") {
    return (
      <div className="stageFindings">
        <article className="findingCard">
          <h3>Accepted exact quotes</h3>
          <QuoteList quotes={(output.verified_quotes || []).map((item) => item.quote)} />
        </article>
        <article className="findingCard">
          <h3>Rejected quotes</h3>
          <QuoteList quotes={(output.failed_quotes || []).map((item) => item.quote)} />
        </article>
      </div>
    );
  }
  if (entry.event_type === "refinement_evidence") {
    return (
      <div className="stageFindings">
        {(output.evidence || []).map((item, index) => (
          <article key={`${item.doc_id}-${index}`} className="findingCard">
            <h3>{item.doc_id}</h3>
            <p className="muted">{(item.current_code_names || []).join(", ")}</p>
            <blockquote>
              <p>{item.quote}</p>
            </blockquote>
          </article>
        ))}
      </div>
    );
  }
  if (entry.event_type === "refinement_proposal") {
    return (
      <div className="stageFindings">
        {(output.replacement_codes || []).map((code) => (
          <article key={code.temporary_id || code.name} className="findingCard">
            <h3>{code.name}</h3>
            <p>{code.definition}</p>
            <p className="muted">{(code.source_code_ids || []).join(", ")}</p>
            <QuoteList quotes={(code.assignments || []).map((item) => item.quote)} />
          </article>
        ))}
      </div>
    );
  }
  if (entry.event_type === "refinement_auditor") {
    return (
      <div className="stageFindings">
        <article className="findingCard">
          <h3>Accepted assignments</h3>
          <QuoteList quotes={(output.verified_assignments || []).map((item) => item.quote)} />
        </article>
        <article className="findingCard">
          <h3>Rejected assignments</h3>
          <QuoteList quotes={(output.failed_assignments || []).map((item) => item.quote)} />
        </article>
      </div>
    );
  }
  return <p className="empty">No structured stage output for this event.</p>;
}

function AgentOutputs({ entries }) {
  const [docFilter, setDocFilter] = useState("all");
  const docIds = Array.from(new Set(entries.map((entry) => entry.doc_id).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const filteredEntries = entries.filter((entry) => docFilter === "all" || entry.doc_id === docFilter);

  return (
    <section className="panel">
      <div className="sectionTitle">
        <h2>Agent Outputs</h2>
        <label className="compactSelect">
          Datapoint
          <select value={docFilter} onChange={(event) => setDocFilter(event.target.value)}>
            <option value="all">All</option>
            {docIds.map((docId) => (
              <option key={docId} value={docId}>{docId}</option>
            ))}
          </select>
        </label>
      </div>
      {filteredEntries.length ? (
        filteredEntries.slice().reverse().map((entry, index) => {
          const actor = auditActor(entry);
          return (
            <details key={`${entry.timestamp}-${index}`} className="auditItem">
              <summary>
                <span>
                  <strong>{entry.title || entry.event_type}</strong>
                  <em className={`actorBadge ${actor.type}`}>{actor.label}</em>
                </span>
                <span>{entry.doc_id || "Project"}</span>
              </summary>
              <p>{entry.summary || entry.reason || "No summary."}</p>
              <StageFindings entry={entry} />
              <div className="agentOutputGrid">
                <div>
                  <h3>Stats</h3>
                  <pre>{JSON.stringify(entry.stats || {}, null, 2)}</pre>
                </div>
                <div>
                  <h3>Input</h3>
                  <pre>{JSON.stringify(entry.input || {}, null, 2)}</pre>
                </div>
                <div>
                  <h3>Output</h3>
                  <pre>{JSON.stringify(entry.output || entry.details || {}, null, 2)}</pre>
                </div>
              </div>
            </details>
          );
        })
      ) : (
        <p className="empty">No agent outputs yet.</p>
      )}
    </section>
  );
}

export default function App() {
  const [project, setProject] = useState(blankProject);
  const [fileName, setFileName] = useState(defaultProjectName);
  const [status, setStatus] = useState("Ready.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, percent: 0, currentDoc: "" });
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [activeView, setActiveView] = useState("project");
  const [liveAuditEntries, setLiveAuditEntries] = useState([]);

  const docs = project.project.docs || [];
  const codedCount = docs.filter((doc) => doc.status === "coded").length;
  const queuedCount = docs.length - codedCount;
  const quoteCount = (project.data || []).reduce((sum, doc) => sum + (doc.quotes || []).length, 0);

  function nextDocId(existingDocs = docs) {
    const max = existingDocs.reduce((best, doc) => {
      const match = String(doc.id || "").match(/^D(\d+)$/i);
      return match ? Math.max(best, Number(match[1])) : best;
    }, 0);
    return `D${max + 1}`;
  }

  function updateProject(nextProject) {
    const normalized = normalizeProject(nextProject);
    setProject(normalized);
    setSelectedDocId(normalized.project.selectedDocId || normalized.project.docs[0]?.id || null);
  }

  function setPreference(key, value) {
    setProject((current) => ({
      ...current,
      project: {
        ...current.project,
        preferences: {
          ...(current.project.preferences || {}),
          [key]: value
        }
      }
    }));
  }

  function addDatapoint(doc) {
    addManyDatapoints([doc]);
  }

  function addManyDatapoints(newDocs) {
    const cleanDocs = newDocs.filter((doc) => doc.id && String(doc.text || "").trim());
    if (!cleanDocs.length) {
      setStatus("No readable files were added.");
      return;
    }
    setProject((current) => {
      const existing = current.project.docs || [];
      const newIds = new Set(cleanDocs.map((doc) => doc.id));
      const docsWithoutDuplicates = existing.filter((item) => !newIds.has(item.id));
      const nextDocs = [...docsWithoutDuplicates, ...cleanDocs];
      const exportedAt = nowIso();
      return {
        ...current,
        exported_at: exportedAt,
        project: {
          ...current.project,
          docs: nextDocs,
          selectedDocId: cleanDocs[0].id,
          autosavedAt: exportedAt
        }
      };
    });
    setSelectedDocId(cleanDocs[0].id);
    setActiveView("queue");
    setStatus(cleanDocs.length === 1 ? `Added ${cleanDocs[0].id}.` : `Added ${cleanDocs.length} files to the queue.`);
  }

  async function loadProject(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await readFileAsText(file));
      updateProject(payload);
      setFileName(file.name || defaultProjectName);
      setStatus(`Loaded ${file.name}.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      event.target.value = "";
    }
  }

  function mergeCodes(selectedCodeIds, mergedName, mergedDefinition) {
    const selectedSet = new Set(selectedCodeIds);
    const cleanName = mergedName.trim();
    if (selectedSet.size < 2) {
      setStatus("Select at least two codes to merge.");
      return false;
    }
    if (!cleanName) {
      setStatus("Add a name for the merged code.");
      return false;
    }
    const availableSelectedCodes = (project.codebook || []).filter((code) => selectedSet.has(code.code_id || code.name));
    if (availableSelectedCodes.length < 2) {
      setStatus("Select at least two available codes to merge.");
      return false;
    }

    setProject((current) => {
      const codebook = current.codebook || [];
      const selectedCodes = codebook.filter((code) => selectedSet.has(code.code_id || code.name));

      const newCodeId = nextCodeIdFromCodebook(codebook);
      const selectedNames = new Set(selectedCodes.map((code) => code.name).filter(Boolean));
      const selectedIds = new Set(selectedCodes.map((code) => code.code_id).filter(Boolean));
      const exportedAt = nowIso();
      const definition =
        mergedDefinition.trim() ||
        uniqueList(selectedCodes.map((code) => code.definition?.trim())).join(" ");
      const exampleQuotes = uniqueList(
        selectedCodes.flatMap((code) =>
          (code.example_quotes || []).map((example) => JSON.stringify({
            doc_id: example.doc_id || code.created_from_doc || "",
            quote: example.quote || "",
            verified: example.verified !== false
          }))
        )
      ).map((item) => JSON.parse(item));
      const mergedFrom = selectedCodes.map((code) => ({
        code_id: code.code_id,
        name: code.name
      }));
      const mergeReason = `Merged into ${newCodeId} ${cleanName}.`;

      const nextCodebook = [
        ...codebook.map((code) => {
          if (!selectedSet.has(code.code_id || code.name)) return code;
          return {
            ...code,
            status: "merged",
            history: [
              ...(code.history || []),
              {
                at: exportedAt,
                event: "merged_by_user",
                doc_id: "",
                reason: mergeReason
              }
            ]
          };
        }),
        {
          code_id: newCodeId,
          name: cleanName,
          definition,
          status: "active",
          created_from_doc: selectedCodes.find((code) => code.created_from_doc)?.created_from_doc || "",
          example_quotes: exampleQuotes,
          history: [
            {
              at: exportedAt,
              event: "manual_merge",
              doc_id: "",
              reason: "User merged related codes in the Code Merger page.",
              merged_from: mergedFrom
            }
          ]
        }
      ];

      const nextData = (current.data || []).map((doc) => {
        const quoteHasSelectedCode = (quote) => {
          const quoteCodeIds = quote.code_ids || [];
          const quoteAnnotations = quote.annotations || [];
          return (
            quoteCodeIds.some((codeId) => selectedIds.has(codeId)) ||
            quoteAnnotations.some((name) => selectedNames.has(name))
          );
        };
        const hasSelectedQuote = (doc.quotes || []).some(quoteHasSelectedCode);
        const nextQuotes = (doc.quotes || []).map((quote) => {
          const quoteCodeIds = quote.code_ids || [];
          const quoteAnnotations = quote.annotations || [];
          if (!quoteHasSelectedCode(quote)) return quote;
          return {
            ...quote,
            code_ids: uniqueList([...quoteCodeIds.filter((codeId) => !selectedIds.has(codeId)), newCodeId]),
            annotations: uniqueList([...quoteAnnotations.filter((name) => !selectedNames.has(name)), cleanName])
          };
        });
        const docAnnotation = doc.annotation || [];
        const hasSelectedAnnotation = docAnnotation.some((name) => selectedNames.has(name));
        return {
          ...doc,
          annotation: hasSelectedAnnotation || hasSelectedQuote
            ? uniqueList([...docAnnotation.filter((name) => !selectedNames.has(name)), cleanName])
            : docAnnotation,
          quotes: nextQuotes
        };
      });

      return {
        ...current,
        exported_at: exportedAt,
        codebook: nextCodebook,
        data: nextData,
        project: {
          ...current.project,
          autosavedAt: exportedAt,
          history: [
            ...(current.project.history || []),
            {
              at: exportedAt,
              event: "manual_merge",
              code_id: newCodeId,
              reason: mergeReason,
              merged_from: mergedFrom
            }
          ]
        }
      };
    });

    setActiveView("results");
    setStatus(`Merged ${selectedSet.size} codes into ${cleanName}.`);
    return true;
  }

  async function runAgentRefinement({ mode, codeIds, lens }) {
    if (!window.QualaBackend?.refineCodes) {
      setStatus("Code refinement backend did not load.");
      return null;
    }
    if (mode === "split" && codeIds.length !== 1) {
      setStatus("Select one code to split.");
      return null;
    }
    if (mode === "merge" && codeIds.length < 2) {
      setStatus("Select at least two codes to merge.");
      return null;
    }
    setIsProcessing(true);
    setLiveAuditEntries([]);
    setProgress({ processed: 0, total: 3, percent: 0, currentDoc: "" });
    setStatus(mode === "split" ? "Running agent-guided split." : "Running agent-guided merge.");
    try {
      const result = await window.QualaBackend.refineCodes(
        project,
        {
          mode,
          code_ids: codeIds,
          lens
        },
        {
          onAudit: (entry) => {
            setLiveAuditEntries((current) => [...current, entry]);
          },
          onProgress: ({ processed, total, percent }) => {
            setProgress({ processed, total, percent, currentDoc: "" });
          }
        }
      );
      setStatus("Review the proposed replacement codes.");
      return result;
    } catch (error) {
      setStatus(error.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }

  function applyRefinementProposal(refinementResult, lens) {
    const replacementCodes = refinementResult?.proposal?.replacement_codes || [];
    const selectedCodes = refinementResult?.selected_codes || [];
    if (!replacementCodes.length || !selectedCodes.length) {
      setStatus("There is no refinement proposal to apply.");
      return false;
    }
    setProject((current) => {
      const exportedAt = nowIso();
      const selectedIds = new Set(selectedCodes.map((code) => code.code_id));
      const selectedNames = new Set(selectedCodes.map((code) => code.name));
      let nextCodeNumber = Number(nextCodeIdFromCodebook(current.codebook || []).replace(/^C/i, ""));
      const newCodes = replacementCodes.map((code) => {
        const codeId = `C${String(nextCodeNumber).padStart(3, "0")}`;
        nextCodeNumber += 1;
        return {
          code_id: codeId,
          name: code.name,
          definition: code.definition,
          status: "active",
          created_from_doc: code.assignments?.[0]?.doc_id || "",
          example_quotes: (code.assignments || []).map((assignment) => ({
            doc_id: assignment.doc_id,
            quote: assignment.quote,
            verified: assignment.verified !== false,
            start_char: assignment.start_char,
            end_char: assignment.end_char
          })),
          history: [
            {
              at: exportedAt,
              event: refinementResult.mode === "split" ? "manual_guided_split" : "manual_guided_merge",
              doc_id: "",
              reason: lens || refinementResult.lens || refinementResult.proposal.summary || "",
              source_code_ids: code.source_code_ids || Array.from(selectedIds)
            }
          ]
        };
      });
      const assignmentLookup = new Map();
      replacementCodes.forEach((proposalCode, index) => {
        const newCode = newCodes[index];
        for (const assignment of proposalCode.assignments || []) {
          const key = `${assignment.doc_id}\n${assignment.quote}`;
          const currentAssignments = assignmentLookup.get(key) || [];
          currentAssignments.push({ code_id: newCode.code_id, name: newCode.name });
          assignmentLookup.set(key, currentAssignments);
        }
      });
      const nextData = (current.data || []).map((doc) => {
        const nextQuotes = (doc.quotes || []).map((quote) => {
          const hasSelected =
            (quote.code_ids || []).some((codeId) => selectedIds.has(codeId)) ||
            (quote.annotations || []).some((name) => selectedNames.has(name));
          const replacements = assignmentLookup.get(`${doc.id}\n${quote.quote}`) || [];
          if (!hasSelected && !replacements.length) return quote;
          return {
            ...quote,
            code_ids: uniqueList([
              ...(quote.code_ids || []).filter((codeId) => !selectedIds.has(codeId)),
              ...replacements.map((item) => item.code_id)
            ]),
            annotations: uniqueList([
              ...(quote.annotations || []).filter((name) => !selectedNames.has(name)),
              ...replacements.map((item) => item.name)
            ])
          };
        });
        return {
          ...doc,
          annotation: uniqueList(nextQuotes.flatMap((quote) => quote.annotations || [])),
          quotes: nextQuotes
        };
      });
      const nextCodebook = [
        ...(current.codebook || []).map((code) => {
          if (!selectedIds.has(code.code_id)) return code;
          return {
            ...code,
            status: "merged",
            history: [
              ...(code.history || []),
              {
                at: exportedAt,
                event: refinementResult.mode === "split" ? "split_by_user" : "merged_by_user",
                doc_id: "",
                reason: `Replaced by ${newCodes.map((item) => item.code_id).join(", ")}.`
              }
            ]
          };
        }),
        ...newCodes
      ];
      return {
        ...current,
        exported_at: exportedAt,
        codebook: nextCodebook,
        data: nextData,
        audit_log: [...(current.audit_log || []), ...(refinementResult.audit_log || [])],
        project: {
          ...current.project,
          autosavedAt: exportedAt,
          history: [
            ...(current.project.history || []),
            {
              at: exportedAt,
              event: refinementResult.mode === "split" ? "manual_guided_split" : "manual_guided_merge",
              reason: lens || refinementResult.lens || refinementResult.proposal.summary || "",
              source_code_ids: Array.from(selectedIds),
              replacement_code_names: newCodes.map((code) => code.name)
            }
          ]
        }
      };
    });
    setActiveView("results");
    setStatus("Applied the refinement proposal.");
    return true;
  }

  async function processProject() {
    if (!docs.length) {
      setStatus("Add at least one datapoint first.");
      return;
    }
    if (!window.QualaBackend) {
      setStatus("Quala backend did not load.");
      return;
    }
    setIsProcessing(true);
    setLiveAuditEntries([]);
    setActiveView("audit");
    setProgress({ processed: 0, total: queuedCount, percent: 0, currentDoc: "" });
    setStatus("Processing queued datapoints.");
    try {
      const result = await window.QualaBackend.run(project, {
        onAudit: (entry) => {
          setLiveAuditEntries((current) => [...current, entry]);
        },
        onProgress: ({ processed, total, percent, doc }) => {
          setProgress({
            processed,
            total,
            percent,
            currentDoc: doc?.id || ""
          });
        }
      });
      updateProject(result);
      setLiveAuditEntries([]);
      setProgress((current) => ({ ...current, processed: current.total, percent: 100, currentDoc: "" }));
      setStatus("Processing complete. Download the JSON to save it.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main>
      <header className="topBar">
        <div>
          <h1>Quala</h1>
          <p>Qualitative coding for project JSON files.</p>
        </div>
        <button type="button" disabled={isProcessing} onClick={processProject}>
          {isProcessing ? "Processing" : "Process queue"}
        </button>
      </header>

      <Navigation activeView={activeView} setActiveView={setActiveView} />

      <section className="statsGrid">
        <Stat label="Datapoints" value={docs.length} />
        <Stat label="Queued" value={queuedCount} />
        <Stat label="Coded" value={codedCount} />
        <Stat label="Codes" value={(project.codebook || []).length} />
      </section>

      <p className={isProcessing ? "status busy" : "status"}>{status}</p>
      <ProgressBar progress={progress} isProcessing={isProcessing} />

      {activeView === "project" && (
        <ProjectControls
          onNew={() => {
            updateProject(blankProject());
            setStatus("Created a new project.");
          }}
          onLoad={loadProject}
          onDownload={() => downloadJson(fileName || defaultProjectName, project)}
          fileName={fileName}
          setFileName={setFileName}
        />
      )}

      {activeView === "queue" && (
        <>
          <AddDatapoint
            onAdd={addDatapoint}
            onAddMany={addManyDatapoints}
            nextId={() => nextDocId()}
            onFileError={setStatus}
          />
          <Workspace project={project} selectedDocId={selectedDocId} setSelectedDocId={setSelectedDocId} />
        </>
      )}

      {activeView === "results" && (
        <div className="mainGrid">
          <Codebook codebook={project.codebook || []} docs={docs} annotations={project.data || []} />
          <Annotations data={project.data || []} />
        </div>
      )}

      {activeView === "codeRefinement" && (
        <CodeRefinement
          codebook={project.codebook || []}
          docs={docs}
          annotations={project.data || []}
          onQuickMerge={mergeCodes}
          onRunRefinement={runAgentRefinement}
          onApplyProposal={applyRefinementProposal}
          isProcessing={isProcessing}
        />
      )}

      {activeView === "audit" && <AgentOutputs entries={liveAuditEntries.length ? liveAuditEntries : project.audit_log || []} />}

      {activeView === "settings" && <Preferences preferences={project.project.preferences || {}} setPreference={setPreference} />}
    </main>
  );
}
