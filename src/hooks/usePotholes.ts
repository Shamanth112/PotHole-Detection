import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: any;
  severity: 'low' | 'medium' | 'high';
  imageUrl?: string;
  userId: string;
  userName?: string;
  address?: string;
}

export function usePotholes() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      console.error("Error fetching potholes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { potholes, loading };
}
