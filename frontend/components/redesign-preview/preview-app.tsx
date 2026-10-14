"use client";

import { PublicShell, PreviewBar, WorkspaceShell } from "./shell";
import { HomeScreen, PublicContent } from "./marketing";
import { ProjectsScreen, ProjectScreen, RunScreen } from "./workspace";
import { TesterScreen, IntegrationScreen, PublishScreen } from "./api-tools";
import { AuthScreen, ProfileScreen, SettingsScreen } from "./account";
import { AdminScreen } from "./admin";
import { screenGroups } from "./data";
import "./preview.css";

export function RedesignPreview({ screen }: { screen: string }) {
  const known = screenGroups.some(group => group.screens.some(([value]) => value === screen));
  const current = known ? screen : "home";
  let content;
  if (current === "projects") content = <ProjectsScreen />;
  else if (current === "project") content = <ProjectScreen />;
  else if (current.startsWith("run")) content = <RunScreen key={current} live={current === "run/live"} />;
  else if (current === "try") content = <TesterScreen />;
  else if (current === "use") content = <IntegrationScreen />;
  else if (current === "publish") content = <PublishScreen />;
  else if (current === "profile") content = <ProfileScreen />;
  else if (current.startsWith("settings")) content = <SettingsScreen key={current} screen={current} />;
  else if (current.startsWith("admin")) content = <AdminScreen key={current} screen={current} />;
  const auth = ["login", "signup", "forgot-password", "verify", "passkey"].includes(current);
  return <div className="rp"><a className="rp-skip" href="#rp-main">Skip to content</a>{auth ? <><PreviewBar screen={current} /><main id="rp-main"><AuthScreen key={current} screen={current} /></main></> : content ? <WorkspaceShell screen={current}>{content}</WorkspaceShell> : <PublicShell screen={current}>{current === "home" ? <HomeScreen /> : <PublicContent key={current} screen={current} />}</PublicShell>}</div>;
}
