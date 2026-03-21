import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
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
  const [userState, setUserState] = useState<{ uid: string | null; role: string | null }>({
    uid: auth.currentUser?.uid || null,
    role: null
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch role to determine query
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const role = userSnap.exists() ? userSnap.data().role : 'user';
        setUserState({ uid: user.uid, role });
      } else {
        setUserState({ uid: null, role: null });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userState.uid) {
      setPotholes([]);
      setLoading(false);
      return;
    }

    let q;
    // Admins and Municipal users can see all reports
    if (userState.role === 'admin' || userState.role === 'municipal') {
      q = query(
        collection(db, 'potholes'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    } else {
      // Regular users only see their own reports
      // Note: This requires a composite index in Firestore for (userId ASC, timestamp DESC)
      q = query(
        collection(db, 'potholes'),
        where('userId', '==', userState.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    }

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
  }, [userState]);

  return { potholes, loading };
}
