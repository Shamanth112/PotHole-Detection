import React from 'react';
import { Play, FileText, Activity, CheckCircle2, ShieldAlert, Wifi, LayoutDashboard, ShieldCheck, ChevronRight, MapPin, TrendingUp, Zap, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface HomeViewProps {
  userRole: 'citizen' | 'admin' | 'municipal' | null;
  onStartDetection: () => void;
  onReportManually: () => void;
  stats: { detectedToday: number; fixedThisWeek: number; };
  totalReports?: number;
  userName?: string;
}

export default function HomeView({ userRole, onStartDetection, onReportManually, stats, totalReports = 0, userName = 'Guardian' }: HomeViewProps) {
  const navigate = useNavigate();

  const statCards = [
    { label: 'Detected Today',  value: stats.detectedToday, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-orange-400', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', glow: '0 0 20px rgba(249,115,22,0.1)' },
    { label: 'Fixed This Week', value: stats.fixedThisWeek, icon: <CheckCircle2  className="w-5 h-5" />, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  glow: '0 0 20px rgba(16,185,129,0.1)' },
    { label: 'Total Reports',   value: totalReports,         icon: <MapPin       className="w-5 h-5" />, color: 'text-blue-400',   bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)',  glow: '0 0 20px rgba(59,130,246,0.1)' },
  ];

  return (
    <div className="min-h-full p-4 md:p-8 space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* ── Greeting ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl md:text-4xl font-black tracking-tight">
          Good {getGreeting()},&nbsp;
          <span className="gradient-text-blue">{userName.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          Your city's road health dashboard — real-time AI monitoring
        </p>
      </motion.div>

      {/* ── Stat Cards ── */}
      {/* Always 3-col: compact on mobile, wider gap on desktop */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-4">
        {statCards.map(({ label, value, icon, color, bg, border, glow }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="stat-card"
            style={{ boxShadow: glow }}
          >
            {/* Background decoration */}
            <div className="absolute -top-4 -right-4 w-16 h-16 md:w-20 md:h-20 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${bg.replace('0.1', '1')}, transparent)` }} />

            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between relative z-10">
              {/* Icon — hidden on very small screens to save space */}
              <div className="hidden sm:flex p-2 rounded-xl shrink-0" style={{ background: bg, border: `1px solid ${border}` }}>
                <div className={color}>{icon}</div>
              </div>
              <div className="flex-1">
                <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest mb-1 md:mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <motion.p
                  className={`text-2xl md:text-4xl font-black ${color}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 + 0.2, type: 'spring', stiffness: 200 }}
                >
                  {value}
                </motion.p>
              </div>
            </div>
            <div className="mt-2 md:mt-4 flex items-center gap-1 text-[9px] md:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Live data</span>
              <span className="sm:hidden">• live</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onStartDetection}
          className="group relative overflow-hidden rounded-2xl p-5 md:p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)', boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}
          aria-label="Start AI detection with your camera"
        >
          <div className="absolute inset-0 group-hover:translate-x-full transition-transform duration-700"
            style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)' }} />
          <div className="relative z-10 flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-white/20 flex items-center justify-center sm:mb-4 shrink-0">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white uppercase tracking-tight">Start AI Detection</h3>
              <p className="text-xs md:text-sm text-blue-100/70 mt-0.5">Real-time pothole scanning via camera</p>
            </div>
          </div>
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-5 h-5 text-white/50" aria-hidden="true" />
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          onClick={onReportManually}
          className="group relative overflow-hidden glass-hover rounded-2xl p-5 md:p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Submit a manual pothole report"
        >
          <div className="relative z-10 flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center sm:mb-4 shrink-0" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <FileText className="w-5 h-5 md:w-6 md:h-6" style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight">Manual Report</h3>
              <p className="text-xs md:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manually submit a pothole with location & photo</p>
            </div>
          </div>
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          </div>
        </motion.button>
      </div>

      {/* ── First-time nudge ── */}
      <AnimatePresence>
        {totalReports === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="glass rounded-2xl p-4 md:p-5 flex items-center gap-4"
            style={{ border: '1px solid rgba(59,130,246,0.2)' }}
            role="status"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.12)' }}>
              <MapPin className="w-6 h-6 text-blue-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Your map is empty 👋</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Spot a pothole on your commute? Use the AI scanner or submit a manual report — your community's road health starts with you.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Admin / Municipal Panel ── */}
      {(userRole === 'municipal' || userRole === 'admin') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-emerald flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-400 text-sm">Management Access</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Authorized {userRole} account</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-emerald-400" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                Active
              </span>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              You have access to the municipal monitoring system. Track reports, update status, and manage road safety across the city.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => navigate('/municipal')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                Open Municipal Dashboard <ChevronRight className="w-4 h-4" />
              </button>
              {userRole === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}
                >
                  Admin Console <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Pro Tip ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-5 flex items-start gap-4"
      >
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-sm text-blue-400 mb-1">Pro Tip</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Mount your device securely on the dashboard for the most accurate AI detection while driving. Enable GPS for precise location tagging.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
