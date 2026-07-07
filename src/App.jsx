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
    ["audit", "Audit"],
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

function AddDatapoint({ onAdd, onAddMany, nextId }) {
  const [id, setId] = useState("D1");
  const [source, setSource] = useState("pasted");
  const [text, setText] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!id.trim() || !text.trim()) return;
    onAdd({ id: id.trim(), source: source.trim() || "pasted", text, status: "queued" });
    const nextNumber = Number((id.match(/\d+$/) || ["0"])[0]) + 1;
    setId(`D${nextNumber || 1}`);
    setText("");
  }

  async function addDataFile(event) {
    const files = Array.from(event.target.files || []);
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
    } finally {
      event.target.value = "";
    }
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

function AuditLog({ entries }) {
  return (
    <section className="panel">
      <h2>Audit Log</h2>
      {entries.length ? (
        entries.slice().reverse().map((entry, index) => (
          <details key={`${entry.timestamp}-${index}`} className="auditItem">
            <summary>
              <strong>{entry.title || entry.event_type}</strong>
              <span>{entry.doc_id || "Project"}</span>
            </summary>
            <p>{entry.summary || entry.reason || "No summary."}</p>
            <pre>{JSON.stringify({ stats: entry.stats, input: entry.input, output: entry.output }, null, 2)}</pre>
          </details>
        ))
      ) : (
        <p className="empty">No audit events yet.</p>
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
    setProgress({ processed: 0, total: queuedCount, percent: 0, currentDoc: "" });
    setStatus("Processing queued datapoints.");
    try {
      const result = await window.QualaBackend.run(project, {
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
      setProgress((current) => ({ ...current, processed: current.total, percent: 100, currentDoc: "" }));
      setActiveView("results");
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
          <AddDatapoint onAdd={addDatapoint} onAddMany={addManyDatapoints} nextId={() => nextDocId()} />
          <Workspace project={project} selectedDocId={selectedDocId} setSelectedDocId={setSelectedDocId} />
        </>
      )}

      {activeView === "results" && (
        <div className="mainGrid">
          <Codebook codebook={project.codebook || []} docs={docs} annotations={project.data || []} />
          <Annotations data={project.data || []} />
        </div>
      )}

      {activeView === "audit" && <AuditLog entries={project.audit_log || []} />}

      {activeView === "settings" && <Preferences preferences={project.project.preferences || {}} setPreference={setPreference} />}
    </main>
  );
}
