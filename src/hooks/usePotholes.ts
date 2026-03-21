import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { dbService, Pothole } from '../services/databaseService';

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
        try {
          const profile = await dbService.getUserProfile(user.uid);
          setUserState({ uid: user.uid, role: profile?.role || 'user' });
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserState({ uid: user.uid, role: 'user' });
        }
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

    const fetchPotholes = async () => {
      try {
        let data;
        if (userState.role === 'admin' || userState.role === 'municipal') {
          data = await dbService.getPotholes();
        } else {
          data = await dbService.getPotholesByUser(userState.uid!);
        }
        setPotholes(data);
      } catch (error) {
        console.error("Error fetching potholes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPotholes();

    // Subscribe to changes
    const subscription = dbService.subscribeToPotholes((updatedPotholes) => {
      if (userState.role === 'admin' || userState.role === 'municipal') {
        setPotholes(updatedPotholes);
      } else {
        setPotholes(updatedPotholes.filter(p => p.userId === userState.uid));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userState]);

  return { potholes, loading };
}
