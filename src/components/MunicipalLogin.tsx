import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Building2, Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface MunicipalLoginProps {
  onBack: () => void;
}

export default function MunicipalLogin({ onBack }: MunicipalLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Verify role (check UID first, then email for first-time login)
      let userDoc;
      let emailDoc;
      
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
        emailDoc = await getDoc(doc(db, 'users', user.email?.toLowerCase().trim() || ''));
      } catch (dbErr: any) {
        console.error("Database check failed:", dbErr);
        await auth.signOut();
        throw new Error(`Database verification failed: ${dbErr.message}. Please contact the administrator.`);
      }
      
      const isMunicipal = (userDoc.exists() && userDoc.data().role === 'municipal') || 
                          (emailDoc.exists() && emailDoc.data().role === 'municipal');

      if (!isMunicipal) {
        await auth.signOut();
        throw new Error("Access denied. This account is not authorized for municipal login.");
      }
      
      // Success - App.tsx will handle the state change via onAuthStateChanged
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please check your credentials.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password authentication is not enabled in your Firebase project. Please enable it in the Firebase Console (Authentication > Sign-in method).");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 w-full max-w-md"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Citizen Portal
        </button>

        <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-600/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Pothole<span className="text-blue-500">Detection</span> IDP
            </h2>
            <p className="text-zinc-500 text-sm mt-2">Municipal Access Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 tracking-widest">Official Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="name@city.gov"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 tracking-widest">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-500 text-xs text-center"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authenticate'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
