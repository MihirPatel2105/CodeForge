"use client";

import { useEffect, useRef, useState } from "react";
import { detailPath, discover, fieldSchema, formBody, parseValue, recordId, resolve } from "../lib/schema.mjs";

async function request(path, method = "GET", body, signal) {
  const response = await fetch(`/api${path}`, { method, signal, cache: "no-store", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`The API returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(item => `${item.loc?.join(" → ") || "Request"}: ${item.msg}`).join("; ") : `Request failed (HTTP ${response.status}).`);
  }
  return data;
}

function textValue(value) { return value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function label(name) { return name.replaceAll("_", " "); }

function Field({ name, raw, document, value, onChange, required, disabled }) {
  const schema = fieldSchema(raw, document);
  const nullable = (resolve(raw, document).anyOf || resolve(raw, document).oneOf || []).some(item => item.type === "null");
  const common = { id: `field-${name}`, disabled: disabled || value === null, required: required && value !== null, value: value ?? "", onChange: event => onChange(event.target.value) };
  return <div className="field">
    <label htmlFor={common.id}>{label(name)}{required && " *"}</label>
    {schema.enum ? <select {...common}><option value="">Choose…</option>{schema.enum.map(item => <option key={String(item)} value={String(item)}>{String(item)}</option>)}</select>
      : schema.type === "boolean" ? <select {...common}><option value="false">No</option><option value="true">Yes</option></select>
      : ["array", "object"].includes(schema.type) ? <textarea {...common} rows={3} placeholder={schema.type === "array" ? "[]" : "{}"} />
      : <input {...common} type={["number", "integer"].includes(schema.type) ? "number" : schema.format === "email" ? "email" : schema.format === "date" ? "date" : "text"} step={schema.type === "integer" ? "1" : "any"} min={schema.minimum} max={schema.maximum} minLength={schema.minLength} maxLength={schema.maxLength} pattern={schema.pattern} />}
    {nullable && <label className="check"><input type="checkbox" disabled={disabled} checked={value === null} onChange={event => onChange(event.target.checked ? null : "")} />Set empty value (null)</label>}
    {schema.description && <small>{schema.description}</small>}
  </div>;
}

function Editor({ collection, document, record, onClose, onSave, busy }) {
  const schema = record ? collection.editSchema : collection.createSchema;
  const fields = Object.entries(schema.properties || {}).filter(([, raw]) => !raw.readOnly);
  const initial = Object.fromEntries(fields.map(([name, raw]) => {
    const field = fieldSchema(raw, document);
    const value = record?.[name] ?? field.default ?? (field.type === "boolean" ? false : "");
    return [name, record?.[name] === null ? null : typeof value === "object" ? JSON.stringify(value) : String(value)];
  }));
  const [values, setValues] = useState(initial);
  const [included, setIncluded] = useState(fields.filter(([name, raw]) => schema.required?.includes(name) || record && name in record || fieldSchema(raw, document).default !== undefined).map(([name]) => name));
  const [error, setError] = useState("");
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  async function submit(event) {
    event.preventDefault(); setError("");
    try { await onSave(formBody(values, included, schema, document)); } catch (error) { setError(error.message); }
  }
  return <section className="editor panel" aria-labelledby="editor-heading">
    <h2 id="editor-heading" tabIndex={-1} ref={heading}>{record ? "Edit record" : "Add record"}</h2>
    <p>Fields marked * are required.</p>
    <form onSubmit={submit}>
      {fields.map(([name, raw]) => <div key={name}>
        {!schema.required?.includes(name) && <label className="check"><input type="checkbox" disabled={busy} checked={included.includes(name)} onChange={event => setIncluded(event.target.checked ? [...included, name] : included.filter(item => item !== name))} />Include {label(name)}</label>}
        <Field name={name} raw={raw} document={document} value={values[name]} required={schema.required?.includes(name)} disabled={busy || !included.includes(name)} onChange={value => setValues({ ...values, [name]: value })} />
      </div>)}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><button disabled={busy} type="submit">{busy ? "Saving…" : "Save record"}</button><button className="secondary" disabled={busy} type="button" onClick={onClose}>Cancel</button></div>
    </form>
  </section>;
}

function Collection({ collection, document }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const cancel = useRef(null);
  const addButton = useRef(null);
  const queryParams = collection.parameters.filter(item => item.in === "query");
  const offsetParam = queryParams.find(item => ["skip", "offset"].includes(item.name));
  const limitParam = queryParams.find(item => item.name === "limit");
  const paginated = offsetParam && limitParam;
  const limit = Math.max(limitParam?.schema.minimum ?? 1, Math.min(50, limitParam?.schema.maximum ?? 50));
  const requiredParams = queryParams.filter(item => item.required && item.schema.default === undefined && !([offsetParam, limitParam].includes(item)));
  const blocked = collection.parameters.some(item => item.required && !["query", "path"].includes(item.in));

  async function load(nextOffset = offset) {
    cancel.current?.abort();
    const controller = new AbortController(); cancel.current = controller;
    setLoading(true); setError(""); setRows([]);
    try {
      if (blocked) throw new Error("This collection needs authentication or headers. Use the API docs to supply them.");
      const search = new URLSearchParams();
      for (const param of queryParams) {
        const value = filters[param.name] ?? param.schema.default;
        if (value !== undefined && value !== "") search.set(param.name, String(parseValue(value, param.schema, document)));
        else if (requiredParams.includes(param)) throw new Error(`Enter ${label(param.name)} and choose Apply filters.`);
      }
      if (paginated) { search.set(offsetParam.name, String(nextOffset)); search.set(limitParam.name, String(limit)); }
      const result = await request(`${collection.path}${search.size ? `?${search}` : ""}`, "GET", undefined, controller.signal);
      const records = collection.key ? result?.[collection.key] : result;
      if (!Array.isArray(records) || records.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("The API did not return a list of records. Inspect its response in the API docs.");
      setRows(records); setOffset(nextOffset);
    } catch (error) { if (error.name !== "AbortError") setError(error.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  // Each collection is mounted with its path as the key, so filters never cross collections.
  useEffect(() => { void load(0); return () => cancel.current?.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function close() { setEditor(null); addButton.current?.focus(); }
  async function edit(row) {
    setBusy(true); setError(""); setNotice("");
    try { setEditor({ record: collection.detailGet ? await request(detailPath(collection, row)) : row }); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function save(body) {
    setBusy(true); setNotice("");
    try {
      await request(editor.record ? detailPath(collection, editor.record) : collection.path, editor.record ? collection.editMethod : "POST", body);
      close(); setNotice("Record saved."); await load(0);
    } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError(""); setNotice("");
    try { await request(detailPath(collection, deleting), "DELETE"); setDeleting(null); setNotice("Record deleted."); await load(0); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const visible = rows.filter(row => Object.values(row).some(value => textValue(value).toLowerCase().includes(query.toLowerCase())));
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return <>
    <section className="toolbar"><div><h1>{collection.name}</h1><p>{loading ? "Loading records…" : `${rows.length} records loaded`}</p></div><div className="actions"><button className="secondary" disabled={loading || busy} onClick={() => void load()}>Refresh</button>{collection.create && <button ref={addButton} disabled={busy || loading || !!editor || !!deleting} onClick={() => { setEditor({ record: null }); setNotice(""); }}>Add record</button>}</div></section>
    {notice && <p role="status" className="success">{notice}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {editor && <Editor collection={collection} document={document} record={editor.record} onClose={close} onSave={save} busy={busy} />}
    {deleting && <section className="panel" role="alertdialog" aria-labelledby="delete-heading" aria-describedby="delete-description"><h2 id="delete-heading">Delete this record?</h2><p id="delete-description">This permanently removes record {String(recordId(deleting, collection))}.</p><div className="actions"><button className="danger" disabled={busy} onClick={() => void remove()}>Confirm delete</button><button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Keep record</button></div></section>}
    <section className="panel">
      <label htmlFor="search">Search loaded records</label><input id="search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${collection.name}…`} />
      {queryParams.some(item => !paginated || ![offsetParam, limitParam].includes(item)) && <form className="filters" onSubmit={event => { event.preventDefault(); void load(0); }}>{queryParams.filter(item => !paginated || ![offsetParam, limitParam].includes(item)).map(param => <Field key={param.name} name={param.name} raw={param.schema} document={document} value={filters[param.name] ?? param.schema.default ?? ""} required={param.required} onChange={value => setFilters({ ...filters, [param.name]: value })} />)}<button className="secondary" disabled={busy || loading} type="submit">Apply filters</button></form>}
      <div className="table-wrap" aria-busy={loading}><table><caption className="sr-only">{collection.name} records</caption><thead><tr>{columns.map(name => <th key={name} scope="col">{label(name)}</th>)}{(collection.edit || collection.remove) && <th scope="col">Actions</th>}</tr></thead><tbody>{visible.map((row, index) => <tr key={String(recordId(row, collection) ?? index)}>{columns.map(name => <td key={name} title={textValue(row[name])}>{textValue(row[name])}</td>)}{(collection.edit || collection.remove) && <td><div className="actions">{collection.edit && <button className="secondary" disabled={busy || !!editor || !!deleting || recordId(row, collection) === undefined} onClick={() => void edit(row)}>Edit</button>}{collection.remove && <button className="secondary delete" disabled={busy || !!editor || !!deleting || recordId(row, collection) === undefined} onClick={() => setDeleting(row)}>Delete</button>}</div></td>}</tr>)}</tbody></table></div>
      {!loading && !visible.length && <p className="empty">{error ? "Records could not be loaded." : query ? "No loaded records match your search." : "No records yet. Add your first record to get started."}</p>}
      {paginated && <div className="actions pagination"><button className="secondary" disabled={loading || busy || offset <= 0} onClick={() => void load(Math.max(0, offset - limit))}>Previous</button><span>Offset {offset}</span><button className="secondary" disabled={loading || busy || !!error || rows.length < limit} onClick={() => void load(offset + limit)}>Next</button></div>}
    </section>
    <p className="footnote">Search covers loaded records. Only supported actions appear here. <a href="/api/docs" target="_blank" rel="noreferrer">Open API docs</a> for other operations.</p>
  </>;
}

export default function Page() {
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    request("/openapi.json", "GET", undefined, controller.signal).then(data => {
      if (!data?.paths || typeof data.paths !== "object") throw new Error("The API did not provide a usable schema.");
      setDocument(data); setSelected(discover(data)[0]?.path || "");
    }).catch(error => { if (error.name !== "AbortError") setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  const collections = document ? discover(document) : [];
  const active = collections.find(item => item.path === selected);
  return <div className="shell"><header className="brand"><span className="brand-mark" aria-hidden>▦</span><div><strong>Collection manager</strong><small>{document?.info?.title || "Your API workspace"}</small></div><span className="local">Local workspace</span></header><div className="workspace"><nav aria-label="Collections"><h2>Collections</h2>{collections.map(item => <button key={item.path} aria-current={item.path === selected ? "page" : undefined} onClick={() => setSelected(item.path)}>{item.name}<small>{item.path}</small></button>)}<a href="/api/docs" target="_blank" rel="noreferrer">API documentation ↗</a></nav><main>{error ? <section className="panel"><h1>Could not connect</h1><p role="alert" className="error">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry connection</button></section> : !document ? <p role="status">Connecting to your API…</p> : active ? <Collection key={active.path} collection={active} document={document} /> : <section className="panel"><h1>No supported collections found</h1><p>This interface needs a list endpoint returning records. You can still use every endpoint through the <a href="/api/docs">API documentation</a>.</p></section>}</main></div></div>;
}
