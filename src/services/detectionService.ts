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
  // that might be used as stand-ins during testing (bowl, cell phone, cup).
  const mockPotholeClasses = ['bowl', 'cell phone', 'cup', 'donut'];
  
  return predictions.map(p => ({
    bbox: p.bbox as [number, number, number, number],
    class: mockPotholeClasses.includes(p.class) ? 'pothole' : p.class,
    score: p.score
  }));
}
