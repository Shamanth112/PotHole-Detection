import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import CameraView from './components/CameraView';
import MapView from './components/MapView';
import PotholeList from './components/PotholeList';
import { usePotholes } from './hooks/usePotholes';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Camera, 
  LogOut, 
  User as UserIcon,
  ShieldAlert,
  Activity,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashcam' | 'map' | 'list'>('dashcam');
  const { potholes } = usePotholes();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            role: 'user'
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => auth.signOut();

  const handleDetection = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ef4444', '#f97316', '#eab308']
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-3xl shadow-2xl shadow-red-600/20 mb-8 rotate-3">
            <ShieldAlert className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase italic">
            Pothole<span className="text-red-600">Patrol</span> AI
          </h1>
          <p className="text-zinc-400 mb-12 text-lg leading-relaxed">
            Real-time AI-powered dashcam for safer roads. Detect, map, and report potholes instantly.
          </p>
          
          <button
            onClick={handleLogin}
            className="group relative w-full py-4 bg-white text-black font-bold rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-zinc-200 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 flex items-center justify-center gap-3">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </span>
          </button>
          
          <p className="mt-8 text-zinc-600 text-xs uppercase tracking-widest font-bold">
            Powered by TensorFlow.js & Firebase
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase italic">
            Patrol<span className="text-red-600">AI</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Live Sync</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <img 
            src={user.photoURL || ''} 
            className="w-8 h-8 rounded-full border border-zinc-700" 
            alt="User" 
          />
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-4rem)]">
        {/* Left Column: Main View */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-full">
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {activeTab === 'dashcam' && (
                <motion.div 
                  key="dashcam"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="h-full"
                >
                  <CameraView onDetection={handleDetection} />
                </motion.div>
              )}
              {activeTab === 'map' && (
                <motion.div 
                  key="map"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="h-full"
                >
                  <MapView potholes={potholes} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Mobile Tab Bar */}
          <div className="bg-zinc-900/80 backdrop-blur-md p-2 rounded-2xl border border-zinc-800 flex items-center justify-around">
            <TabButton 
              active={activeTab === 'dashcam'} 
              onClick={() => setActiveTab('dashcam')}
              icon={<Camera className="w-5 h-5" />}
              label="Dashcam"
            />
            <TabButton 
              active={activeTab === 'map'} 
              onClick={() => setActiveTab('map')}
              icon={<MapIcon className="w-5 h-5" />}
              label="Map"
            />
            <TabButton 
              active={activeTab === 'list'} 
              onClick={() => setActiveTab('list')}
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="Stats"
            />
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="lg:col-span-4 hidden lg:flex flex-col gap-6 h-full min-h-0">
          <div className="flex-1 min-h-0">
            <PotholeList potholes={potholes} />
          </div>
          
          {/* Stats Card */}
          <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Session Stats</h4>
              <Settings className="w-4 h-4 text-zinc-700" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                <span className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Detections</span>
                <span className="text-2xl font-black text-red-500">{potholes.length}</span>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                <span className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Accuracy</span>
                <span className="text-2xl font-black text-emerald-500">94%</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile Overlay for List */}
      <AnimatePresence>
        {activeTab === 'list' && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[60] bg-black p-4 lg:hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Detection History</h2>
              <button onClick={() => setActiveTab('dashcam')} className="p-2 bg-zinc-800 rounded-full">
                <LogOut className="w-5 h-5 rotate-180" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)]">
              <PotholeList potholes={potholes} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
        active ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
