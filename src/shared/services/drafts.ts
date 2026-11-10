// Issue eLC drafts, kept in this browser only (localStorage), for 30 days. Nothing is sent to the server.
import type { ElcForm } from './elcModel';

export interface DraftAttachment { filename: string; mimeType: string; data: string; size: number }

export interface Draft {
  id: string;
  savedAt: string;
  origin: 'manual' | 'import';
  form: ElcForm;
  attachments: DraftAttachment[];
  embedPdf: boolean;
}

const KEY = 'alpha-portal:drafts';
export const DRAFT_DAYS = 30;

function readAll(): Draft[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Draft[];
    const cutoff = Date.now() - DRAFT_DAYS * 86400_000;
    return Array.isArray(all) ? all.filter((d) => Date.parse(d.savedAt) > cutoff) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Draft[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Saved drafts, newest first. Drafts older than 30 days are dropped. */
export function listDrafts(): Draft[] {
  const list = readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  try { writeAll(list); } catch { /* ignore */ }
  return list;
}

export const getDraft = (id: string) => readAll().find((d) => d.id === id) ?? null;

/**
 * Saves (or updates) a draft. If the browser's storage is full, it retries without attachments.
 * Returns the saved draft and whether attachments had to be left out.
 */
export function saveDraft(d: Omit<Draft, 'id' | 'savedAt'> & { id?: string }): { draft: Draft; withoutAttachments: boolean } {
  const draft: Draft = { ...d, id: d.id ?? crypto.randomUUID(), savedAt: new Date().toISOString() };
  const others = readAll().filter((x) => x.id !== draft.id);
  try {
    writeAll([draft, ...others]);
    return { draft, withoutAttachments: false };
  } catch {
    const slim = { ...draft, attachments: [] };
    try {
      writeAll([slim, ...others]);
      return { draft: slim, withoutAttachments: draft.attachments.length > 0 };
    } catch {
      throw new Error("This browser's storage is full or blocked, so the draft could not be saved.");
    }
  }
}

export function deleteDraft(id: string) {
  try { writeAll(readAll().filter((d) => d.id !== id)); } catch { /* ignore */ }
}

/** "today, 09:12" · "yesterday, 16:40" · "7 Nov, 11:05" */
export function draftTime(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => x.toDateString();
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400_000);
  if (day(d) === day(today)) return `today, ${time}`;
  if (day(d) === day(yesterday)) return `yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}
