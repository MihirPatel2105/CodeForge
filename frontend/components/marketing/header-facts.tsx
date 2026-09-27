/**
 * A small spec sheet for the space beside a page title.
 *
 * The marketing pages are prose, and prose is slow to answer "so what does it actually
 * do". These are the same claims the page argues, reduced to a form you can take in
 * without reading — set as a key/value table because that is how a spec is read.
 *
 * Deliberately not a summary of the page: repeating the body copy in smaller type adds
 * nothing. Each row carries a fact the prose beside it does not state outright.
 */
export function HeaderFacts({
  label,
  rows,
}: {
  label: string;
  rows: readonly { readonly k: string; readonly v: string }[];
}) {
  return (
    <div className="w-full max-w-[300px]">
      <span className="text-[13px] font-[650] text-accent">
        {label}
      </span>
      <dl className="mt-4 border-t border-rule">
        {rows.map((row) => (
          <div key={row.k} className="border-b border-rule py-[11px]">
            <dt className="text-[12px] font-[600] text-fg-muted">
              {row.k}
            </dt>
            <dd className="mt-[5px] text-[13.5px] leading-[1.45] text-fg">{row.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
