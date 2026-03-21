import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import HomeView from './components/HomeView';
import ReportView from './components/ReportView';
import CameraView from './components/CameraView';
import MapView from './components/MapView';
import PotholeList from './components/PotholeList';
import MunicipalDashboard from './components/MunicipalDashboard';
import AdminDashboard from './components/AdminDashboard';
import { usePotholes } from './hooks/usePotholes';
import { dbService } from './services/databaseService';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Camera, 
  LogOut, 
  ShieldAlert,
  Activity,
  Settings,
  ShieldCheck,
  ArrowLeft,
  User as UserIcon,
  History,
  Scan,
  Home as HomeIcon,
  ChevronRight,
  Bell,
  Award,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { uploadPotholeImage } from './services/storageService';

type Tab = 'home' | 'map' | 'history' | 'scan' | 'profile' | 'report';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'admin' | 'municipal' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { potholes } = usePotholes();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Request GPS permission
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }, (error) => console.error("Error watching position:", error), { enableHighAccuracy: true });
      
      // Request Camera permission (trigger prompt)
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            // Stop tracks immediately after permission is granted to avoid keeping camera on
            stream.getTracks().forEach(track => track.stop());
          })
          .catch(err => console.error("Camera permission denied or error:", err));
      }

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          let role: 'user' | 'admin' | 'municipal' = 'user';
          const isDefaultAdmin = user.email === "shamanth.p2007@gmail.com";
          
          // Check permitted_users table for assigned role
          const permitted = await dbService.getPermittedUser(user.email || '');
          
          if (permitted) {
            role = permitted.role;
          } else if (isDefaultAdmin) {
            role = 'admin';
          }

          // Sync with users table
          await dbService.upsertUserProfile({
            uid: user.uid,
            displayName: user.displayName || undefined,
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            role: role
          });

          setUser(user);
          setUserRole(role);
        } else {
          setUser(null);
          setUserRole(null);
        }
      } catch (error: any) {
        console.error("Auth state change error:", error);
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
      // Ignore common user-cancellation errors
      if (
        error.code === 'auth/popup-closed-by-user' || 
        error.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      console.error("Login failed:", error);
      
      if (error.code === 'auth/unauthorized-domain') {
        alert("Domain not authorized! Please add this URL to the 'Authorized domains' list in the Firebase Console (Authentication > Settings > Authorized domains):\n\n" + window.location.hostname);
      } else if (error.code === 'auth/operation-not-allowed') {
        alert("Google Sign-In is not enabled! Please go to the Firebase Console > Authentication > Sign-in method and enable 'Google'.");
      } else {
        alert("Login failed: " + error.message + " (Code: " + error.code + ")");
      }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const photoURL = await uploadPotholeImage(file, `profiles/${user.uid}_${Date.now()}.jpg`);
      await updateProfile(user, { photoURL });
      
      // Update Supabase user profile
      await dbService.upsertUserProfile({
        uid: user.uid,
        displayName: user.displayName || undefined,
        email: user.email || '',
        photoURL: photoURL,
        role: userRole || 'user'
      });
      
      // Force refresh user state
      const updatedUser = auth.currentUser;
      if (updatedUser) setUser({ ...updatedUser });
      
      alert("Profile photo updated successfully!");
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      alert("Failed to upload profile photo.");
    }
  };

  const handleReportPothole = async (data: { latitude: number; longitude: number; severity: string; address?: string; reportImageUrl?: string; notes?: string }, isAuto = false) => {
    if (!user) return;
    try {
      await dbService.addPothole({
        ...data,
        severity: data.severity as any,
        userId: user.uid,
        userName: user.displayName || 'Road Guardian',
        status: 'reported',
        timestamp: new Date().toISOString(),
      });
      
      if (!isAuto) {
        setActiveTab('history');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#f97316', '#eab308']
        });
      }
    } catch (error) {
      console.error("Error reporting pothole:", error);
      alert("Failed to report pothole.");
    }
  };

  const handleDetection = (detection: any, imageUrl: string) => {
    if (!userLocation) return;
    
    // Auto-report to municipal silently
    handleReportPothole({
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      severity: detection.score > 0.8 ? 'high' : 'medium',
      address: 'AI Detected - Road Focus Active',
      reportImageUrl: imageUrl
    }, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user && (userRole === 'municipal' || userRole === 'admin')) {
    return (
      <div className="min-h-screen bg-black">
        <header className="h-16 border-b border-zinc-800 bg-black/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase italic">
              Pothole<span className="text-blue-600">Detection</span> IDP
            </span>
          </div>
          <div className="flex items-center gap-4">
            {userRole === 'admin' && (
              <button 
                onClick={() => navigate('/admin')}
                className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Admin Console
              </button>
            )}
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
          <div className="min-h-screen bg-[#1a365d] flex flex-col items-center justify-center p-6 text-white font-sans">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md text-center space-y-8"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl">
                  <Shield className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-4xl font-black tracking-tighter">RoadGuard</h1>
                <p className="text-blue-100/70 text-sm font-medium max-w-[240px] mx-auto">
                  AI-Powered Pothole Detection & Road Safety Management
                </p>
              </div>

              <div className="space-y-4 pt-8">
                <button 
                  onClick={handleLogin}
                  className="w-full bg-white text-[#1a365d] py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-blue-50 transition-all active:scale-95"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Continue with Google
                </button>
              </div>

              <p className="text-[10px] text-white/40 font-medium pt-12">
                By continuing, you agree to our Terms & Privacy Policy
              </p>

            </motion.div>
          </div>
        ) : (
          <div className="min-h-screen bg-[#f7fafc] flex font-sans relative overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-[#1a365d] text-white p-6 sticky top-0 h-screen shadow-2xl z-50">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="font-black text-xl tracking-tighter uppercase italic">RoadGuard</span>
              </div>

              <nav className="flex-1 space-y-2">
                <SidebarButton 
                  active={activeTab === 'home'} 
                  onClick={() => setActiveTab('home')} 
                  icon={<HomeIcon className="w-5 h-5" />} 
                  label="Dashboard" 
                />
                <SidebarButton 
                  active={activeTab === 'map'} 
                  onClick={() => setActiveTab('map')} 
                  icon={<MapIcon className="w-5 h-5" />} 
                  label="Live Map" 
                />
                <SidebarButton 
                  active={activeTab === 'history'} 
                  onClick={() => setActiveTab('history')} 
                  icon={<History className="w-5 h-5" />} 
                  label="Report History" 
                />
                <SidebarButton 
                  active={activeTab === 'scan'} 
                  onClick={() => setActiveTab('scan')} 
                  icon={<Scan className="w-5 h-5" />} 
                  label="AI Scanner" 
                />
                <SidebarButton 
                  active={activeTab === 'profile'} 
                  onClick={() => setActiveTab('profile')} 
                  icon={<UserIcon className="w-5 h-5" />} 
                  label="My Profile" 
                />
                {userRole === 'admin' && (
                  <SidebarButton 
                    active={false} 
                    onClick={() => navigate('/admin')} 
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />} 
                    label="Admin Console" 
                  />
                )}
              </nav>

              <div className="mt-auto pt-6 border-t border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
                    className="w-10 h-10 rounded-xl border border-white/20"
                    alt="User"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{user.displayName || 'Guardian'}</p>
                    <p className="text-[10px] text-blue-200/50 truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm font-bold"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-hidden pb-20 md:pb-0">
              <div className="h-full max-w-6xl mx-auto">
                <AnimatePresence mode="wait">
                {activeTab === 'home' && (
                  <motion.div 
                    key="home"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="h-full"
                  >
                    <HomeView 
                      onStartDetection={() => setActiveTab('scan')}
                      onReportManually={() => setActiveTab('report')}
                      stats={{
                        detectedToday: potholes.filter(p => {
                          const today = new Date();
                          const pDate = new Date(p.timestamp);
                          return pDate.toDateString() === today.toDateString();
                        }).length,
                        fixedThisWeek: potholes.filter(p => p.status === 'resolved').length
                      }}
                    />
                  </motion.div>
                )}

                {activeTab === 'map' && (
                  <motion.div 
                    key="map"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <MapView potholes={potholes} onAddReport={() => setActiveTab('report')} />
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div 
                    key="history"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="h-full"
                  >
                    <PotholeList potholes={potholes} />
                  </motion.div>
                )}

                {activeTab === 'scan' && (
                  <motion.div 
                    key="scan"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="h-full"
                  >
                    <CameraView 
                      onDetection={handleDetection} 
                      onBack={() => setActiveTab('home')} 
                      gpsActive={!!userLocation}
                    />
                  </motion.div>
                )}

                {activeTab === 'report' && (
                  <motion.div 
                    key="report"
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="h-full"
                  >
                    <ReportView 
                      onBack={() => setActiveTab('home')} 
                      onSubmit={(data) => handleReportPothole(data)} 
                    />
                  </motion.div>
                )}

                {activeTab === 'profile' && (
                  <motion.div 
                    key="profile"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full bg-white flex flex-col"
                  >
                    <header className="bg-[#1a365d] text-white p-8 pb-20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                      <div className="flex justify-between items-start mb-6">
                        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
                        <button className="p-2 bg-white/10 rounded-full">
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="relative group">
                          <div className="w-20 h-20 rounded-3xl border-4 border-white/20 overflow-hidden shadow-2xl">
                            <img 
                              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
                              className="w-full h-full object-cover"
                              alt="Profile"
                            />
                          </div>
                          <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-3xl">
                            <Camera className="w-6 h-6 text-white" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleProfilePhotoUpload} />
                          </label>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{user.displayName || 'Road Guardian'}</h2>
                          <p className="text-blue-100/60 text-xs font-medium">{user.email}</p>
                          <div className="mt-2 flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                            <Award className="w-3 h-3" />
                            Elite Reporter
                          </div>
                        </div>
                      </div>
                    </header>

                    <div className="flex-1 p-6 -mt-12 bg-white rounded-t-[40px] shadow-2xl space-y-8 overflow-y-auto">
                      {/* Stats Cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#f7fafc] p-5 rounded-3xl border border-[#e2e8f0] flex flex-col items-center text-center">
                          <p className="text-3xl font-black text-[#1a365d] mb-1">{potholes.filter(p => p.userId === user.uid).length}</p>
                          <p className="text-[10px] font-bold text-[#718096] uppercase tracking-widest">Reports</p>
                        </div>
                        <div className="bg-[#f7fafc] p-5 rounded-3xl border border-[#e2e8f0] flex flex-col items-center text-center">
                          <p className="text-3xl font-black text-[#1a365d] mb-1">{potholes.filter(p => p.userId === user.uid).length * 50}</p>
                          <p className="text-[10px] font-bold text-[#718096] uppercase tracking-widest">Points</p>
                        </div>
                      </div>

                      {/* Menu Sections */}
                      <section className="space-y-4">
                        <h3 className="text-xs font-black text-[#a0aec0] uppercase tracking-[0.2em] px-2">Account Settings</h3>
                        <div className="space-y-2">
                          <ProfileMenuItem icon={<Bell className="w-5 h-5" />} label="Notifications" />
                          <ProfileMenuItem icon={<Shield className="w-5 h-5" />} label="Privacy & Security" />
                          <ProfileMenuItem icon={<Award className="w-5 h-5" />} label="My Achievements" />
                          {userRole === 'admin' && (
                            <button 
                              onClick={() => navigate('/admin')}
                              className="w-full flex items-center justify-between p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-100 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5" />
                                <span>Admin Console</span>
                              </div>
                              <ChevronRight className="w-4 h-4 opacity-50" />
                            </button>
                          )}
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-xs font-black text-[#a0aec0] uppercase tracking-[0.2em] px-2">Support</h3>
                        <div className="space-y-2">
                          <ProfileMenuItem icon={<InfoIcon className="w-5 h-5" />} label="Help Center" />
                          <button 
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between p-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <LogOut className="w-5 h-5" />
                              <span>Sign Out</span>
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-50" />
                          </button>
                        </div>
                      </section>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

            {/* Bottom Navigation (Mobile Only) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] px-6 py-3 flex justify-between items-center z-50 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
              <NavButton 
                active={activeTab === 'home'} 
                onClick={() => setActiveTab('home')} 
                icon={<HomeIcon className="w-6 h-6" />} 
                label="Home" 
              />
              <NavButton 
                active={activeTab === 'map'} 
                onClick={() => setActiveTab('map')} 
                icon={<MapIcon className="w-6 h-6" />} 
                label="Map" 
              />
              
              {/* Central Scan Button */}
              <div className="relative -mt-12">
                <button 
                  onClick={() => setActiveTab('scan')}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${
                    activeTab === 'scan' ? 'bg-[#1a365d] text-white' : 'bg-[#1a365d] text-white'
                  }`}
                >
                  <Scan className="w-8 h-8" />
                </button>
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#1a365d] uppercase tracking-widest">Scan</span>
              </div>

              <NavButton 
                active={activeTab === 'history'} 
                onClick={() => setActiveTab('history')} 
                icon={<History className="w-6 h-6" />} 
                label="History" 
              />
              <NavButton 
                active={activeTab === 'profile'} 
                onClick={() => setActiveTab('profile')} 
                icon={<UserIcon className="w-6 h-6" />} 
                label="Profile" 
              />
            </nav>
          </div>
        )
      } />
    </Routes>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${
        active ? 'text-[#1a365d]' : 'text-[#a0aec0] hover:text-[#718096]'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-[#1a365d] rounded-full" />}
    </button>
  );
}

function SidebarButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${
        active ? 'bg-white text-[#1a365d] shadow-lg' : 'text-blue-100/70 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-[#1a365d] rounded-full" />}
    </button>
  );
}

function ProfileMenuItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center justify-between p-4 bg-[#f7fafc] hover:bg-[#edf2f7] rounded-2xl transition-all group">
      <div className="flex items-center gap-3 text-[#4a5568]">
        <div className="text-[#1a365d]">{icon}</div>
        <span className="font-bold text-sm">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-[#cbd5e0] group-hover:text-[#4a5568] transition-all" />
    </button>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

