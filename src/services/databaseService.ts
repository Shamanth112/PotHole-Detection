import { supabase } from '../supabase';

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high';
  reportImageUrl?: string;
  resolvedImageUrl?: string;
  userId: string;
  userName?: string;
  address?: string;
  status?: 'reported' | 'verified' | 'fixing' | 'resolved';
  notes?: string;
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  email: string;
  photoURL?: string;
  role: 'user' | 'admin' | 'municipal';
}

export interface PermittedUser {
  email: string;
  role: 'user' | 'admin' | 'municipal';
}

export const dbService = {
  // Potholes
  async getPotholes() {
    const { data, error } = await supabase
      .from('potholes')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data as Pothole[];
  },

  async getPotholesByUser(userId: string) {
    const { data, error } = await supabase
      .from('potholes')
      .select('*')
      .eq('userId', userId)
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data as Pothole[];
  },

  async addPothole(pothole: Omit<Pothole, 'id'>) {
    const { data, error } = await supabase
      .from('potholes')
      .insert([pothole])
      .select()
      .single();
    if (error) throw error;
    return data as Pothole;
  },

  async updatePothole(id: string, updates: Partial<Pothole>) {
    const { data, error } = await supabase
      .from('potholes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Pothole;
  },

  async deletePothole(id: string) {
    const { error } = await supabase
      .from('potholes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Users
  async getUserProfile(uid: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();
    if (error) throw error;
    return data as UserProfile | null;
  },

  async upsertUserProfile(profile: UserProfile) {
    const { data, error } = await supabase
      .from('users')
      .upsert([profile], { onConflict: 'uid' })
      .select()
      .single();
    if (error) throw error;
    return data as UserProfile;
  },

  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    if (error) throw error;
    return data as UserProfile[];
  },

  async deleteUser(uid: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('uid', uid);
    if (error) throw error;
  },

  // Permitted Users
  async getPermittedUser(email: string) {
    const { data, error } = await supabase
      .from('permitted_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data as PermittedUser | null;
  },

  async getAllPermittedUsers() {
    const { data, error } = await supabase
      .from('permitted_users')
      .select('*');
    if (error) throw error;
    return data as PermittedUser[];
  },

  async addPermittedUser(permitted: PermittedUser) {
    const { data, error } = await supabase
      .from('permitted_users')
      .insert([{ ...permitted, email: permitted.email.toLowerCase() }])
      .select()
      .single();
    if (error) throw error;
    return data as PermittedUser;
  },

  async deletePermittedUser(email: string) {
    const { error } = await supabase
      .from('permitted_users')
      .delete()
      .eq('email', email.toLowerCase());
    if (error) throw error;
  },

  // Real-time subscriptions
  subscribeToPotholes(callback: (potholes: Pothole[]) => void) {
    return supabase
      .channel('public:potholes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'potholes' }, async () => {
        const potholes = await this.getPotholes();
        callback(potholes);
      })
      .subscribe();
  },

  subscribeToPermittedUsers(callback: (users: PermittedUser[]) => void) {
    return supabase
      .channel('public:permitted_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permitted_users' }, async () => {
        const users = await this.getAllPermittedUsers();
        callback(users);
      })
      .subscribe();
  }
};
