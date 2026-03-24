import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';
import { 
  UserPlus, Users, ShieldCheck, Mail, Trash2, Loader2, 
  MapPin, Plus, AlertTriangle, CheckCircle2, Clock, 
  TrendingUp, BarChart3, Shield, Pencil, Save, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ImageViewer from './ImageViewer';
import { Id } from '@/convex/_generated/dataModel';

type AdminTab = 'stats' | 'users' | 'potholes' | 'permitted';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Queries
  const users = useQuery(api.users.listAll) ?? [];
  const potholes = useQuery(api.potholes.listAll) ?? [];
  const permittedUsers = useQuery(api.permittedUsers.list) ?? [];
  const loading = useQuery(api.users.listAll) === undefined;

  // Mutations
  const addPermittedUserMutation = useMutation(api.permittedUsers.upsert);
  const deletePermittedUserMutation = useMutation(api.permittedUsers.remove);
  const updatePermittedRoleMutation = useMutation(api.permittedUsers.updateRole);
  
  const deleteUserMutation = useMutation(api.users.deleteUser);
  const updateUserRoleMutation = useMutation(api.users.updateRole);
  
  const addPotholeMutation = useMutation(api.potholes.addManual);
  const deletePotholeMutation = useMutation(api.potholes.deletePothole);
  const editPotholeMutation = useMutation(api.potholes.updatePothole);

  // Editing states
  const [editingPotholeId, setEditingPotholeId] = useState<string | null>(null);
  const [editPotholeData, setEditPotholeData] = useState<any>({});
  const [viewingImage, setViewingImage] = useState<{url: string, title: string} | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>('');
  const [editingPermittedEmail, setEditingPermittedEmail] = useState<string | null>(null);
  const [editPermittedRole, setEditPermittedRole] = useState<string>('');

  // Permitted User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'citizen' | 'admin' | 'municipal'>('citizen');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pothole Form State
  const [showAddPothole, setShowAddPothole] = useState(false);
  const [newPothole, setNewPothole] = useState({
    latitude: '',
    longitude: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    address: ''
  });

  // --- Permitted Users CRUD ---
  const handleAddPermittedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const emailKey = newEmail.toLowerCase().trim();
      await addPermittedUserMutation({ email: emailKey, role: newRole });
      setNewEmail('');
      setSuccess(`Successfully added ${emailKey} as ${newRole}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePermittedUser = async (email: string) => {
    if (!window.confirm(`Remove permissions for ${email}?`)) return;
    try {
      await deletePermittedUserMutation({ email });
      setSuccess(`Permissions removed for ${email}.`);
    } catch (err: any) {
      setError(`Failed to remove permissions: ${err.message}`);
    }
  };

  const handleEditPermittedUser = async (email: string) => {
    try {
      await updatePermittedRoleMutation({ email, role: editPermittedRole as any });
      setEditingPermittedEmail(null);
      setSuccess(`Role updated for ${email}.`);
    } catch (err: any) {
      setError(`Failed to update role: ${err.message}`);
    }
  };

  // --- Users CRUD ---
  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email} from registered users?`)) return;
    setDeletingId(user._id);
    try {
      await deleteUserMutation({ userId: user._id });
      setSuccess(`User ${user.email} deleted.`);
    } catch (err: any) {
      setError(`Failed to delete user: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditUserRole = async (userId: Id<"users">) => {
    try {
      await updateUserRoleMutation({ userId, role: editUserRole as any });
      setEditingUserId(null);
      setSuccess(`User role updated to ${editUserRole}.`);
    } catch (err: any) {
      setError(`Failed to update user role: ${err.message}`);
    }
  };

  // --- Potholes CRUD ---
  const handleAddPothole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addPotholeMutation({
        latitude: parseFloat(newPothole.latitude),
        longitude: parseFloat(newPothole.longitude),
        severity: newPothole.severity,
        address: newPothole.address || 'Manual Entry',
      });
      setShowAddPothole(false);
      setNewPothole({ latitude: '', longitude: '', severity: 'medium', address: '' });
      setSuccess('Pothole manually added to system.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePothole = async (id: Id<"potholes">) => {
    if (!window.confirm('Delete this pothole report permanently?')) return;
    try {
      await deletePotholeMutation({ potholeId: id });
      setSuccess('Pothole report removed.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditPothole = async (id: Id<"potholes">) => {
    try {
      await editPotholeMutation({
        potholeId: id,
        status: editPotholeData.status,
        severity: editPotholeData.severity,
        address: editPotholeData.address,
      });
      setEditingPotholeId(null);
      setSuccess('Pothole updated successfully.');
    } catch (err: any) {
      setError(`Failed to update pothole: ${err.message}`);
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

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-2xl text-sm font-bold flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* ===== STATS TAB ===== */}
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

        {/* ===== PERMITTED USERS TAB ===== */}
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize Email'}
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
                      {editingPermittedEmail === u.email ? (
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={editPermittedRole}
                            onChange={(e) => setEditPermittedRole(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-xs text-white outline-none"
                          >
                            <option value="citizen">Citizen</option>
                            <option value="municipal">Municipal</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => handleEditPermittedUser(u.email)} className="p-1 text-emerald-500 hover:text-emerald-400">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingPermittedEmail(null)} className="p-1 text-zinc-500 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded mt-1 inline-block ${
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30' : 
                          u.role === 'municipal' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 
                          'bg-zinc-800 text-zinc-500'
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => { setEditingPermittedEmail(u.email); setEditPermittedRole(u.role); }}
                        className="p-2 text-zinc-700 hover:text-blue-500 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeletePermittedUser(u.email)}
                        className="p-2 text-zinc-700 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {permittedUsers.length === 0 && (
                  <p className="text-center text-zinc-600 text-xs italic py-8">No pre-authorized emails.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800"
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 italic uppercase tracking-tighter">
              <Users className="w-5 h-5 text-emerald-500" />
              Registered User Directory
              <span className="ml-auto text-xs font-black text-zinc-600 normal-case tracking-normal not-italic">{users.length} users</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                </div>
              )}
              {!loading && users.length === 0 && (
                <p className="text-center text-zinc-600 text-xs italic py-8">No registered users found.</p>
              )}
              {users.map((u, i) => (
                <div key={i} className="p-4 bg-black/40 rounded-2xl border border-zinc-800 group hover:border-zinc-700 transition-all">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <img
                      src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email || 'U')}&background=1a365d&color=fff`}
                      alt={u.name || u.email}
                      className="w-12 h-12 rounded-2xl border border-zinc-700 object-cover shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{u.name || 'No Name'}</p>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30' : 
                          u.role === 'municipal' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 
                          'bg-zinc-800 text-zinc-500'
                        }`}>
                          {u.role || 'citizen'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">{u.email}</p>
                      <p className="text-[10px] text-zinc-600 font-mono mt-1 truncate" title={u._id}>ID: {u._id}</p>
                      {u._creationTime && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          Joined: {new Date(u._creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {editingUserId === u._id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editUserRole}
                            onChange={(e) => setEditUserRole(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-xs text-white outline-none"
                          >
                            <option value="citizen">Citizen</option>
                            <option value="municipal">Municipal</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => handleEditUserRole(u._id)} className="p-1 text-emerald-500 hover:text-emerald-400">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingUserId(null)} className="p-1 text-zinc-500 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => { setEditingUserId(u._id); setEditUserRole(u.role || 'citizen'); }}
                            className="p-2 text-zinc-700 hover:text-blue-500 transition-colors"
                            title="Edit role"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u)}
                            disabled={deletingId === u._id || u.role === 'admin'}
                            className="p-2 text-zinc-700 hover:text-red-500 transition-colors disabled:opacity-30"
                            title="Delete user"
                          >
                            {deletingId === u._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ===== POTHOLES TAB ===== */}
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
                  <div key={p._id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 group hover:border-zinc-700 transition-all">
                    {editingPotholeId === p._id ? (
                      /* ---- EDIT MODE ---- */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Status</label>
                            <select
                              value={editPotholeData.status}
                              onChange={(e) => setEditPotholeData({ ...editPotholeData, status: e.target.value })}
                              className="w-full bg-black border border-zinc-700 rounded-xl py-2 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="reported">Reported</option>
                              <option value="verified">Verified</option>
                              <option value="fixing">Fixing</option>
                              <option value="in-progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Severity</label>
                            <select
                              value={editPotholeData.severity}
                              onChange={(e) => setEditPotholeData({ ...editPotholeData, severity: e.target.value })}
                              className="w-full bg-black border border-zinc-700 rounded-xl py-2 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Address</label>
                            <input
                              type="text"
                              value={editPotholeData.address}
                              onChange={(e) => setEditPotholeData({ ...editPotholeData, address: e.target.value })}
                              className="w-full bg-black border border-zinc-700 rounded-xl py-2 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                          <button 
                            onClick={() => setEditingPotholeId(null)} 
                            className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleEditPothole(p._id as any)} 
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 transition-all"
                          >
                            <Save className="w-3 h-3" /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ---- VIEW MODE ---- */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            p.severity === 'high' ? 'bg-red-500/20 text-red-500' : 
                            p.severity === 'medium' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">{p.address || 'Unknown Location'}</h4>
                            
                            <div className="flex gap-2 mt-2 mb-2 overflow-x-auto pb-1">
                              {/* TODO url mapping */}
                              {p.reportImageUrl && (
                                <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({url: p.reportImageUrl!, title: 'Report Photo'})}>
                                  <img src={p.reportImageUrl} className="w-16 h-16 object-cover rounded-xl border border-zinc-700" alt="Report" referrerPolicy="no-referrer" />
                                </div>
                              )}
                              {p.resolvedImageUrl && (
                                <div className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingImage({url: p.resolvedImageUrl!, title: 'Resolved Photo'})}>
                                  <img src={p.resolvedImageUrl} className="w-16 h-16 object-cover rounded-xl border border-emerald-500/30" alt="Resolved" referrerPolicy="no-referrer" />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-zinc-500 flex-wrap">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p._creationTime).toLocaleString()}</span>
                              <span className={`px-2 py-0.5 rounded uppercase ${
                                p.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-500' : 
                                p.status === 'in-progress' ? 'bg-blue-500/20 text-blue-500' : 
                                p.status === 'dismissed' ? 'bg-zinc-700/50 text-zinc-400' : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {p.status}
                              </span>
                              <span className={`px-2 py-0.5 rounded uppercase ${
                                p.severity === 'high' ? 'bg-red-500/20 text-red-500' : 
                                p.severity === 'medium' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-500'
                              }`}>
                                {p.severity}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => { setEditingPotholeId(p._id); setEditPotholeData({ status: p.status, severity: p.severity, address: p.address || '' }); }}
                            className="p-3 text-zinc-700 hover:text-blue-500 transition-colors"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeletePothole(p._id as any)}
                            className="p-3 text-zinc-700 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
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
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Address / Desc</label>
                  <input
                    type="text"
                    value={newPothole.address}
                    onChange={(e) => setNewPothole({...newPothole, address: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="e.g. Main Street, near post office"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 mt-8 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddPothole(false)}
                    className="flex-1 py-4 text-zinc-400 font-black text-xs uppercase tracking-widest hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Report</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ImageViewer 
        url={viewingImage?.url || null} 
        title={viewingImage?.title} 
        onClose={() => setViewingImage(null)} 
      />
    </div>
  );
}
