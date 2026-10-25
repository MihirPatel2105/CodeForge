import { Check, FileCode2, GitBranch, ShieldCheck } from "lucide-react";
import { DEMO_RUNS } from "@/lib/demo-runs";
import { tokenizePythonLine } from "@/lib/python-highlight";

const library = DEMO_RUNS[0];

export function ModelPreview() {
  return <span className="lp-code-preview"><span className="lp-preview-toolbar"><FileCode2 size={13} />models.py<span>Data model</span></span><span className="lp-preview-code lp-model-code">{library.finalFiles["models.py"].trimEnd().split("\n").map((line, index) => <span key={index}><i>{String(index + 1).padStart(2, "0")}</i>{tokenizePythonLine(line).map((token, tokenIndex) => <span key={tokenIndex} data-token={token.cls ?? undefined}>{token.text}</span>)}</span>)}</span></span>;
}

export function FilesPreview() {
  const files = [...Object.entries(library.finalFiles), [library.testFile.path, library.testFile.content]];
  const labels: Record<string, string> = { "main.py": "Application routes", "models.py": "Stored data", "schemas.py": "Input and output validation", "database.py": "Database connection", [library.testFile.path]: "Generated tests" };
  return <span className="lp-files-preview"><span className="lp-files-heading"><FileCode2 size={16} />Application workspace<span>Library example</span></span><span className="lp-files-list">{files.map(([path, content]) => <span className="lp-files-row" key={path}><FileCode2 size={17} /><span><strong>{path}</strong><small>{labels[path] ?? "Application file"}</small></span><span>{content.trimEnd().split("\n").length} lines</span></span>)}</span></span>;
}

export function ApprovalPreview() {
  return <span className="lp-approval-preview">
    <span className="lp-preview-window">
      <span className="lp-preview-toolbar"><span className="lp-preview-dots"><i /><i /><i /></span>Library API<span>Plan review</span></span>
      <span className="lp-preview-document"><span className="lp-preview-eyebrow">Your next decision</span><strong>A home for every book.</strong><span className="lp-preview-fields">title<span>author</span>ISBN<span>genre</span></span>
        <span className="lp-preview-route"><b>POST</b>/books<Check size={13} /></span><span className="lp-preview-route"><b>GET</b>/books/{"{id}"}<Check size={13} /></span><span className="lp-preview-route"><b>PATCH</b>/books/{"{id}"}<Check size={13} /></span>
        <span className="lp-preview-checkpoint"><ShieldCheck size={17} /><span>Architecture ready<strong>Waiting for your approval</strong></span><span className="lp-preview-decision">Review plan ↗</span></span>
      </span>
    </span>
    <span className="lp-preview-receipt"><Check size={16} /><span>Requirements reviewed<strong>Your idea. Still yours.</strong></span></span>
  </span>;
}

export function CodePreview() {
  return <span className="lp-code-preview"><span className="lp-preview-toolbar"><FileCode2 size={13} />main.py<span>Generated code</span></span>
    <span className="lp-preview-code"><span><i>01</i><em>@app.patch</em>(&quot;/books/{"{id}"}&quot;,</span><span><i>02</i>    <mark>response_model=BookOut</mark>)</span><span><i>03</i><em>async def</em> update_book(...):</span><span><i>04</i>    <em>return</em> updated_book</span></span>
    <span className="lp-preview-code-note"><GitBranch size={13} />A review. A fix. A visible difference.</span>
  </span>;
}

export function OutcomePreview() {
  return <span className="lp-outcome-preview"><span className="lp-outcome-score"><span>Library demo</span><strong>8<span>/ 8</span></strong><span>tests passed</span></span><span className="lp-outcome-checks">{["Create & read", "Update & delete", "Input validation"].map(label => <span key={label}><Check size={14} />{label}</span>)}<span className="lp-outcome-files"><FileCode2 size={14} />Application files included</span></span></span>;
}
