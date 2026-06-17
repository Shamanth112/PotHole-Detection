import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthActions } from '@convex-dev/auth/react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import HomeView from './components/HomeView';
import ReportView from './components/ReportView';
import CameraView from './components/CameraView';
import MapView from './components/MapView';
import PotholeList from './components/PotholeList';
import MunicipalDashboard from './components/MunicipalDashboard';
import AdminDashboard from './components/AdminDashboard';
import OnboardingTour from './components/OnboardingTour';
import { usePotholes } from './hooks/usePotholes';
import { uploadToConvex } from './services/storageService';
import {
  LayoutDashboard, Map as MapIcon, Camera as CameraIcon, LogOut, ShieldAlert,
  Activity, Settings, ShieldCheck, ArrowLeft, User as UserIcon,
  History, Scan, Home as HomeIcon, ChevronRight, Bell, Award,
  Shield, Loader2, FileText, Zap, TrendingUp, Star, Menu, X, MapPin,
  Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from './hooks/useTheme';

type Tab = 'home' | 'map' | 'history' | 'scan' | 'profile' | 'report';

export default function App() {
  const { signIn, signOut } = useAuthActions();
  const user = useQuery(api.users.getSelf);
  const loading = user === undefined;

  const updateAvatarBase = useMutation(api.users.updateAvatar);
  const reportPotholeBase = useMutation(api.potholes.report);
  const convex = useConvex();

  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { potholes } = usePotholes();
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();

  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  useEffect(() => {
    // 1. Geolocation Permission Query
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state);
        result.onchange = () => {
          setLocationPermission(result.state);
        };
      }).catch(err => console.error("Error querying location permission:", err));

      // 2. Camera Permission Query
      navigator.permissions.query({ name: 'camera' as any }).then((result) => {
        setCameraPermission(result.state);
        result.onchange = () => {
          setCameraPermission(result.state);
        };
      }).catch(() => {
        navigator.mediaDevices?.enumerateDevices().then(devices => {
          const hasLabels = devices.some(d => d.label !== "");
          if (hasLabels) setCameraPermission('granted');
        }).catch(() => {});
      });
    }
  }, []);

  // Geolocation position watcher
  useEffect(() => {
    if (locationPermission === 'granted' && "geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      }, (error) => {
        console.error("Error watching position:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermission('denied');
        }
      }, { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [locationPermission]);

  const requestPermissions = async () => {
    // Request Location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationPermission('granted');
        },
        (error) => {
          console.error("Location request error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermission('denied');
          }
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocationPermission('denied');
    }

    // Request Camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setCameraPermission('granted');
      } catch (err: any) {
        console.error("Camera request error:", err);
        setCameraPermission('denied');
      }
    } else {
      setCameraPermission('denied');
    }
  };

  const handleLogin = async () => {
    try { await signIn("google"); }
    catch (error: any) { console.error("Login failed:", error); alert("Login failed: " + error.message); }
  };

  const handleLogout = async () => { await signOut(); navigate('/'); };

  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const storageId = await uploadToConvex(convex, file);
      const url = await convex.query(api.storage.getImageUrl, { storageId: storageId as Id<"_storage"> });
      if (url) { await updateAvatarBase({ avatarUrl: url }); }
    } catch (error) { console.error("Error uploading profile photo:", error); }
  };

  const handleReportPothole = async (data: { latitude: number; longitude: number; severity: string; address?: string; reportImageUrl?: string; reportImageId?: string }, isAuto = false) => {
    if (!user) return;
    try {
      const potholeId = await reportPotholeBase({
        latitude: data.latitude, longitude: data.longitude,
        severity: data.severity as any, address: data.address,
        reportImageUrl: data.reportImageUrl, reportImageId: data.reportImageId as any,
        userName: user.name ?? 'Road Guardian',
      });
      if (!isAuto) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#3b82f6', '#06b6d4', '#10b981'] });
      }
      return potholeId;
    } catch (error: any) {
      console.error("Error reporting pothole:", error);
      if (!isAuto) alert("Failed to submit report: " + (error?.message || JSON.stringify(error)));
      throw error;
    }
  };

  const handleDetection = (detection: any, imageUrl: string, storageId?: string) => {
    const lat = userLocation?.lat ?? 0;
    const lng = userLocation?.lng ?? 0;
    handleReportPothole({
      latitude: lat, longitude: lng,
      severity: detection.score > 0.8 ? 'high' : detection.score > 0.5 ? 'medium' : 'low',
      address: userLocation ? 'AI Detected - Road Scan' : 'AI Detected (GPS unavailable)',
      reportImageUrl: imageUrl, reportImageId: storageId,
    }, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl gradient-blue flex items-center justify-center glow-blue">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl gradient-blue opacity-30 animate-ping" />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Loading RoadGuard...</p>
        </div>
      </div>
    );
  }

  if (user && (locationPermission !== 'granted' || cameraPermission !== 'granted')) {
    return (
      <div className="min-h-screen login-bg flex flex-col items-center justify-center p-6 relative overflow-hidden text-white">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8" style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md glass-strong rounded-3xl p-8 space-y-6 text-center relative z-10 animate-float"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 mb-2">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Permissions Required</h2>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              RoadGuard needs Location and Camera access to scan road potholes and tag report locations.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between p-3.5 rounded-xl glass border" style={{ borderColor: locationPermission === 'granted' ? 'rgba(16,185,129,0.2)' : 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${locationPermission === 'granted' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <div>
                  <p className="text-xs font-bold">Location Access</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Required for GPS coordination</p>
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                locationPermission === 'granted' ? 'badge-resolved' : locationPermission === 'denied' ? 'badge-high' : 'badge-reported'
              }`}>
                {locationPermission}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl glass border" style={{ borderColor: cameraPermission === 'granted' ? 'rgba(16,185,129,0.2)' : 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <CameraIcon className={`w-5 h-5 ${cameraPermission === 'granted' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <div>
                  <p className="text-xs font-bold">Camera Access</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Required for AI scanner</p>
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                cameraPermission === 'granted' ? 'badge-resolved' : cameraPermission === 'denied' ? 'badge-high' : 'badge-reported'
              }`}>
                {cameraPermission}
              </span>
            </div>
          </div>

          {(locationPermission === 'denied' || cameraPermission === 'denied') ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed text-left">
              <strong>Permissions Blocked:</strong> Geolocation or camera permission is blocked. Please open your site settings (click the lock/settings icon in the browser address bar) and allow Location and Camera, then refresh the page.
            </div>
          ) : (
            <button 
              onClick={requestPermissions}
              className="w-full btn-primary justify-center py-3.5 cursor-pointer"
            >
              Grant Permissions
            </button>
          )}
          
          <button onClick={handleLogout} className="text-xs font-bold transition-all text-zinc-400 hover:text-white pt-2 block mx-auto cursor-pointer">
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  if (user && user.role === 'municipal') {
    return (
      <div className="min-h-screen app-bg">
        <header className="h-16 glass-strong flex items-center justify-between px-6 sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center glow-blue">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">
              Road<span className="gradient-text-blue">Guard</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="theme-toggle" title={isDark ? 'Switch to Light' : 'Switch to Dark'} aria-label="Toggle theme" />
            <button onClick={handleLogout} className="p-2 rounded-xl glass hover:border-opacity-50 transition-all" style={{ color: 'var(--text-secondary)' }}>
              <LogOut className="w-5 h-5" />
            </button>
            <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`}
              className="w-9 h-9 rounded-xl object-cover border" style={{ borderColor: 'var(--border)' }} alt="User" />
          </div>
        </header>
        <MunicipalDashboard potholes={potholes} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/admin" element={
        user && user.role === 'admin' ? (
          <div className="min-h-screen app-bg text-white">
            <header className="h-16 glass-strong flex items-center justify-between px-6 sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-emerald flex items-center justify-center glow-green">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-lg md:text-xl tracking-tight">Admin <span className="hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>Console</span></span>
              </div>
              <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-semibold px-3 md:px-4 py-2 rounded-xl glass transition-all" style={{ color: 'var(--text-secondary)' }}>
                <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to App</span>
              </button>
            </header>
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              <AdminDashboard />
            </div>
          </div>
        ) : <Navigate to="/" />
      } />

      <Route path="/municipal" element={
        user && (user.role === 'municipal' || user.role === 'admin') ? (
          <div className="min-h-screen app-bg text-white">
            <header className="h-16 glass-strong flex items-center justify-between px-6 sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center glow-blue">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-lg md:text-xl tracking-tight">Municipal <span className="hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>Dashboard</span></span>
              </div>
              <div className="flex items-center gap-3">
                {user.role === 'admin' && (
                  <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-semibold px-3 md:px-4 py-2 rounded-xl glass transition-all" style={{ color: 'var(--text-secondary)' }}>
                    <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to App</span>
                  </button>
                )}
                <button onClick={handleLogout} className="p-2 rounded-xl glass hover:border-opacity-50 transition-all text-red-400">
                  <LogOut className="w-5 h-5" />
                </button>
                <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`}
                  className="w-9 h-9 rounded-xl object-cover border" style={{ borderColor: 'var(--border)' }} alt="User" />
              </div>
            </header>
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
              <MunicipalDashboard potholes={potholes} />
            </div>
          </div>
        ) : <Navigate to="/" />
      } />

      <Route path="/" element={
        !user ? (
          /* ════ LOGIN PAGE ════ */
          <div className="min-h-screen login-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8" style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md relative z-10"
            >
              {/* Logo */}
              <div className="text-center mb-12">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-flex items-center justify-center w-24 h-24 rounded-3xl gradient-blue glow-blue mb-6 relative"
                >
                  <Shield className="w-12 h-12 text-white" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-lg gradient-cyan flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                </motion.div>
                <h1 className="text-5xl font-black tracking-tight mb-2">
                  Road<span className="gradient-text-blue">Guard</span>
                </h1>
                <p className="text-sm font-medium max-w-[280px] mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  AI Pothole Detection &amp; Road Damage Reporting — the Smart City Solution for Road Safety
                </p>
              </div>

              {/* Feature pills — keyword-rich for SEO */}
              <div className="flex justify-center gap-2 mb-3 flex-wrap">
                {[
                  'AI Pothole Detection',
                  'Road Damage Reporting',
                  'Smart City Solution',
                  'Road Safety Platform',
                  'Infrastructure Monitoring',
                ].map((f) => (
                  <span key={f} className="glass px-3 py-1 rounded-full text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>✦ {f}</span>
                ))}
              </div>
              {/* Visually hidden — crawlable SEO text */}
              <p
                aria-hidden="false"
                style={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  padding: 0,
                  margin: '-1px',
                  overflow: 'hidden',
                  clip: 'rect(0,0,0,0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                RoadGuard is an AI pothole detection and road damage reporting app — a pothole reporting app and road safety platform built as a smart city solution for real-time infrastructure monitoring.
              </p>

              {/* Login card */}
              <div className="glass-strong rounded-3xl p-8 space-y-4">
                <h2 className="text-lg font-bold text-center mb-6">Sign in to continue</h2>
                <button
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                <p className="text-center text-xs pt-2" style={{ color: 'var(--text-muted)' }}>
                  By continuing, you agree to our Terms &amp; Privacy Policy
                </p>
              </div>
            </motion.div>
          </div>
        ) : (
          /* ════ MAIN APP ════ */
          <div className="flex min-h-screen app-bg">
            <OnboardingTour userName={user.name || 'Road Guardian'} />

            {/* Mobile Sidebar Overlay Backdrop */}
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden"
                style={{ zIndex: 45 }}
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* ── Sidebar ── */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''} flex flex-col`}>
              {/* Brand */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gradient-blue flex items-center justify-center glow-blue">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-black text-lg tracking-tight">Road<span className="gradient-text-blue">Guard</span></span>
                    <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>AI Platform</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)} 
                  className="p-1.5 rounded-lg glass text-zinc-400 hover:text-white transition-all md:hidden"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* GPS status pill */}
              <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 mb-4">
                <div className="pulse-dot w-2 h-2 rounded-full bg-emerald-400" style={{ '--tw-bg-opacity': 1 } as any}>
                  <div className="absolute inset-[-3px] rounded-full bg-emerald-400 opacity-40 animate-ping" />
                </div>
                <span className="text-xs font-semibold text-emerald-400">GPS Active</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {userLocation ? `${userLocation.lat.toFixed(2)}°` : 'Locating...'}
                </span>
              </div>

              {/* Theme toggle in sidebar */}
              <div className="flex items-center justify-between glass rounded-xl px-3 py-2 mb-4">
                <div className="flex items-center gap-2">
                  {isDark ? <Moon className="w-3.5 h-3.5" style={{ color: 'var(--accent-blue)' }} /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle"
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle theme"
                />
              </div>

              <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Navigation</p>

              {/* Nav items */}
              <nav className="flex-1 space-y-1" style={{ overflowY: 'auto', minHeight: 0 }}>
                <SidebarBtn active={activeTab === 'home'} onClick={() => handleNavClick('home')} icon={<HomeIcon className="w-4.5 h-4.5" />} label="Dashboard" data-tour="dashboard" />
                <SidebarBtn active={activeTab === 'map'}  onClick={() => handleNavClick('map')}  icon={<MapIcon  className="w-4.5 h-4.5" />} label="Live Map"   data-tour="map" />
                <SidebarBtn active={activeTab === 'history'} onClick={() => handleNavClick('history')} icon={<History className="w-4.5 h-4.5" />} label="Report History" data-tour="history" />
                <SidebarBtn active={activeTab === 'scan'} onClick={() => handleNavClick('scan')} icon={<Scan className="w-4.5 h-4.5" />} label="AI Scanner" data-tour="scan" />
                <SidebarBtn active={activeTab === 'report'} onClick={() => handleNavClick('report')} icon={<FileText className="w-4.5 h-4.5" />} label="Report" data-tour="report" />

                {user.role === 'admin' && (
                  <>
                    <div className="section-divider my-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Admin</p>
                    <SidebarBtn active={false} onClick={() => { navigate('/admin'); if (window.innerWidth < 768) setIsSidebarOpen(false); }} icon={<ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />} label="Admin Console" />
                  </>
                )}
              </nav>

              {/* User card */}
              <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 p-3 rounded-xl glass mb-2">
                  <div className="relative">
                    <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`}
                      className="w-10 h-10 rounded-xl object-cover" alt="User" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2" style={{ borderColor: 'var(--bg-primary)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{user.name || 'Guardian'}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                  </div>
                  <button onClick={() => handleNavClick('profile')} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}>
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => { handleLogout(); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-red-500/10 text-red-400">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 flex flex-col" style={{ marginLeft: '0' }}>

              {/* ── Mobile Top App-Bar (hidden on md+) ── */}
              <div className="mobile-header md:hidden">
                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className="p-1.5 rounded-lg glass text-zinc-300 hover:text-white mr-1"
                  >
                    <Menu className="w-4.5 h-4.5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight">
                      {activeTab === 'home' ? 'Dashboard' : activeTab === 'scan' ? 'AI Scanner' : activeTab === 'report' ? 'Report' : activeTab === 'map' ? 'Live Map' : activeTab === 'history' ? 'History' : 'Profile'}
                    </p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>RoadGuard AI</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleTheme} className="theme-toggle" title={isDark ? 'Switch to Light' : 'Switch to Dark'} aria-label="Toggle theme" />
                  <button className="relative p-2 rounded-xl glass" style={{ color: 'var(--text-secondary)' }}>
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  </button>
                  <img
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`}
                    className="w-8 h-8 rounded-xl object-cover border cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => setActiveTab('profile')}
                    alt="User"
                  />
                </div>
              </div>

              {/* Desktop top bar */}
              <div 
                className="hidden md:flex h-16 glass-strong items-center justify-between px-6 sticky top-0 z-40 border-b transition-all duration-300" 
                style={{ 
                  borderColor: 'var(--border)', 
                  marginLeft: isSidebarOpen ? '260px' : '0' 
                }}
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="p-2 rounded-xl glass hover:bg-white/5 transition-all text-zinc-300 hover:text-white"
                  >
                    <Menu className="w-4.5 h-4.5" />
                  </button>
                  <div>
                    <h2 className="font-bold text-base capitalize">{activeTab === 'home' ? 'Dashboard' : activeTab === 'scan' ? 'AI Scanner' : activeTab.replace('-', ' ')}</h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Welcome back, {user.name?.split(' ')[0] || 'Guardian'} 👋</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={toggleTheme} className="theme-toggle" title={isDark ? 'Switch to Light' : 'Switch to Dark'} aria-label="Toggle theme" />
                  <button className="relative p-2 rounded-xl glass" style={{ color: 'var(--text-secondary)' }}>
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
                  </button>
                  <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`}
                    className="w-9 h-9 rounded-xl object-cover border cursor-pointer" style={{ borderColor: 'var(--border)' }}
                    onClick={() => setActiveTab('profile')} alt="User" />
                </div>
              </div>

              {/* Content area — fullbleed for camera/map on mobile, safe-area padded otherwise */}
              <div 
                className={`flex-1 overflow-hidden md:pb-0 transition-all duration-300 ${
                  isSidebarOpen ? 'md:ml-[260px]' : 'md:ml-0'
                } ${
                  activeTab === 'scan' || activeTab === 'map'
                    ? 'mobile-main-fullbleed'
                    : 'mobile-main-content'
                }`}
              >
                <AnimatePresence mode="wait">
                  {activeTab === 'home' && (
                    <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="h-full overflow-y-auto pb-32 md:pb-48">
                      <HomeView
                        userRole={user.role as any}
                        onStartDetection={() => setActiveTab('scan')}
                        onReportManually={() => setActiveTab('report')}
                        stats={{
                          detectedToday: potholes.filter(p => { const today = new Date(); const pDate = new Date(p._creationTime); return pDate.toDateString() === today.toDateString(); }).length,
                          fixedThisWeek: potholes.filter(p => p.status === 'resolved').length
                        }}
                        totalReports={potholes.length}
                        userName={user.name || 'Guardian'}
                      />
                    </motion.div>
                  )}
                  {activeTab === 'map' && (
                    <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                      <MapView potholes={potholes} onAddReport={() => setActiveTab('report')} />
                    </motion.div>
                  )}
                  {activeTab === 'history' && (
                    <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto pb-32 md:pb-48">
                      <PotholeList potholes={potholes} />
                    </motion.div>
                  )}
                  {activeTab === 'scan' && (
                    <motion.div key="scan" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} className="h-full">
                      <CameraView onDetection={handleDetection} onBack={() => setActiveTab('home')} gpsActive={!!userLocation} userLocation={userLocation} />
                    </motion.div>
                  )}
                  {activeTab === 'report' && (
                    <motion.div key="report" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="h-full overflow-y-auto pb-32 md:pb-48">
                      <ReportView onBack={() => setActiveTab('home')} onSubmit={(data) => handleReportPothole(data) as any} userId={user._id as string} />
                    </motion.div>
                  )}
                  {activeTab === 'profile' && (
                    <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-y-auto pb-32 md:pb-48">
                      <ProfileView user={user} potholes={potholes} onLogout={handleLogout} onPhotoUpload={handleProfilePhotoUpload} onNavigateAdmin={() => navigate('/admin')} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </main>

            {/* ── Mobile Bottom Nav ── */}
            <nav className={`md:hidden mobile-nav transition-transform duration-300 ${
              isSidebarOpen ? 'translate-y-full' : 'translate-y-0'
            }`}>
              <MobileNavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<HomeIcon className="w-5 h-5" />} label="Home" data-tour="mobile-home" />
              <MobileNavBtn active={activeTab === 'map'}  onClick={() => setActiveTab('map')}  icon={<MapIcon  className="w-5 h-5" />} label="Map"   data-tour="mobile-map" />

              {/* Scan FAB */}
              <div className="flex flex-col items-center gap-1" data-tour="mobile-scan">
                <button
                  onClick={() => setActiveTab('scan')}
                  className="scan-fab"
                  style={{ boxShadow: activeTab === 'scan'
                    ? '0 4px 24px rgba(59,130,246,0.7), 0 0 50px rgba(6,182,212,0.3)'
                    : '0 4px 20px rgba(59,130,246,0.5), 0 0 40px rgba(6,182,212,0.2)'
                  }}
                >
                  <Scan className="w-6 h-6 text-white" />
                </button>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: activeTab === 'scan' ? '#60a5fa' : 'var(--text-muted)' }}>Scan</span>
              </div>

              <MobileNavBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History className="w-5 h-5" />} label="History" data-tour="mobile-history" />
              <MobileNavBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon className="w-5 h-5" />} label="Profile" data-tour="mobile-profile" />
            </nav>
          </div>
        )
      } />
    </Routes>
  );
}

/* ─── Sidebar Button ─────────────────────────────────── */
function SidebarBtn({ active, onClick, icon, label, 'data-tour': dataTour }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; 'data-tour'?: string }) {
  return (
    <button onClick={onClick} data-tour={dataTour} className={`sidebar-nav-item w-full ${active ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="sidebar-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
    </button>
  );
}

