import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { UserPlus, Users, ShieldCheck, Mail, Key, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const usersList = querySnapshot.docs.map(doc => doc.data());
    setUsers(usersList);
  };

  const handleCreateMunicipal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const tempId = Math.random().toString(36).substring(7);
      await setDoc(doc(db, 'users', tempId), {
        uid: tempId,
        email,
        role: 'municipal',
        displayName: 'Municipal User'
      });

      setEmail('');
      setPassword('');
      fetchUsers();
      setSuccess("Municipal user record created in Firestore. Note: You must also create the login in Firebase Auth Console with this email.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-8 h-8 text-emerald-500" />
        <h2 className="text-2xl font-bold text-white">Admin Control Panel</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create User Form */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            Create Municipal Account
          </h3>
          <form onSubmit={handleCreateMunicipal} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="municipal@city.gov"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Initial Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {success && <p className="text-emerald-500 text-xs bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Register Municipal User'}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            Active Users
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {users.map((u, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800">
                <div>
                  <p className="text-sm font-bold text-white">{u.email}</p>
                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                    u.role === 'admin' ? 'bg-purple-500' : 
                    u.role === 'municipal' ? 'bg-emerald-500' : 'bg-zinc-600'
                  }`}>
                    {u.role}
                  </span>
                </div>
                <button className="p-2 text-zinc-700 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
