import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserPlus, Users, ShieldCheck, Mail, Key, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';

// Initialize a secondary app for creating users without signing out the admin
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp');
const secondaryAuth = getAuth(secondaryApp);

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid index requirement
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
      // 1. Create the user in Firebase Auth using the secondary app
      // This creates the user without affecting the current admin's session
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;
      
      // Immediately sign out from the secondary app to keep it clean
      await signOut(secondaryAuth);

      // 2. Create the Firestore record using the real UID
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: email.toLowerCase().trim(),
        role: 'municipal',
        displayName: 'Municipal User',
        initialPassword: password, // Store for admin reference
        createdAt: new Date().toISOString()
      });

      setEmail('');
      setPassword('');
      fetchUsers();
      setSuccess(`Successfully created municipal account for ${email}. They can now log in immediately.`);
    } catch (err: any) {
      console.error("Error adding municipal user:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered in Firebase Authentication.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak. Please use at least 6 characters.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email}? This will remove their Firestore record and attempt to delete their Auth account.`)) {
      return;
    }

    setDeletingId(user.id);
    setError('');
    setSuccess('');

    try {
      // 1. Delete Firestore record
      await deleteDoc(doc(db, 'users', user.id));

      // 2. Attempt to delete from Firebase Auth (if it's a municipal user we created)
      if (user.role === 'municipal' && user.initialPassword) {
        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, user.email, user.initialPassword);
          await deleteUser(userCredential.user);
          await signOut(secondaryAuth);
        } catch (authErr) {
          console.warn("Could not delete from Auth (password might have changed):", authErr);
          // We don't throw here because the Firestore record is already gone, which revokes access
        }
      }

      setSuccess(`User ${user.email} deleted successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(`Failed to delete user: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const togglePassword = (email: string) => {
    setShowPasswords(prev => ({ ...prev, [email]: !prev[email] }));
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : 'Register Municipal User'}
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
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-bold text-white truncate">{u.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                      u.role === 'admin' ? 'bg-purple-500' : 
                      u.role === 'municipal' ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}>
                      {u.role}
                    </span>
                    {u.role === 'municipal' && u.initialPassword && (
                      <div className="flex items-center gap-2 ml-2">
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {showPasswords[u.email] ? u.initialPassword : '••••••••'}
                        </p>
                        <button 
                          onClick={() => togglePassword(u.email)}
                          className="text-zinc-600 hover:text-white transition-colors"
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
      </div>
    </div>
  );
}
