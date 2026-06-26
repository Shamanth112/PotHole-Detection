/**
 * Geographic utility functions.
 *
 * Extracted from CameraView.tsx so it can be unit-tested in isolation and
 * reused anywhere we need to compare GPS coordinates (e.g. clustering nearby
 * reports, deduplicating auto-detections).
 */

/** A WGS-84 lat/lng point. */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

/**
 * Great-circle distance between two GPS points using the Haversine formula.
 *
 * Returns meters between the two points. Accuracy is within ~0.5% — fine for
 * the "is this report within X meters of an existing one?" check we do in
 * the AI scanner's de-duplication loop.
 */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/** True if `b` is within `radiusMeters` of `a`. */
export function withinRadius(a: LatLng, b: LatLng, radiusMeters: number): boolean {
  return haversineMetres(a, b) <= radiusMeters;
}