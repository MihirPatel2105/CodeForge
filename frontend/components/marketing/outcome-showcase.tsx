"use client";

import { useState } from "react";
import { Archive, Check, Code2, FileCode2, FlaskConical, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenizePythonLine } from "@/lib/python-highlight";

const DELIVERABLES = [
  {
    icon: Code2,
    index: "01",
    title: "Generated source",
    body: "Open every file, inspect the syntax-highlighted code, and follow what changed between passes.",
    detail: "5 files",
  },
  {
    icon: ShieldCheck,
    index: "02",
    title: "Review evidence",
    body: "See each finding, its severity, the affected file, and the focused repair sent back to the Coder.",
    detail: "fixed checklist",
  },
  {
    icon: FlaskConical,
    index: "03",
    title: "Runtime proof",
    body: "Read the actual sandbox output and the test result produced by the running application.",
    detail: "8 / 8 passed",
  },
  {
    icon: Archive,
    index: "04",
    title: "Portable project",
    body: "Keep the complete source tree and test suite as a downloadable project you can continue building.",
    detail: "download .zip",
  },
] as const;

type CodeLine = {
  value: string;
};

const TOKEN_CLASS: Record<string, string> = {
  kw: "text-code-kw",
  str: "text-code-str",
  com: "text-code-com",
  fn: "text-code-fn",
  num: "text-code-num",
};

const FILES: Array<{
  name: string;
  bytes: string;
  status: "updated" | "new";
  lines: CodeLine[];
}> = [
  {
    name: "database.py",
    bytes: "289 bytes",
    status: "updated",
    lines: [
      { value: "from beanie import init_beanie" },
      { value: "from motor.motor_asyncio import AsyncIOMotorClient" },
      { value: "from models import Book" },
      { value: "" },
      { value: "async def connect_database():" },
      { value: '    client = AsyncIOMotorClient(\"mongodb://db:27017\")' },
      { value: "    await init_beanie(" },
      { value: "        database=client.library, document_models=[Book]" },
    ],
  },
  {
    name: "models.py",
    bytes: "542 bytes",
    status: "updated",
    lines: [
      { value: "from beanie import Document" },
      { value: "from pydantic import Field" },
      { value: "" },
      { value: "class Book(Document):" },
      { value: "    title: str" },
      { value: "    author: str" },
      { value: "    isbn: str = Field(unique=True)" },
      { value: "    genre: str | None = None" },
    ],
  },
  {
    name: "schemas.py",
    bytes: "604 bytes",
    status: "updated",
    lines: [
      { value: "from pydantic import BaseModel, Field" },
      { value: "" },
      { value: "class BookCreate(BaseModel):" },
      { value: "    title: str = Field(min_length=1)" },
      { value: "    author: str = Field(min_length=1)" },
      { value: "    isbn: str" },
      { value: "    genre: str | None = None" },
      { value: "    read: bool = False" },
    ],
  },
  {
    name: "main.py",
    bytes: "2,318 bytes",
    status: "updated",
    lines: [
      { value: "from fastapi import FastAPI" },
      { value: "from models import Book" },
      { value: "" },
      { value: "app = FastAPI()" },
      { value: "" },
      { value: '@app.get(\"/books\")' },
      { value: "async def list_books():" },
      { value: "    return await Book.find_all().to_list()" },
    ],
  },
  {
    name: "test_main.py",
    bytes: "1,106 bytes",
    status: "new",
    lines: [
      { value: "from fastapi.testclient import TestClient" },
      { value: "from main import app" },
      { value: "" },
      { value: "client = TestClient(app)" },
      { value: "" },
      { value: "def test_list_books():" },
      { value: '    response = client.get(\"/books\")' },
      { value: "    assert response.status_code == 200" },
    ],
  },
];

