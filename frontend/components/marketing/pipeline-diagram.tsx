/**
 * The run, drawn as a route map.
 *
 * The page describes the pipeline in words and lists its stages in order, but a list
 * cannot show the one thing that makes this pipeline interesting: two of its edges point
 * backwards. The loop is the project's actual contribution, and a reader should be able
 * to see it before reading a paragraph about it.
 *
 * SVG rather than positioned divs — the backward edges are lines with corners and
 * arrowheads, which is what a vector drawing is for. Static rather than animated: the
 * landing page already has a moving pipeline, and this one is here to be studied.
 *
 * Colour follows the design system's rule that colour means run state, so only the two
 * loop edges are tinted (violet = looping); the forward path is plain ink.
 */

const STAGES = [
  { name: "pm", y: 54 },
  { name: "architect", y: 96 },
  { name: "coder", y: 138 },
  { name: "reviewer", y: 180 },
  { name: "tester", y: 222 },
  { name: "sandbox", y: 264 },
] as const;

/** Where the pipeline stops and waits for a person, drawn on the segment it interrupts. */
const GATES = [
  { y: 75, label: "you approve" },
  { y: 117, label: "you approve" },
] as const;

const SPINE_X = 26;
const LABEL_X = 44;

/** An edge that sends work back to the Coder. `x` is how far right the run is routed
 * before turning back, so the two loops nest instead of overlapping.
 *
 * Unlabelled by design: set along the edge, the captions ran longer than the segments
 * they belonged to and crossed their own corners. They live in the legend below instead,
 * where they have room to be read. */
function LoopEdge({ from, x, to }: { from: number; x: number; to: number }) {
  return (
    <g className="text-loop">
      <path
        d={`M 122 ${from} H ${x} V ${to} H 129`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      {/* Arrowhead, pointing back at the Coder. */}
      <polygon points={`121,${to} 130,${to - 4} 130,${to + 4}`} fill="currentColor" />
    </g>
  );
}

const LOOPS = [
  { from: "reviewer", cause: "a blocking finding" },
  { from: "sandbox", cause: "a failing test" },
] as const;

export function PipelineDiagram() {
  return (
    <div className="w-full max-w-[252px]">
      <svg
        viewBox="0 0 210 312"
        className="h-auto w-full"
        role="img"
        aria-label="A run travels through six stages: PM, Architect, Coder, Reviewer, Tester and Sandbox. It pauses for your approval after the PM and after the Architect. A blocking review finding sends the work back from the Reviewer to the Coder, and a failing test sends it back from the Sandbox to the Coder."
      >
        {/* The forward path */}
        <line
          x1={SPINE_X}
          y1="28"
          x2={SPINE_X}
          y2="292"
          className="stroke-border-strong"
          strokeWidth="1.25"
        />

        {/* Where the run enters and what it leaves behind */}
        <g
          className="fill-fg-faint font-mono text-[9px] font-[600] uppercase"
          letterSpacing="0.14em"
        >
          <text x={LABEL_X} y="25">
            your prompt
          </text>
          <text x={LABEL_X} y="300">
            tested api
          </text>
        </g>
        <polygon
          points={`${SPINE_X},296 ${SPINE_X - 3.6},288 ${SPINE_X + 3.6},288`}
          className="fill-border-strong"
        />

        {GATES.map((gate) => (
          <g key={gate.y}>
            <line
              x1={SPINE_X - 7}
              y1={gate.y}
              x2={SPINE_X + 7}
              y2={gate.y}
              className="stroke-fg"
              strokeWidth="1.25"
            />
            <text
              x={LABEL_X}
              y={gate.y + 3}
              className="fill-fg-faint font-mono text-[8.5px] font-[600] uppercase"
              letterSpacing="0.12em"
            >
              {gate.label}
            </text>
          </g>
        ))}

        {STAGES.map((stage) => (
          <g key={stage.name}>
            <rect x={SPINE_X - 3} y={stage.y - 3} width="6" height="6" className="fill-fg" />
            <text
              x={LABEL_X}
              y={stage.y + 4}
              className="fill-fg font-mono text-[12.5px] font-[600]"
              letterSpacing="-0.02em"
            >
              {stage.name}
            </text>
          </g>
        ))}

        {/* The two backward edges, nested so neither crosses the other. */}
        <LoopEdge from={180} x={158} to={132} />
        <LoopEdge from={264} x={186} to={145} />
      </svg>

      <dl className="mt-5 space-y-2 border-t border-rule pt-4">
        {LOOPS.map((loop) => (
          <div key={loop.from} className="flex items-baseline gap-3">
            <span aria-hidden className="mt-[6px] h-[1.25px] w-4 shrink-0 self-start bg-loop" />
            <dt className="sr-only">{loop.from}</dt>
            <dd className="text-[12.5px] leading-[1.5] text-fg-muted">
              <span className="font-mono text-fg">{loop.from}</span> sends work back to the coder on{" "}
              {loop.cause}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
