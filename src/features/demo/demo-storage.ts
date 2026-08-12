import { clearVotes } from "@/features/consultation/consultation-storage";
import { clearWorkflowPractice } from "@/features/demo/workflow/workflow-storage";

export const DEMO_STEP_KEY = "ostt-demo-step";
export const DEMO_NOTES_KEY = "ostt-demo-presenter-notes";
export const CEDAR_TOPIC_ID = "topic-cedar-river-drought-surcharge";

export type DemoClientState = {
  step: number;
  notesVisible: boolean;
};

const listeners = new Set<() => void>();
let cachedClientState: DemoClientState | null = null;
const serverSnapshot: DemoClientState = { step: 0, notesVisible: false };

function emit() {
  cachedClientState = null;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeDemoState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDemoStep(maxIndex: number): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.sessionStorage.getItem(DEMO_STEP_KEY);
  const parsed = raw == null ? 0 : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(parsed, maxIndex);
}

export function writeDemoStep(step: number): void {
  const next = String(step);
  if (window.sessionStorage.getItem(DEMO_STEP_KEY) === next) {
    return;
  }
  window.sessionStorage.setItem(DEMO_STEP_KEY, next);
  emit();
}

export function readPresenterNotesVisible(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(DEMO_NOTES_KEY) === "1";
}

export function writePresenterNotesVisible(visible: boolean): void {
  const next = visible ? "1" : "0";
  if (window.sessionStorage.getItem(DEMO_NOTES_KEY) === next) {
    return;
  }
  window.sessionStorage.setItem(DEMO_NOTES_KEY, next);
  emit();
}

export function getDemoClientState(maxIndex: number): DemoClientState {
  const next: DemoClientState = {
    step: readDemoStep(maxIndex),
    notesVisible: readPresenterNotesVisible(),
  };
  if (
    cachedClientState &&
    cachedClientState.step === next.step &&
    cachedClientState.notesVisible === next.notesVisible
  ) {
    return cachedClientState;
  }
  cachedClientState = next;
  return cachedClientState;
}

export function getServerDemoClientState(): DemoClientState {
  return serverSnapshot;
}

export function resetDemoClientState(): void {
  window.sessionStorage.removeItem(DEMO_STEP_KEY);
  window.sessionStorage.removeItem(DEMO_NOTES_KEY);
  clearVotes(CEDAR_TOPIC_ID);
  clearWorkflowPractice();
  emit();
}