export function OutcomeShowcase() {
  const [activeFileName, setActiveFileName] = useState("main.py");
  const activeFile =
    FILES.find((file) => file.name === activeFileName) ?? FILES[0];

  return (
    <section id="outcome" className="cf-home-outcome border-b border-rule">
      <div className="mx-auto w-full max-w-[1536px] px-6 py-20 md:px-10 md:py-24 lg:px-14">
        <div className="grid gap-x-14 gap-y-5 lg:grid-cols-[11rem_1fr]">
          <span className="font-mono text-[11px] font-[600] uppercase tracking-[0.16em] text-fg-faint">
            [ what you keep ]
          </span>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <h2 className="font-display max-w-[19ch] text-[27px] font-[650] leading-[1.2] tracking-[-0.045em] text-fg md:text-[34px]">
              The result stays inspectable after the agents finish.
            </h2>
            <p className="max-w-[49ch] text-[15px] leading-[1.65] text-fg-muted">
              CodeForge keeps the implementation, decisions, test output and final
              artifact together. You can see why the run succeeded before using its code.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)]">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_28px_70px_rgba(34,48,78,0.11),0_3px_12px_rgba(34,48,78,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-bd bg-ok-soft px-2.5 py-1 text-[11px] font-[650] text-ok">
                  <Check className="h-3 w-3" aria-hidden />
                  Run complete
                </span>
                <span className="text-[11px] text-fg-muted">Ready to inspect</span>
              </div>
              <span className="font-mono text-[11px] text-fg-faint">library-api / run_01</span>
            </div>

            <div className="grid min-h-[350px] sm:grid-cols-[10.5rem_minmax(0,1fr)]">
              <div className="min-w-0 border-b border-rule bg-[#f7f9fd] px-3 py-4 sm:border-b-0 sm:border-r">
                <span className="px-2 text-[11px] font-[650] text-fg-muted">Generated files</span>
                <ul className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-1">
                  {FILES.map((file) => {
                    const selected = file.name === activeFile.name;
                    return (
                      <li key={file.name}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setActiveFileName(file.name)}
                          className={cn(
                            "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left font-mono text-[11px] transition-[border-color,background-color,color,box-shadow]",
                            selected
                              ? "border-accent-bd bg-white font-[700] text-accent shadow-[0_2px_9px_rgba(35,50,81,0.07)]"
                              : "border-transparent text-fg-muted hover:border-border hover:bg-white/70 hover:text-fg",
                          )}
                        >
                          <span className="truncate">{file.name}</span>
                          {file.status === "new" && (
                            <span className="rounded-full bg-ok-soft px-1.5 py-0.5 text-[9px] font-[700] text-ok">
                              new
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex min-w-0 flex-col bg-code-bg">
                <div className="flex items-center justify-between gap-3 border-b border-rule bg-white px-4 py-3">
                  <span className="inline-flex min-w-0 items-center gap-2 font-mono text-[12px] font-[650] text-fg">
                    <FileCode2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    <span className="truncate">{activeFile.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-fg-faint">{activeFile.bytes}</span>
                </div>
                <ol
                  key={activeFile.name}
                  className="min-h-[260px] flex-1 overflow-x-auto px-4 py-5 font-mono text-[11.5px] leading-[1.85] motion-safe:animate-[cfFade_.2s_ease-out]"
                >
                  {activeFile.lines.map((line, index) => (
                    <li key={activeFile.name + "-" + index} className="flex min-w-max gap-4">
                      <span className="w-5 shrink-0 select-none text-right text-code-com">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-code-fg">
                        {tokenizePythonLine(line.value).map((token, tokenIndex) => (
                          <span key={tokenIndex} className={token.cls ? TOKEN_CLASS[token.cls] : undefined}>{token.text}</span>
                        ))}
                        {line.value.length === 0 && " "}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-ok-soft/55 px-4 py-3">
                  <span className="text-[11px] font-[650] text-fg-muted">Sandbox output</span>
                  <span className="inline-flex items-center gap-2 text-[12px] font-[650] text-ok">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
                    8 passed in 1.42s
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {DELIVERABLES.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="cf-home-deliverable group grid grid-cols-[auto_1fr_auto] gap-x-4 rounded-xl border border-border bg-surface/82 px-5 py-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-accent-bd hover:shadow-[0_16px_40px_rgba(22,24,28,0.06)]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-bg text-accent">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="font-display text-[15px] font-[700] tracking-[-0.025em] text-fg">
                        {item.title}
                      </h3>
                      <span className="font-mono text-[8px] font-[700] uppercase tracking-[0.1em] text-fg-faint">
                        {item.detail}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-[54ch] text-[12.5px] leading-[1.5] text-fg-muted">
                      {item.body}
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-[700] text-fg-faint transition-colors group-hover:text-accent">
                    {item.index}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
