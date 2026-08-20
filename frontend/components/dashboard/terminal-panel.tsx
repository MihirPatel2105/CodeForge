import { cn } from "@/lib/utils";
import { typeScale } from "@/lib/type-scale";

export interface TerminalLine {
  text: string;
  stream: "stdout" | "stderr";
}

export interface TerminalPanelProps {
  lines: TerminalLine[];
  image: string | null;
  running: boolean;
}

const PASS_LINE = /\d+ passed/;

/** Sandbox output panel (design_handoff/README.md "Code and output" — "the sandbox's
 * real output"). `--term-bg` / `--term-fg` are literal across both themes by design. */
export function TerminalPanel({ lines, image, running }: TerminalPanelProps) {
  return (
    <div className="flex h-[196px] flex-col overflow-hidden rounded-xl bg-term-bg">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-[9px]">
        <span className={cn(typeScale.label, "text-[#9AA1AB]")}>SANDBOX</span>
        {image && <span className="font-mono text-[12px] text-term-dim">{image}</span>}
        {running && (
          <span className="ml-auto flex items-center gap-[5px] font-mono text-[12px] text-term-pass">
            <span
              aria-hidden
              className="h-[6px] w-[6px] rounded-full bg-current motion-safe:animate-[cfDot_1.1s_ease-in-out_infinite]"
            />
            executing
          </span>
        )}
      </div>
      <pre className="flex-1 overflow-y-auto px-3 py-[10px] font-mono text-[13px] leading-[1.6] whitespace-pre-wrap text-term-fg">
        {lines.length === 0 ? (
          <span className="text-term-dim">$ waiting for the Tester to finish…</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={
                line.stream === "stderr"
                  ? "text-term-stderr"
                  : PASS_LINE.test(line.text)
                    ? "text-term-pass"
                    : undefined
              }
            >
              {line.text}
            </div>
          ))
        )}
      </pre>
    </div>
  );
}
