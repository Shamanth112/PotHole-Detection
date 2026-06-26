/**
 * Tests for the offline report queue.
 *
 * Uses fake-indexeddb (via the `idb` peer dep's test setup) so the tests
 * run in jsdom without a real browser database.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  enqueue,
  listQueued,
  dequeue,
  updateQueued,
  flush,
  type QueuedReport,
} from '../offlineQueue';

describe('offlineQueue', () => {
  beforeEach(async () => {
    // Reset the store between tests so state doesn't leak
    const queued = await listQueued();
    for (const q of queued) await dequeue(q.localId);
  });

  it('enqueue assigns a localId and timestamp', async () => {
    const entry = await enqueue({
      latitude: 12.97,
      longitude: 77.59,
      severity: 'medium',
      address: 'Test St',
    });
    expect(entry.localId).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.createdAt).toBeGreaterThan(0);
    expect(entry.attempts).toBe(0);
  });

  it('listQueued returns entries sorted newest-first', async () => {
    const a = await enqueue({ latitude: 1, longitude: 1, severity: 'low' });
    await new Promise(r => setTimeout(r, 5));
    const b = await enqueue({ latitude: 2, longitude: 2, severity: 'high' });

    const list = await listQueued();
    expect(list).toHaveLength(2);
    expect(list[0]?.localId).toBe(b.localId);
    expect(list[1]?.localId).toBe(a.localId);
  });

  it('dequeue removes an entry', async () => {
    const e = await enqueue({ latitude: 0, longitude: 0, severity: 'low' });
    await dequeue(e.localId);
    const list = await listQueued();
    expect(list).toHaveLength(0);
  });

  it('updateQueued merges the patch', async () => {
    const e = await enqueue({ latitude: 0, longitude: 0, severity: 'low' });
    await updateQueued(e.localId, { attempts: 3, lastError: 'network down' });
    const list = await listQueued();
    const updated = list.find(q => q.localId === e.localId);
    expect(updated?.attempts).toBe(3);
    expect(updated?.lastError).toBe('network down');
  });

  it('flush uploads all queued reports via the handler', async () => {
    await enqueue({ latitude: 1, longitude: 1, severity: 'low' });
    await enqueue({ latitude: 2, longitude: 2, severity: 'high' });

    const handler = vi.fn().mockResolvedValue(undefined);
    const uploaded = await flush(handler);
    expect(uploaded).toBe(2);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await listQueued()).toHaveLength(0);
  });

  it('flush keeps reports that fail and bumps attempts', async () => {
    const e = await enqueue({ latitude: 1, longitude: 1, severity: 'low' });
    const handler = vi.fn().mockRejectedValue(new Error('still offline'));
    const uploaded = await flush(handler);
    expect(uploaded).toBe(0);

    const after = await listQueued();
    expect(after).toHaveLength(1);
    expect(after[0]?.attempts).toBe(1);
    expect(after[0]?.lastError).toBe('still offline');
  });

  it('flush handles partial failure: success removed, failure kept', async () => {
    const e1 = await enqueue({ latitude: 1, longitude: 1, severity: 'low' });
    // Tiny delay so createdAt differs (otherwise order is undefined)
    await new Promise(r => setTimeout(r, 5));
    const e2 = await enqueue({ latitude: 2, longitude: 2, severity: 'high' });

    const handler = vi
      .fn()
      .mockImplementationOnce(async () => {
        /* success for e1 */
      })
      .mockImplementationOnce(async () => {
        throw new Error('upload failed for e2');
      });

    const uploaded = await flush(handler);
    expect(uploaded).toBe(1);

    const after = await listQueued();
    expect(after).toHaveLength(1);
    expect(after[0]?.localId).toBe(e2.localId);
    expect(after[0]?.attempts).toBe(1);
  });

  it('flush skips when navigator.onLine is false', async () => {
    await enqueue({ latitude: 1, longitude: 1, severity: 'low' });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      const handler = vi.fn();
      const uploaded = await flush(handler);
      expect(uploaded).toBe(0);
      expect(handler).not.toHaveBeenCalled();
      // Queue is unchanged
      expect(await listQueued()).toHaveLength(1);
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    }
  });
});
