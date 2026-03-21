import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  status: 'reported' | 'verified' | 'fixing' | 'resolved';
  reportImageUrl?: string;
  resolvedImageUrl?: string;
  userId: string;
  userName?: string;
  address?: string;
  notes?: string;
}

export function usePotholes() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [userState, setUserState] = useState<{ uid: string | null; role: string | null }>({
    uid: null,
    role: null
  });

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserState({ uid: null, role: null });
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserState({ uid: null, role: null });
        setPotholes([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('uid', uid)
        .single();
      
      const role = data?.role || 'user';
      setUserState({ uid, role });
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserState({ uid, role: 'user' });
    }
  };

  useEffect(() => {
    if (!userState.uid) return;

    const fetchPotholes = async () => {
      let query = supabase
        .from('potholes')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      // Regular users only see their own reports
      if (userState.role !== 'admin' && userState.role !== 'municipal') {
        query = query.eq('userId', userState.uid);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching potholes:", error);
      } else {
        setPotholes(data as Pothole[]);
      }
      setLoading(false);
    };

    fetchPotholes();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('potholes-changes')
      .on('postgres_changes', { event: '*', table: 'potholes', schema: 'public' }, () => {
        fetchPotholes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userState]);

  return { potholes, loading };
}
