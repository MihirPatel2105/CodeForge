"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, CheckCheck, TerminalSquare, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { TestsSnapshot } from "@/lib/run-reducer";
import "./run-dashboard.css";

export function EvidenceWorkbench({ code, timeline, terminal, tests, result, navigationRequest, problems, problemCount = 0 }: {
  code: ReactNode;
  timeline: ReactNode;
  terminal: ReactNode;
  tests: ReactNode;
  result: TestsSnapshot | null;
  navigationRequest?: number;
  problems?: ReactNode;
  problemCount?: number;
}) {
  const [view, setView] = useState("timeline");
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigationRequest) codeRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [navigationRequest]);

  return (
    <ResizablePanelGroup orientation="vertical" className="cf-evidence-workbench" style={{ height: 960 }}>
      <ResizablePanel id="code-evidence" defaultSize="60%" minSize="360px">
      <div ref={codeRef} className="cf-workbench-editor" data-lenis-prevent role="region" aria-label="Generated code">{code}</div>
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="Resize code and execution panels" />
      <ResizablePanel id="execution-evidence" minSize="250px">
      <section className="cf-workbench-console" aria-label="Execution details">
        <Tabs value={view} onValueChange={value => setView(String(value))}>
          <div className="cf-workbench-console-heading">
            <TabsList activateOnFocus variant="line" aria-label="Run evidence">
              {problems && <TabsTrigger value="problems"><ListChecks aria-hidden />Problems<span className="cf-problem-count">{problemCount}</span></TabsTrigger>}
              <TabsTrigger value="timeline"><Activity aria-hidden />Timeline</TabsTrigger>
              <TabsTrigger value="terminal"><TerminalSquare aria-hidden />Sandbox</TabsTrigger>
              <TabsTrigger value="tests"><CheckCheck aria-hidden />Tests</TabsTrigger>
            </TabsList>
            <span className="cf-workbench-test-summary" data-outcome={result ? result.failed ? "failed" : "passed" : "waiting"} role="status" aria-label="Test summary">
              <span aria-hidden />{result ? `${result.passed}/${result.total} tests passed` : "Tests pending"}
            </span>
          </div>
          {problems && <TabsContent value="problems" hidden={view !== "problems"} keepMounted className="cf-workbench-console-panel" data-lenis-prevent>{problems}</TabsContent>}
          <TabsContent value="timeline" hidden={view !== "timeline"} keepMounted className="cf-workbench-console-panel" data-lenis-prevent>{timeline}</TabsContent>
          <TabsContent value="terminal" hidden={view !== "terminal"} keepMounted className="cf-workbench-console-panel" data-lenis-prevent>{terminal}</TabsContent>
          <TabsContent value="tests" hidden={view !== "tests"} keepMounted className="cf-workbench-console-panel" data-lenis-prevent>{tests}</TabsContent>
        </Tabs>
      </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
