import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let model: cocoSsd.ObjectDetection | null = null;

export async function loadModel() {
  if (!model) {
    await tf.ready();
    model = await cocoSsd.load({
      base: 'mobilenet_v2'
    });
  }
  return model;
}

export interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export async function detectPotholes(video: HTMLVideoElement): Promise<Detection[]> {
  if (!model) return [];
  
  const predictions = await model.detect(video);
  
  // In a real app, we'd use a custom model trained specifically for potholes.
  // For this demo, we'll simulate pothole detection by looking for specific objects 
  // or just returning the predictions.
  // We'll filter for objects that might look like potholes or just use "pothole" if we had a custom model.
  return predictions.map(p => ({
    bbox: p.bbox as [number, number, number, number],
    class: p.class === 'bowl' ? 'pothole' : p.class, // Mocking 'bowl' as 'pothole' for demo
    score: p.score
  }));
}
