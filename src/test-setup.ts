// Vitest setup: stub browser APIs that detectionService / offlineQueue rely on.

// Minimal IDB-like stub for offlineQueue tests
if (typeof globalThis.indexedDB === 'undefined') {
  // @ts-expect-error - test stub
  globalThis.indexedDB = undefined;
}