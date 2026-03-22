import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  created_at: string;
  timestamp?: string; // legacy support
  severity: 'low' | 'medium' | 'high';
  status: 'reported' | 'verified' | 'fixing' | 'in-progress' | 'resolved' | 'dismissed';
  report_image_url?: string;
  resolved_image_url?: string;
  user_id: string;
  user_name?: string;
  address?: string;
}

export function usePotholes() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [userState, setUserState] = useState<{ uid: string | null; role: string | null }>({
    uid: null,
    role: null
  });

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', firebaseUser.uid)
          .single();
        setUserState({ uid: firebaseUser.uid, role: profile?.role || 'citizen' });
      } else {
        setUserState({ uid: null, role: null });
        setPotholes([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userState.uid) {
      setLoading(false);
      return;
    }

    const fetchPotholes = async () => {
      let query = supabase
        .from('potholes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (userState.role !== 'admin' && userState.role !== 'municipal') {
        query = query.eq('user_id', userState.uid);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching potholes:", error);
      } else {
        setPotholes(data || []);
      }
      setLoading(false);
    };

    fetchPotholes();

    const channel = supabase
      .channel('potholes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'potholes',
          filter: userState.role !== 'admin' && userState.role !== 'municipal'
            ? `user_id=eq.${userState.uid}`
            : undefined
        },
        () => {
          fetchPotholes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userState]);

  return { potholes, loading };
}