/* ─── Mobile Nav Button ──────────────────────────────── */
function MobileNavBtn({ active, onClick, icon, label, 'data-tour': dataTour }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; 'data-tour'?: string }) {
  return (
    <button onClick={onClick} data-tour={dataTour} className={`mobile-nav-btn ${active ? 'active' : ''}`}>
      <div className="nav-icon" style={active ? { background: 'rgba(59,130,246,0.15)' } : {}}>
        {icon}
        {active && (
          <span
            style={{
              position: 'absolute',
              top: 3, left: '50%',
              transform: 'translateX(-50%)',
              width: 20, height: 3,
              borderRadius: 2,
              background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            }}
          />
        )}
      </div>
      <span>{label}</span>
    </button>
  );
}

/* ─── Profile View ───────────────────────────────────── */
function ProfileView({ user, potholes, onLogout, onPhotoUpload, onNavigateAdmin }: any) {
  const myReports = potholes.filter((p: any) => p.userId === user.userId);
  const resolvedCount = myReports.filter((p: any) => p.status === 'resolved').length;
  const points = myReports.length * 50;

  return (
    <div className="min-h-full p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Profile Hero */}
      <div className="glass rounded-3xl overflow-hidden">
        {/* Banner */}
        <div className="h-28 relative" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0891b2 50%, #065f46 100%)' }}>
          <div className="absolute inset-0" style={{ background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        </div>
        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl border-4 overflow-hidden" style={{ borderColor: 'var(--bg-primary)' }}>
                <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.email}&background=3b82f6&color=fff`} className="w-full h-full object-cover" alt="Profile" />
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                <CameraIcon className="w-5 h-5 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={onPhotoUpload} />
              </label>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg gradient-blue flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Star className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Elite Reporter</span>
            </div>
          </div>
          <h2 className="text-xl font-black">{user.name || 'Road Guardian'}</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Reports', value: myReports.length, color: 'text-blue-400', bg: 'rgba(59,130,246,0.1)' },
          { label: 'Resolved', value: resolvedCount, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Points', value: points, color: 'text-yellow-400', bg: 'rgba(234,179,8,0.1)' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="glass rounded-2xl p-4 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Account Settings */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Account</p>
        </div>
        {[
          { icon: <Bell className="w-4 h-4" />, label: 'Notifications', color: 'text-blue-400' },
          { icon: <Shield className="w-4 h-4" />, label: 'Privacy & Security', color: 'text-purple-400' },
          { icon: <Award className="w-4 h-4" />, label: 'My Achievements', color: 'text-yellow-400' },
        ].map(({ icon, label, color }) => (
          <button key={label} className="w-full flex items-center justify-between px-5 py-4 transition-all hover:bg-white/5">
            <div className="flex items-center gap-3">
              <div className={`${color}`}>{icon}</div>
              <span className="text-sm font-medium">{label}</span>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        ))}
        {user.role === 'admin' && (
          <button onClick={onNavigateAdmin} className="w-full flex items-center justify-between px-5 py-4 transition-all hover:bg-emerald-500/10">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Admin Console</span>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {/* Sign out */}
      <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-red-400 transition-all hover:bg-red-500/10" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}


