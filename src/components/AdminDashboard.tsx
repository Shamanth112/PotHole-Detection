import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  UserPlus, Users, ShieldCheck, Mail, Trash2, Loader2, 
  MapPin, Plus, AlertTriangle, CheckCircle2, Clock, 
  TrendingUp, BarChart3, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AdminTab = 'stats' | 'users' | 'potholes' | 'permitted';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [users, setUsers] = useState<any[]>([]);
  const [potholes, setPotholes] = useState<any[]>([]);
  const [permittedUsers, setPermittedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Permitted User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'citizen' | 'admin' | 'municipal'>('citizen');

  // Pothole Form State
  const [showAddPothole, setShowAddPothole] = useState(false);
  const [newPothole, setNewPothole] = useState({
    latitude: '',
    longitude: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    address: ''
  });

  useEffect(() => {
    fetchUsers();
    
    // Initial fetch for potholes and permitted users
    fetchPotholes();
    fetchPermittedUsers();

    // Real-time subscriptions
    const potholesChannel = supabase
      .channel('admin-potholes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'potholes' }, () => {
        fetchPotholes();
      })
      .subscribe();

    const permittedChannel = supabase
      .channel('admin-permitted')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permitted_users' }, () => {
        fetchPermittedUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(potholesChannel);
      supabase.removeChannel(permittedChannel);
    };
  }, []);

  const fetchPotholes = async () => {
    const { data, error } = await supabase
      .from('potholes')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    if (!error && data) setPotholes(data);
  };

  const fetchPermittedUsers = async () => {
    const { data, error } = await supabase
      .from('permitted_users')
      .select('*');
    if (!error && data) setPermittedUsers(data);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('email', { ascending: true });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleAddPermittedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const emailKey = newEmail.toLowerCase().trim();
      const { error } = await supabase
        .from('permitted_users')
        .upsert({
          email: emailKey,
          role: newRole,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setNewEmail('');
      setSuccess(`Successfully added ${emailKey} as ${newRole}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermittedUser = async (email: string) => {
    if (!window.confirm(`Remove permissions for ${email}?`)) return;
    try {
      const { error } = await supabase
        .from('permitted_users')
        .delete()
        .eq('email', email);
      
      if (error) throw error;
      setSuccess(`Permissions removed for ${email}.`);
    } catch (err: any) {
      setError(`Failed to remove permissions: ${err.message}`);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email} from registered users?`)) return;
    setDeletingId(user.id);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);
      
      if (error) throw error;
      setSuccess(`User ${user.email} deleted.`);
      fetchUsers();
    } catch (err: any) {
      setError(`Failed to delete user: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddPothole = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('potholes')
        .insert({
          latitude: parseFloat(newPothole.latitude),
          longitude: parseFloat(newPothole.longitude),
          severity: newPothole.severity,
          address: newPothole.address || 'Manual Entry',
          status: 'reported',
          timestamp: new Date().toISOString(),
          user_id: user?.id || null,
          user_name: 'Admin Manual Entry'
        });

      if (error) throw error;

      setShowAddPothole(false);
      setNewPothole({ latitude: '', longitude: '', severity: 'medium', address: '' });
      setSuccess('Pothole manually added to system.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePothole = async (id: string) => {
    if (!window.confirm('Delete this pothole report permanently?')) return;
    try {
      const { error } = await supabase
        .from('potholes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setSuccess('Pothole report removed.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const stats = {
    totalPotholes: potholes.length,
    resolved: potholes.filter(p => p.status === 'resolved').length,
    pending: potholes.filter(p => p.status !== 'resolved').length,
    highSeverity: potholes.filter(p => p.severity === 'high').length,
    totalUsers: users.length,
    municipalUsers: users.filter(u => u.role === 'municipal').length,
    permittedCount: permittedUsers.length
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 w-fit overflow-x-auto max-w-full">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <BarChart3 className="w-4 h-4" /> Stats
        </button>
        <button 
          onClick={() => setActiveTab('permitted')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'permitted' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <Shield className="w-4 h-4" /> Permissions
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <Users className="w-4 h-4" /> Users
        </button>
        <button 
          onClick={() => setActiveTab('potholes')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'potholes' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <MapPin className="w-4 h-4" /> Potholes
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'stats' && (
          <motion.div 
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-24 h-24" />
              </div>
              <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">Total Reports</p>
              <h4 className="text-4xl font-black text-white italic">{stats.totalPotholes}</h4>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold">
                <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {stats.highSeverity} High Risk</span>
                <span className="text-zinc-600">|</span>
                <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {stats.resolved} Fixed</span>
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users className="w-24 h-24" />
              </div>
              <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">Registered Users</p>
              <h4 className="text-4xl font-black text-white italic">{stats.totalUsers}</h4>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold">
                <span className="text-blue-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {stats.municipalUsers} Municipal</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">{stats.totalUsers - stats.municipalUsers} Citizens</span>
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shield className="w-24 h-24" />
              </div>
              <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">Permitted Emails</p>
              <h4 className="text-4xl font-black text-white italic">{stats.permittedCount}</h4>
              <p className="mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Pre-authorized roles</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'permitted' && (
          <motion.div 
            key="permitted"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Authorize Gmail Account
              </h3>
              <form onSubmit={handleAddPermittedUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Gmail Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="user@gmail.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Assigned Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="citizen">Standard User (Citizen)</option>
                    <option value="municipal">Municipal (Staff)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                {success && <p className="text-emerald-500 text-xs font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">{success}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize Email'}
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
                <Shield className="w-5 h-5 text-emerald-500" />
                Permitted List
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {permittedUsers.map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800 group hover:border-zinc-700 transition-all">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-bold text-white truncate">{u.email}</p>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded mt-1 inline-block ${
                        u.role === 'admin' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30' : 
                        u.role === 'municipal' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeletePermittedUser(u.email)}
                      className="p-2 text-zinc-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {permittedUsers.length === 0 && (
                  <p className="text-center text-zinc-600 text-xs italic py-8">No pre-authorized emails.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800"
          >
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
              <Users className="w-5 h-5 text-emerald-500" />
              Registered User Directory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {users.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800 group hover:border-zinc-700 transition-all">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-bold text-white truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        u.role === 'admin' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30' : 
                        u.role === 'municipal' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteUser(u)}
                    disabled={deletingId === u.id || u.role === 'admin'}
                    className="p-2 text-zinc-700 hover:text-red-500 transition-colors disabled:opacity-30"
                  >
                    {deletingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'potholes' && (
          <motion.div 
            key="potholes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                <MapPin className="w-6 h-6 text-red-500" />
                Global Pothole Tracking
              </h3>
              <button 
                onClick={() => setShowAddPothole(true)}
                className="bg-white text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Manual Entry
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {potholes.length === 0 ? (
                <div className="bg-zinc-900/50 p-12 rounded-3xl border border-zinc-800 border-dashed text-center">
                  <MapPin className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500 font-bold italic">No reports found in system.</p>
                </div>
              ) : (
                potholes.map((p) => (
                  <div key={p.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        p.severity === 'high' ? 'bg-red-500/20 text-red-500' : 
                        p.severity === 'medium' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{p.address || 'Unknown Location'}</h4>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-zinc-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p.timestamp).toLocaleString()}</span>
                          <span className={`px-2 py-0.5 rounded uppercase ${
                            p.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-500' : 
                            p.status === 'fixing' ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeletePothole(p.id)}
                      className="p-3 text-zinc-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Pothole Modal */}
      <AnimatePresence>
        {showAddPothole && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPothole(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="z-10 w-full max-w-lg bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8">Manual Pothole Entry</h3>
              <form onSubmit={handleAddPothole} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={newPothole.latitude}
                      onChange={(e) => setNewPothole({...newPothole, latitude: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="e.g. 12.9716"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={newPothole.longitude}
                      onChange={(e) => setNewPothole({...newPothole, longitude: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="e.g. 77.5946"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Severity</label>
                  <select
                    value={newPothole.severity}
                    onChange={(e) => setNewPothole({...newPothole, severity: e.target.value as any})}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Address / Description</label>
                  <input
                    type="text"
                    value={newPothole.address}
                    onChange={(e) => setNewPothole({...newPothole, address: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g. MG Road, Near Metro Station"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddPothole(false)}
                    className="flex-1 py-4 bg-zinc-800 text-white font-black rounded-2xl uppercase tracking-widest text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-red-600/20"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Register Pothole'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
