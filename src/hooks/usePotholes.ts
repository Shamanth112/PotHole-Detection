import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: any;
  severity: 'low' | 'medium' | 'high';
  status: 'reported' | 'verified' | 'fixing' | 'resolved';
  reportImageUrl?: string;
  resolvedImageUrl?: string;
  userId: string;
  userName?: string;
  address?: string;
}

export function usePotholes() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setPotholes([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'potholes'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pothole[];
      setPotholes(data);
      setLoading(false);
    }, (error) => {
      // Only log if it's not a permission error while logging out
      if (error.code !== 'permission-denied') {
        console.error("Error fetching potholes:", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  return { potholes, loading };
}
