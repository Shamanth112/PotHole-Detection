import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query, onSnapshot, orderBy, limit, Timestamp, addDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  UserPlus, Users, ShieldCheck, Mail, Key, Trash2, Loader2, Eye, EyeOff, 
  LayoutDashboard, MapPin, Plus, AlertTriangle, CheckCircle2, Clock, 
  TrendingUp, BarChart3, Search, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize a secondary app for creating users without signing out the admin
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp');
const secondaryAuth = getAuth(secondaryApp);

type AdminTab = 'stats' | 'users' | 'potholes';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [users, setUsers] = useState<any[]>([]);
  const [potholes, setPotholes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // User Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

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
    
    const q = query(collection(db, 'potholes'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPotholes(data);
    });

    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      usersList.sort((a: any, b: any) => (a.email || '').localeCompare(b.email || ''));
      setUsers(usersList);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleCreateMunicipal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;
      await signOut(secondaryAuth);

      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: email.toLowerCase().trim(),
        role: 'municipal',
        displayName: 'Municipal User',
        initialPassword: password,
        createdAt: new Date().toISOString()
      });

      setEmail('');
      setPassword('');
      fetchUsers();
      setSuccess(`Successfully created municipal account for ${email}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email}?`)) return;
    setDeletingId(user.id);
    try {
      await deleteDoc(doc(db, 'users', user.id));
      if (user.role === 'municipal' && user.initialPassword) {
        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, user.email, user.initialPassword);
          await deleteUser(userCredential.user);
          await signOut(secondaryAuth);
        } catch (authErr) {
          console.warn("Could not delete from Auth:", authErr);
        }
      }
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
      await addDoc(collection(db, 'potholes'), {
        latitude: parseFloat(newPothole.latitude),
        longitude: parseFloat(newPothole.longitude),
        severity: newPothole.severity,
        address: newPothole.address || 'Manual Entry',
        status: 'reported',
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || 'admin',
        userName: 'Admin Manual Entry'
      });
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
      await deleteDoc(doc(db, 'potholes', id));
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
    municipalUsers: users.filter(u => u.role === 'municipal').length
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 w-fit">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <BarChart3 className="w-4 h-4" /> System Stats
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <Users className="w-4 h-4" /> User Management
        </button>
        <button 
          onClick={() => setActiveTab('potholes')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'potholes' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
        >
          <MapPin className="w-4 h-4" /> Pothole Tracking
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
              <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">Active Users</p>
              <h4 className="text-4xl font-black text-white italic">{stats.totalUsers}</h4>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold">
                <span className="text-blue-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {stats.municipalUsers} Municipal</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">{stats.totalUsers - stats.municipalUsers} Citizens</span>
              </div>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">Resolution Rate</p>
              <h4 className="text-4xl font-black text-white italic">
                {stats.totalPotholes > 0 ? Math.round((stats.resolved / stats.totalPotholes) * 100) : 0}%
              </h4>
              <div className="mt-4 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000" 
                  style={{ width: `${stats.totalPotholes > 0 ? (stats.resolved / stats.totalPotholes) * 100 : 0}%` }} 
                />
              </div>
            </div>

            <div className="md:col-span-3 bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800 border-dashed flex flex-col items-center justify-center text-center">
              <LayoutDashboard className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2 italic uppercase tracking-tighter">System Health: Optimal</h3>
              <p className="text-zinc-500 text-sm max-w-md">All real-time detection streams are active. Municipal response times are within target parameters.</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Provision Municipal Account
              </h3>
              <form onSubmit={handleCreateMunicipal} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Official Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="municipal@city.gov"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Initial Password</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                {success && <p className="text-emerald-500 text-xs font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">{success}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter">
                <Users className="w-5 h-5 text-emerald-500" />
                User Directory
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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
                        {u.role === 'municipal' && u.initialPassword && (
                          <div className="flex items-center gap-2 ml-2">
                            <p className="text-[10px] text-zinc-600 font-mono">
                              {showPasswords[u.email] ? u.initialPassword : '••••••••'}
                            </p>
                            <button 
                              onClick={() => setShowPasswords(prev => ({ ...prev, [u.email]: !prev[u.email] }))}
                              className="text-zinc-700 hover:text-white transition-colors"
                            >
                              {showPasswords[u.email] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
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
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p.timestamp?.seconds * 1000).toLocaleString()}</span>
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
