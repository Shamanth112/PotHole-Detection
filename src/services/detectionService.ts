import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let model: cocoSsd.ObjectDetection | null = null;

export async function loadModel() {
  if (!model) {
    await tf.ready();
    // lite_mobilenet_v2 is ~3x faster than mobilenet_v2 with only marginal accuracy drop
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  }
  return model;
}

export interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

// Objects that act as pothole stand-ins in demo/simulation mode
const MOCK_POTHOLE_CLASSES = new Set([
  'bowl', 'cell phone', 'cup', 'donut', 'bottle',
  'remote', 'mouse', 'banana', 'apple', 'orange', 'frisbee'
]);

// Minimum confidence for a detection to be reported
const MIN_SCORE = 0.45;

// Simple exponential smoothing for bounding boxes (prevents jitter)
const smoothedBoxes = new Map<string, [number, number, number, number]>();
const SMOOTH_ALPHA = 0.35; // 0 = no update, 1 = no smoothing

function lerpBox(
  prev: [number, number, number, number],
  next: [number, number, number, number]
): [number, number, number, number] {
  return [
    prev[0] + (next[0] - prev[0]) * SMOOTH_ALPHA,
    prev[1] + (next[1] - prev[1]) * SMOOTH_ALPHA,
    prev[2] + (next[2] - prev[2]) * SMOOTH_ALPHA,
    prev[3] + (next[3] - prev[3]) * SMOOTH_ALPHA,
  ];
}

export async function detectPotholes(video: HTMLVideoElement): Promise<Detection[]> {
  if (!model) return [];

  const predictions = await model.detect(video, undefined, MIN_SCORE);

  // Map detections — remap mock classes → 'pothole'
  const results: Detection[] = predictions.map(p => {
    const isPothole = MOCK_POTHOLE_CLASSES.has(p.class);
    const key = `${p.class}_${Math.round(p.bbox[0] / 50)}_${Math.round(p.bbox[1] / 50)}`;

    // Smooth the bounding box position
    const rawBox = p.bbox as [number, number, number, number];
    const prev = smoothedBoxes.get(key);
    const smoothed = prev ? lerpBox(prev, rawBox) : rawBox;
    smoothedBoxes.set(key, smoothed);

    return {
      bbox: smoothed,
      class: isPothole ? 'pothole' : p.class,
      score: p.score,
    };
  });

  // Clean up stale tracked boxes (boxes not seen this frame)
  const activeKeys = new Set(
    predictions.map(p =>
      `${p.class}_${Math.round(p.bbox[0] / 50)}_${Math.round(p.bbox[1] / 50)}`
    )
  );
  for (const key of smoothedBoxes.keys()) {
    if (!activeKeys.has(key)) smoothedBoxes.delete(key);
  }

  return results;
}
