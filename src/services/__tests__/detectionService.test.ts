import { describe, it, expect } from 'vitest';
import { iou, nms } from '../detectionService';

describe('iou (Intersection over Union)', () => {
  it('returns 1 for identical boxes', () => {
    const a: [number, number, number, number] = [0, 0, 10, 10];
    expect(iou(a, a)).toBeCloseTo(1, 5);
  });

  it('returns 0 for non-overlapping boxes', () => {
    const a: [number, number, number, number] = [0, 0, 5, 5];
    const b: [number, number, number, number] = [10, 10, 15, 15];
    expect(iou(a, b)).toBe(0);
  });

  it('returns ~0.25 for boxes overlapping by half on one axis', () => {
    // a: [0,0,10,10], b: [5,0,15,10]
    // intersection: 5*10 = 50
    // aArea: 100, bArea: 100, union: 150 → IoU = 50/150 = 0.333...
    const a: [number, number, number, number] = [0, 0, 10, 10];
    const b: [number, number, number, number] = [5, 0, 15, 10];
    expect(iou(a, b)).toBeCloseTo(50 / 150, 4);
  });

  it('treats touching edges as zero overlap', () => {
    const a: [number, number, number, number] = [0, 0, 5, 5];
    const b: [number, number, number, number] = [5, 0, 10, 5];
    expect(iou(a, b)).toBe(0);
  });
});

describe('nms (Non-Maximum Suppression)', () => {
  it('keeps a single box unchanged', () => {
    const boxes: [number, number, number, number][] = [[0, 0, 10, 10]];
    const scores = [0.9];
    expect(nms(boxes, scores, 0.5)).toEqual([0]);
  });

  it('keeps the higher-scoring box of a highly-overlapping pair', () => {
    // Two nearly identical boxes; lower score should be suppressed.
    const boxes: [number, number, number, number][] = [
      [0, 0, 10, 10],
      [1, 1, 11, 11], // IoU with [0] is high
    ];
    const scores = [0.5, 0.9];
    const kept = nms(boxes, scores, 0.5);
    expect(kept).toEqual([1]); // index 1 wins, index 0 suppressed
  });

  it('keeps both when IoU is below threshold', () => {
    const boxes: [number, number, number, number][] = [
      [0, 0, 10, 10],
      [20, 20, 30, 30],
    ];
    const scores = [0.7, 0.9];
    const kept = nms(boxes, scores, 0.5);
    expect(kept.sort()).toEqual([0, 1]);
  });

  it('returns indices sorted by score', () => {
    // Sort happens before suppression, so output indices reflect the original
    // index of each surviving box.
    const boxes: [number, number, number, number][] = [
      [0, 0, 10, 10],   // index 0, score 0.5
      [100, 100, 110, 110], // index 1, score 0.9
    ];
    const scores = [0.5, 0.9];
    expect(nms(boxes, scores, 0.5)).toEqual([1, 0]);
  });

  it('handles an empty input', () => {
    expect(nms([], [], 0.5)).toEqual([]);
  });
});