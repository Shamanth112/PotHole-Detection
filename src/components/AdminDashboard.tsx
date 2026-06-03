import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';
import {
  UserPlus, Users, ShieldCheck, Mail, Trash2, Loader2,
  MapPin, Plus, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, BarChart3, Shield, Pencil, Save, X,
  Activity, Zap, Star
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

  const users = useQuery(api.users.listAll) ?? [];
  const potholes = useQuery(api.potholes.listAll) ?? [];
  const permittedUsers = useQuery(api.permittedUsers.list) ?? [];
  const loading = useQuery(api.users.listAll) === undefined;

  const addPermittedUserMutation = useMutation(api.permittedUsers.upsert);
  const deletePermittedUserMutation = useMutation(api.permittedUsers.remove);
  const updatePermittedRoleMutation = useMutation(api.permittedUsers.updateRole);
  const deleteUserMutation = useMutation(api.users.deleteUser);
  const updateUserRoleMutation = useMutation(api.users.updateRole);
  const addPotholeMutation = useMutation(api.potholes.addManual);
  const deletePotholeMutation = useMutation(api.potholes.deletePothole);
  const editPotholeMutation = useMutation(api.potholes.updatePothole);

  const [editingPotholeId, setEditingPotholeId] = useState<string | null>(null);
  const [editPotholeData, setEditPotholeData] = useState<any>({});
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>('');
  const [editingPermittedEmail, setEditingPermittedEmail] = useState<string | null>(null);
  const [editPermittedRole, setEditPermittedRole] = useState<string>('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'citizen' | 'admin' | 'municipal'>('citizen');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddPothole, setShowAddPothole] = useState(false);
  const [newPothole, setNewPothole] = useState({ latitude: '', longitude: '', severity: 'medium' as 'low' | 'medium' | 'high', address: '' });

  const handleAddPermittedUser = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setError(''); setSuccess('');
    try {
      const emailKey = newEmail.toLowerCase().trim();
      await addPermittedUserMutation({ email: emailKey, role: newRole });
      setNewEmail(''); setSuccess(`Successfully added ${emailKey} as ${newRole}.`);
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleDeletePermittedUser = async (email: string) => {
    if (!window.confirm(`Remove permissions for ${email}?`)) return;
    try { await deletePermittedUserMutation({ email }); setSuccess(`Permissions removed for ${email}.`); }
    catch (err: any) { setError(`Failed to remove permissions: ${err.message}`); }
  };

  const handleEditPermittedUser = async (email: string) => {
    try { await updatePermittedRoleMutation({ email, role: editPermittedRole as any }); setEditingPermittedEmail(null); setSuccess(`Role updated for ${email}.`); }
    catch (err: any) { setError(`Failed to update role: ${err.message}`); }
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Delete ${user.email} from registered users?`)) return;
    setDeletingId(user._id);
    try { await deleteUserMutation({ profileId: user._id }); setSuccess(`User ${user.email} deleted.`); }
    catch (err: any) { setError(`Failed to delete user: ${err.message}`); } finally { setDeletingId(null); }
  };

  const handleEditUserRole = async (profileId: Id<"profiles">) => {
    try { await updateUserRoleMutation({ profileId, role: editUserRole as any }); setEditingUserId(null); setSuccess(`Role updated to ${editUserRole}.`); }
    catch (err: any) { setError(`Failed to update: ${err.message}`); }
  };

  const handleAddPothole = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await addPotholeMutation({ latitude: parseFloat(newPothole.latitude), longitude: parseFloat(newPothole.longitude), severity: newPothole.severity, address: newPothole.address || 'Manual Entry' });
      setShowAddPothole(false); setNewPothole({ latitude: '', longitude: '', severity: 'medium', address: '' }); setSuccess('Pothole manually added.');
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleDeletePothole = async (id: Id<"potholes">) => {
    if (!window.confirm('Delete this pothole report permanently?')) return;
    try { await deletePotholeMutation({ potholeId: id }); setSuccess('Report removed.'); }
    catch (err: any) { setError(err.message); }
  };

  const handleEditPothole = async (id: Id<"potholes">) => {
    try { await editPotholeMutation({ potholeId: id, status: editPotholeData.status, severity: editPotholeData.severity, address: editPotholeData.address }); setEditingPotholeId(null); setSuccess('Pothole updated.'); }
    catch (err: any) { setError(`Failed to update: ${err.message}`); }
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

  const tabs = [
    { key: 'stats',     label: 'Overview',    icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'permitted', label: 'Permissions', icon: <Shield className="w-4 h-4" /> },
    { key: 'users',     label: 'Users',       icon: <Users className="w-4 h-4" /> },
    { key: 'potholes',  label: 'Reports',     icon: <MapPin className="w-4 h-4" /> },
  ] as const;

  const roleBadge = (role: string) => {
    if (role === 'admin') return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    if (role === 'municipal') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    return 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50';
  };

  const selectClass = "w-full input-dark";
  const inputClass  = "w-full input-dark";

  return (
    <div className="space-y-6">
      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 p-1 rounded-2xl w-fit overflow-x-auto no-scrollbar" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
            style={{
              background: activeTab === key ? 'rgba(59,130,246,0.2)' : 'transparent',
              border: `1px solid ${activeTab === key ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
              color: activeTab === key ? '#60a5fa' : 'var(--text-secondary)',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Toast Messages ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center justify-between p-4 rounded-2xl text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center justify-between p-4 rounded-2xl text-sm font-semibold"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
            <span>{success}</span>
            <button onClick={() => setSuccess('')}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* ═══ STATS TAB ═══ */}
        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Reports', value: stats.totalPotholes, sub: `${stats.highSeverity} High Risk · ${stats.resolved} Fixed`, icon: <TrendingUp className="w-6 h-6" />, color: 'text-blue-400', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.08))' },
                { label: 'Registered Users', value: stats.totalUsers, sub: `${stats.municipalUsers} Municipal · ${stats.totalUsers - stats.municipalUsers} Citizens`, icon: <Users className="w-6 h-6" />, color: 'text-emerald-400', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))' },
                { label: 'Permitted Emails', value: stats.permittedCount, sub: 'Pre-authorized access roles', icon: <Shield className="w-6 h-6" />, color: 'text-purple-400', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.06))' },
              ].map(({ label, value, sub, icon, color, gradient }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="rounded-3xl p-6 relative overflow-hidden" style={{ background: gradient, border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${color} opacity-80`}>{icon}</div>
                    <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <h4 className={`text-4xl font-black ${color}`}>{value}</h4>
                  <p className="text-xs mt-3 font-medium" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Resolution rate bar */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold">Resolution Rate</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Potholes fixed vs total reported</p>
                </div>
                <span className="text-2xl font-black text-emerald-400">
                  {stats.totalPotholes > 0 ? Math.round((stats.resolved / stats.totalPotholes) * 100) : 0}%
                </span>
              </div>
              <div className="progress-bar">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.totalPotholes > 0 ? (stats.resolved / stats.totalPotholes) * 100 : 0}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  className="progress-fill"
                  style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4)' }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ PERMITTED TAB ═══ */}
        {activeTab === 'permitted' && (
          <motion.div key="permitted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add form */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-bold flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-400" /> Authorize Gmail Account</h3>
              </div>
              <form onSubmit={handleAddPermittedUser} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Gmail Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={`${inputClass} pl-10`} placeholder="user@gmail.com" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Assigned Role</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className={selectClass} style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <option value="citizen">Standard User (Citizen)</option>
                    <option value="municipal">Municipal (Staff)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authorize Email'}
                </button>
              </form>
            </div>

            {/* Permitted list */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> Permitted List</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{permittedUsers.length}</span>
              </div>
              <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                {permittedUsers.map((u, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/5" style={{ border: '1px solid var(--border)' }}>
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-semibold truncate">{u.email}</p>
                      {editingPermittedEmail === u.email ? (
                        <div className="flex items-center gap-2 mt-2">
                          <select value={editPermittedRole} onChange={(e) => setEditPermittedRole(e.target.value)} className="input-dark py-1 text-xs" style={{ background: 'rgba(0,0,0,0.5)' }}>
                            <option value="citizen">Citizen</option>
                            <option value="municipal">Municipal</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => handleEditPermittedUser(u.email)} className="p-1.5 text-emerald-400 hover:text-emerald-300"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingPermittedEmail(null)} style={{ color: 'var(--text-muted)' }}><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded mt-1 inline-block ${roleBadge(u.role)}`}>{u.role}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingPermittedEmail(u.email); setEditPermittedRole(u.role); }} className="p-2 rounded-lg transition-all hover:bg-blue-500/10 text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeletePermittedUser(u.email)} className="p-2 rounded-lg transition-all hover:bg-red-500/10 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                {permittedUsers.length === 0 && <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>No pre-authorized emails.</p>}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ USERS TAB ═══ */}
        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold">Registered User Directory</h3>
              <span className="ml-auto text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{users.length} users</span>
            </div>
            <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {loading && <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>}
              {!loading && users.length === 0 && <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>No registered users found.</p>}
              {users.map((u, i) => (
                <div key={i} className="p-4 rounded-xl transition-all hover:bg-white/5" style={{ border: '1px solid var(--border)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <img src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email || 'U')}&background=3b82f6&color=fff`}
                        alt={u.name || u.email} className="w-11 h-11 rounded-xl object-cover shrink-0" style={{ border: '1px solid var(--border)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{u.name || 'No Name'}</p>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${roleBadge(u.role || 'citizen')}`}>{u.role || 'citizen'}</span>
                        </div>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                        {u._creationTime && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Joined {new Date(u._creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0" style={{ borderColor: 'var(--border)' }}>
                      {editingUserId === u._id ? (
                        <div className="flex items-center gap-2 w-full justify-between sm:justify-start">
                          <select value={editUserRole} onChange={(e) => setEditUserRole(e.target.value)} className="input-dark py-1 text-xs w-28" style={{ background: 'rgba(0,0,0,0.5)' }}>
                            <option value="citizen">Citizen</option>
                            <option value="municipal">Municipal</option>
                            <option value="admin">Admin</option>
                          </select>
                          <div className="flex gap-1">
                            <button onClick={() => handleEditUserRole(u._id as Id<"profiles">)} className="p-1.5 text-emerald-400"><Save className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingUserId(null)} style={{ color: 'var(--text-muted)' }}><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setEditingUserId(u._id); setEditUserRole(u.role || 'citizen'); }} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteUser(u)} disabled={deletingId === u._id || u.role === 'admin'} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 disabled:opacity-30">
                            {deletingId === u._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

        {/* ═══ POTHOLES TAB ═══ */}
        {activeTab === 'potholes' && (
          <motion.div key="potholes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2"><MapPin className="w-5 h-5 text-red-400" /> Global Pothole Tracking</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{potholes.length} reports in system</p>
              </div>
              <button onClick={() => setShowAddPothole(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Add Manual Entry
              </button>
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {potholes.length === 0 ? (
                  <div className="p-12 text-center">
                    <MapPin className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold">No reports in system</p>
                  </div>
                ) : potholes.map((p) => (
                  <div key={p._id} className="p-4 hover:bg-white/5 transition-all">
                    {editingPotholeId === p._id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            { label: 'Status', key: 'status', opts: [['reported','Reported'],['verified','Verified'],['fixing','Fixing'],['in-progress','In Progress'],['resolved','Resolved'],['dismissed','Dismissed']] },
                            { label: 'Severity', key: 'severity', opts: [['low','Low'],['medium','Medium'],['high','High']] },
                          ].map(({ label, key, opts }) => (
                            <div key={key}>
                              <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                              <select value={editPotholeData[key]} onChange={(e) => setEditPotholeData({ ...editPotholeData, [key]: e.target.value })} className={`${selectClass}`} style={{ background: 'rgba(0,0,0,0.4)' }}>
                                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </div>
                          ))}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Address</label>
                            <input type="text" value={editPotholeData.address} onChange={(e) => setEditPotholeData({ ...editPotholeData, address: e.target.value })} className={inputClass} />
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => setEditingPotholeId(null)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
                          <button onClick={() => handleEditPothole(p._id as any)} className="btn-primary text-sm px-4 py-2"><Save className="w-3.5 h-3.5" /> Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.severity === 'high' ? 'badge-high' : p.severity === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold truncate">{p.address || 'Unknown Location'}</h4>
                            {(p.reportImageUrl || p.resolvedImageUrl) && (
                              <div className="flex gap-2 mt-1">
                                {p.reportImageUrl && <img src={p.reportImageUrl} className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80" onClick={() => setViewingImage({ url: p.reportImageUrl!, title: 'Report Photo' })} style={{ border: '1px solid var(--border)' }} alt="Report" referrerPolicy="no-referrer" />}
                                {p.resolvedImageUrl && <img src={p.resolvedImageUrl} className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 border-emerald-500/30 border" onClick={() => setViewingImage({ url: p.resolvedImageUrl!, title: 'Resolved' })} alt="Resolved" referrerPolicy="no-referrer" />}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${p.status === 'resolved' ? 'badge-resolved' : p.status === 'fixing' ? 'badge-fixing' : p.status === 'verified' ? 'badge-verified' : 'badge-reported'}`}>{p.status}</span>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${p.severity === 'high' ? 'badge-high' : p.severity === 'medium' ? 'badge-medium' : 'badge-low'}`}>{p.severity}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(p._creationTime).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0" style={{ borderColor: 'var(--border)' }}>
                          <button onClick={() => { setEditingPotholeId(p._id); setEditPotholeData({ status: p.status, severity: p.severity, address: p.address || '' }); }} className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeletePothole(p._id as any)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ADD POTHOLE MODAL ═══ */}
      <AnimatePresence>
        {showAddPothole && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddPothole(false)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="z-10 w-full max-w-lg rounded-3xl p-7 space-y-5" style={{ background: 'rgba(13,21,38,0.97)', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">Manual Pothole Entry</h3>
                <button onClick={() => setShowAddPothole(false)} className="p-2 rounded-xl glass" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleAddPothole} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[{ label: 'Latitude', key: 'latitude', ph: 'e.g. 12.9716' }, { label: 'Longitude', key: 'longitude', ph: 'e.g. 77.5946' }].map(({ label, key, ph }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
                      <input type="number" step="any" value={(newPothole as any)[key]} onChange={(e) => setNewPothole({ ...newPothole, [key]: e.target.value })} className={inputClass} placeholder={ph} required />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Severity</label>
                  <select value={newPothole.severity} onChange={(e) => setNewPothole({ ...newPothole, severity: e.target.value as any })} className={selectClass} style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Address / Description</label>
                  <input type="text" value={newPothole.address} onChange={(e) => setNewPothole({ ...newPothole, address: e.target.value })} className={inputClass} placeholder="e.g. Main Street, near post office" />
                </div>
                <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => setShowAddPothole(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="btn-primary flex-[2] justify-center disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Report</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ImageViewer url={viewingImage?.url || null} title={viewingImage?.title} onClose={() => setViewingImage(null)} />
    </div>
  );
}
