import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  status: 'reported' | 'verified' | 'fixing' | 'resolved';
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

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setUserState({ uid: user.id, role: profile?.role || 'citizen' });
      } else {
        setUserState({ uid: null, role: null });
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setUserState({ uid: session.user.id, role: profile?.role || 'citizen' });
      } else {
        setUserState({ uid: null, role: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userState.uid) {
      setPotholes([]);
      setLoading(false);
      return;
    }

    const fetchPotholes = async () => {
      let query = supabase
        .from('potholes')
        .select('*')
        .order('timestamp', { ascending: false })
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

    // Set up real-time subscription
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
