import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export interface Pothole {
  _id: string;
  userId?: string;
  userName?: string;
  latitude: number;
  longitude: number;
  address?: string;
  severity: 'low' | 'medium' | 'high';
  status: 'reported' | 'verified' | 'fixing' | 'in-progress' | 'resolved' | 'dismissed';
  reportImageId?: string;
  resolvedImageId?: string;
  reportImageUrl?: string;
  resolvedImageUrl?: string;
  _creationTime: number;
}

/**
 * Returns potholes reactive via Convex useQuery.
 * - Citizens see only their own (enforced server-side).
 * - Admin/Municipal see all.
 * Automatically re-renders whenever the data changes — no subscriptions needed.
 */
export function usePotholes() {
  const potholes = useQuery(api.potholes.list) ?? [];
  const loading = potholes === undefined;
  return { potholes, loading };
}
