import { describe, it, expect } from 'vitest';
import { haversineMetres, withinRadius } from '../geo';

describe('haversineMetres', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 12.97, lng: 77.59 }; // Bangalore
    expect(haversineMetres(p, p)).toBe(0);
  });

  it('matches a known city-pair distance within 1%', () => {
    // New York → London ≈ 5,570 km (great-circle)
    const nyc = { lat: 40.7128, lng: -74.006 };
    const london = { lat: 51.5074, lng: -0.1278 };
    const d = haversineMetres(nyc, london);
    expect(d).toBeGreaterThan(5_500_000);
    expect(d).toBeLessThan(5_600_000);
  });

  it('is symmetric: distance(a, b) === distance(b, a)', () => {
    const a = { lat: 12.97, lng: 77.59 };
    const b = { lat: 13.05, lng: 77.62 };
    expect(haversineMetres(a, b)).toBeCloseTo(haversineMetres(b, a), 6);
  });

  it('handles the antipode (~half Earth circumference)', () => {
    // Two antipodal points: distance should be ~half the circumference
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 180 };
    const d = haversineMetres(a, b);
    // π × R ≈ 20,015 km
    expect(d).toBeGreaterThan(20_000_000);
    expect(d).toBeLessThan(20_040_000);
  });
});

describe('withinRadius', () => {
  it('returns true for points inside the radius', () => {
    const here = { lat: 12.97, lng: 77.59 };
    const nearby = { lat: 12.9701, lng: 77.5901 }; // ~13m away
    expect(withinRadius(here, nearby, 50)).toBe(true);
  });

  it('returns false for points outside the radius', () => {
    const here = { lat: 12.97, lng: 77.59 };
    const far = { lat: 12.99, lng: 77.62 }; // ~4km away
    expect(withinRadius(here, far, 1000)).toBe(false);
  });

  it('boundary: a point exactly at the radius is within', () => {
    const here = { lat: 0, lng: 0 };
    const oneMeterEast = { lat: 0, lng: 0.00000898 }; // ~1m at equator
    // within 1m should be true (boundary inclusive)
    expect(withinRadius(here, oneMeterEast, 2)).toBe(true);
  });
});