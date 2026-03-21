import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import CameraView from './components/CameraView';
import MapView from './components/MapView';
import PotholeList from './components/PotholeList';
import MunicipalLogin from './components/MunicipalLogin';
import MunicipalDashboard from './components/MunicipalDashboard';
import AdminDashboard from './components/AdminDashboard';
import { usePotholes } from './hooks/usePotholes';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Camera, 
  LogOut, 
  ShieldAlert,
  Activity,
  Settings,
  Building2,
  ShieldCheck,
  ArrowLeft,
  User as UserIcon,
  History,
  Scan
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'municipal' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'scan' | 'history' | 'profile'>('map');
  const { potholes } = usePotholes();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          let role: 'user' | 'admin' | 'municipal' = 'user';
          
          const isDefaultAdmin = user.email === "shamanth.p2007@gmail.com";
          
          if (userSnap.exists()) {
            role = userSnap.data().role;
            if (isDefaultAdmin && role !== 'admin') {
              role = 'admin';
            }
          } else {
            const emailKey = user.email?.toLowerCase().trim() || '';
            const emailRef = doc(db, 'users', emailKey);
            const emailSnap = await getDoc(emailRef);
            
            if (emailSnap.exists() && emailSnap.data().role === 'municipal') {
              role = 'municipal';
              await setDoc(userRef, {
                ...emailSnap.data(),
                uid: user.uid,
                isPending: false,
                displayName: user.displayName || emailSnap.data().displayName || 'Municipal User',
                photoURL: user.photoURL || null
              });
            } else {
              role = isDefaultAdmin ? 'admin' : 'user';
              await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                role: role
              });
            }
          }
          setUser(user);
          setUserRole(role);
        } else {
          setUser(null);
          setUserRole(null);
        }
      } catch (error: any) {
        console.error("Auth state change error:", error);
        if (error.code === 'permission-denied') {
          auth.signOut();
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Domain not authorized! Please add your Vercel URL to the 'Authorized domains' list in the Firebase Console (Authentication > Settings).");
      } else {
        alert("Login failed: " + error.message);
      }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

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
        <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user && userRole === 'municipal') {
    return (
      <div className="min-h-screen bg-black">
        <header className="h-16 border-b border-zinc-800 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase italic">
              Road<span className="text-blue-600">Core</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} className="w-8 h-8 rounded-full border border-zinc-700" alt="User" />
          </div>
        </header>
        <MunicipalDashboard potholes={potholes} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/municipal" element={
        !user ? <MunicipalLogin onBack={() => navigate('/')} /> : <Navigate to="/" />
      } />
      
      <Route path="/admin" element={
        user && userRole === 'admin' ? (
          <div className="min-h-screen bg-black text-white">
            <header className="h-16 border-b border-zinc-800 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                <span className="font-black text-xl tracking-tighter uppercase italic">Admin Console</span>
              </div>
              <button onClick={() => navigate('/')} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to App
              </button>
            </header>
            <div className="p-6">
              <AdminDashboard />
            </div>
          </div>
        ) : <Navigate to="/" />
      } />

      <Route path="/" element={
        !user ? (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center max-w-md">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-3xl shadow-2xl mb-8 rotate-3">
                <ShieldAlert className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase italic">
                Road<span className="text-red-600">Core</span>
              </h1>
              <p className="text-zinc-400 mb-12 text-lg">Real-time AI-powered dashcam for safer roads.</p>
              <div className="space-y-4">
                <button onClick={handleLogin} className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Citizen Login
                </button>
                <button onClick={() => navigate('/municipal')} className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Municipal Login
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col">
            {/* Mobile Header */}
            <header className="h-16 border-b border-zinc-800 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-600">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-xl tracking-tighter uppercase italic">
                  Road<span className="text-red-600">Core</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                {userRole === 'admin' && (
                  <button onClick={() => navigate('/admin')} className="hidden sm:flex items-center gap-2 bg-emerald-600/20 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/30 text-[10px] font-bold uppercase">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </button>
                )}
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} className="w-8 h-8 rounded-full border border-zinc-700" alt="User" />
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'map' && (
                  <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                    <MapView potholes={potholes} />
                  </motion.div>
                )}
                {activeTab === 'scan' && (
                  <motion.div key="scan" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute inset-0 z-10">
                    <CameraView onDetection={handleDetection} />
                  </motion.div>
                )}
                {activeTab === 'history' && (
                  <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute inset-0 bg-black p-4 overflow-y-auto">
                    <div className="max-w-2xl mx-auto">
                      <h2 className="text-2xl font-black uppercase italic mb-6">Detection History</h2>
                      <PotholeList potholes={potholes} />
                    </div>
                  </motion.div>
                )}
                {activeTab === 'profile' && (
                  <motion.div key="profile" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute inset-0 bg-zinc-950 p-6 flex flex-col items-center overflow-y-auto">
                    <div className="w-full max-w-sm flex flex-col items-center pt-12">
                      <div className="relative mb-6">
                        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} className="w-24 h-24 rounded-full border-4 border-red-600 shadow-2xl" alt="Profile" />
                        <div className="absolute -bottom-2 -right-2 bg-red-600 p-2 rounded-full shadow-lg">
                          <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold mb-1">{user.displayName || 'Road Guardian'}</h3>
                      <p className="text-zinc-500 text-sm mb-8">{user.email}</p>
                      
                      <div className="grid grid-cols-2 gap-4 w-full mb-8">
                        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Reports</p>
                          <p className="text-2xl font-black text-red-500">{potholes.filter(p => p.userId === user.uid).length}</p>
                        </div>
                        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Points</p>
                          <p className="text-2xl font-black text-emerald-500">{potholes.filter(p => p.userId === user.uid).length * 10}</p>
                        </div>
                      </div>

                      <div className="space-y-3 w-full">
                        <button className="w-full py-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-between px-6 hover:bg-zinc-800 transition-all">
                          <div className="flex items-center gap-3">
                            <Settings className="w-5 h-5 text-zinc-400" />
                            <span className="font-bold">Account Settings</span>
                          </div>
                          <ArrowLeft className="w-4 h-4 rotate-180 text-zinc-600" />
                        </button>
                        <button className="w-full py-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-between px-6 hover:bg-zinc-800 transition-all">
                          <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-zinc-400" />
                            <span className="font-bold">My Activity</span>
                          </div>
                          <ArrowLeft className="w-4 h-4 rotate-180 text-zinc-600" />
                        </button>
                        <button onClick={handleLogout} className="w-full py-4 bg-red-600/10 text-red-500 rounded-2xl border border-red-600/20 flex items-center justify-center gap-3 font-bold hover:bg-red-600/20 transition-all mt-4">
                          <LogOut className="w-5 h-5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* Bottom Navigation */}
            <nav className="h-20 bg-black/80 backdrop-blur-2xl border-t border-zinc-800 px-6 flex items-center justify-between pb-2 z-50">
              <NavButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon className="w-6 h-6" />} label="Map" />
              <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History className="w-6 h-6" />} label="History" />
              
              {/* Center Scan Button */}
              <div className="relative -top-6">
                <button 
                  onClick={() => setActiveTab('scan')}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    activeTab === 'scan' ? 'bg-white text-black scale-110' : 'bg-red-600 text-white hover:scale-105'
                  }`}
                >
                  <Scan className="w-8 h-8" />
                </button>
              </div>

              <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon className="w-6 h-6" />} label="Profile" />
              <NavButton active={false} onClick={() => alert("More features coming soon!")} icon={<Settings className="w-6 h-6" />} label="More" />
            </nav>
          </div>
        )
      } />
    </Routes>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-red-500 rounded-full mt-0.5" />}
    </button>
  );
}

