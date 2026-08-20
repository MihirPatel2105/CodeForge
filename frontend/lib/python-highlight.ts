/**
 * A small tokeniser over Python (design_handoff/README.md "Code and output"): strings,
 * comments, decorators, numbers, keywords, and identifiers immediately followed by `(`.
 * Good enough for the generated app's four files; not a general Python parser.
 */

export type CodeTokenClass = "kw" | "str" | "com" | "fn" | "num" | null;

export interface CodeToken {
  text: string;
  cls: CodeTokenClass;
}

const KEYWORDS = new Set([
  "def", "async", "await", "class", "import", "from", "return", "if", "elif", "else",
  "raise", "not", "in", "is", "None", "True", "False", "and", "or", "try", "except",
  "finally", "with", "as", "pass", "for", "while", "lambda",
]);

const MASTER = new RegExp(
  [
    "(#.*$)", // comment
    String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`, // string
    String.raw`(@\w+)`, // decorator
    String.raw`(\b\d+\.?\d*\b)`, // number
    String.raw`(\b[A-Za-z_]\w*\b(?=\())`, // fn call / def name
    String.raw`(\b(?:${[...KEYWORDS].join("|")})\b)`, // keyword
  ].join("|"),
  "gm",
);

export function tokenizePythonLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  for (const match of line.matchAll(MASTER)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: line.slice(last, index), cls: null });
    const [, comment, str, decorator, num, fnName, kw] = match;
    const cls: CodeTokenClass = comment
      ? "com"
      : str
        ? "str"
        : decorator
          ? "fn"
          : num
            ? "num"
            : fnName
              ? "fn"
              : kw
                ? "kw"
                : null;
    tokens.push({ text: match[0], cls });
    last = index + match[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), cls: null });
  return tokens;
}
