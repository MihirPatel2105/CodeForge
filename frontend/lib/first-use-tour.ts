"use client";

import { useCallback, useEffect, useState } from "react";

export type TourStep = "projects" | "create" | "open" | "prompt" | "start" | "run";

const STEPS: TourStep[] = ["projects", "create", "open", "prompt", "start", "run"];
const EVENT = "codeforge:first-use-tour";

function key(email: string) {
  return `codeforge:first-use:v1:${email.trim().toLowerCase()}`;
}

function projectKey(email: string) {
  return `${key(email)}:project`;
}

export function getTourStep(email: string | null | undefined): TourStep | null {
  if (!email || typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(key(email));
    return STEPS.includes(value as TourStep) ? value as TourStep : null;
  } catch {
    return null;
  }
}

export function getTourProject(email: string | null | undefined): string | null {
  if (!email || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(projectKey(email));
  } catch {
    return null;
  }
}

export function setTourStep(email: string, step: TourStep, projectId?: string) {
  try {
    localStorage.setItem(key(email), step);
    if (projectId) localStorage.setItem(projectKey(email), projectId);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage may be unavailable; the rest of signup and project creation still work.
  }
}

export function finishTour(email: string) {
  try {
    localStorage.setItem(key(email), "done");
    localStorage.removeItem(projectKey(email));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // The tour is optional and must not block product actions.
  }
}

export function useFirstUseTour(email: string | null | undefined) {
  const [step, setStep] = useState<TourStep | null>(null);

  useEffect(() => {
    const sync = () => setStep(getTourStep(email));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [email]);

  const advance = useCallback((next: TourStep, projectId?: string) => {
    if (email) setTourStep(email, next, projectId);
  }, [email]);

  const finish = useCallback(() => {
    if (email) finishTour(email);
  }, [email]);

  return { step, advance, finish };
}
