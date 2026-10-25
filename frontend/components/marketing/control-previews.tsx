import { Check, FileCode2, GitBranch, ShieldCheck } from "lucide-react";

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
