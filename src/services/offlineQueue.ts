/**
 * Offline report queue.
 *
 * When the user submits a pothole report while offline, we can't reach the
 * Convex backend. Instead of failing and losing the report, we persist it
 * to IndexedDB. A background "flush" pass (called on app start and on the
 * `online` event) tries to upload pending reports.
 *
 * Reports are stored with their original photo as a Blob so we can
 * re-upload through the same `uploadToConvex` path the live form uses.
 *
 * No third-party dep — uses raw IndexedDB with a small promise wrapper.
 */

import type { Id } from '../../convex/_generated/dataModel';

export interface QueuedReport {
  /** Local UUID so we can dedupe and track without server cooperation. */
  localId: string;
  createdAt: number;
  latitude: number;
  longitude: number;
  severity: 'low' | 'medium' | 'high';
  address?: string;
  userName?: string;
  /** Original photo blob, re-uploaded on flush. */
  photoBlob?: Blob;
  photoFileName?: string;
  /** How many times we've tried to upload this report. */
  attempts: number;
  /** Last error message if any. */
  lastError?: string;
}

const DB_NAME = 'roadguard-offline';
const DB_VERSION = 1;
const STORE_NAME = 'queued-reports';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Add a report to the offline queue. */
export async function enqueue(report: Omit<QueuedReport, 'localId' | 'createdAt' | 'attempts'>): Promise<QueuedReport> {
  const entry: QueuedReport = {
    ...report,
    localId: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return entry;
}

/** List all queued reports, newest first. */
export async function listQueued(): Promise<QueuedReport[]> {
  const db = await openDb();
  return new Promise<QueuedReport[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = (req.result as QueuedReport[]).slice();
      all.sort((a, b) => b.createdAt - a.createdAt);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Remove a report from the queue (typically after a successful upload). */
export async function dequeue(localId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update an existing queued report (e.g. bump attempts after a failed flush). */
export async function updateQueued(localId: string, patch: Partial<QueuedReport>): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(localId);
    req.onsuccess = () => {
      const existing = req.result as QueuedReport | undefined;
      if (!existing) {
        resolve();
        return;
      }
      store.put({ ...existing, ...patch, localId });
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export type FlushHandler = (report: QueuedReport) => Promise<Id<'potholes'> | void>;

/**
 * Try to upload every queued report. Calls `handler` for each; on success the
 * report is removed from the queue, on failure its `attempts` is bumped.
 *
 * Returns the number of reports successfully uploaded.
 */
export async function flush(handler: FlushHandler): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 0;
  }
  // Flush oldest-first so users see their earliest queued report go through
  // first. `listQueued()` returns newest-first, so reverse before iterating.
  const queued = (await listQueued()).slice().reverse();
  let uploaded = 0;
  for (const report of queued) {
    try {
      await handler(report);
      await dequeue(report.localId);
      uploaded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateQueued(report.localId, {
        attempts: report.attempts + 1,
        lastError: message,
      });
    }
  }
  return uploaded;
}
