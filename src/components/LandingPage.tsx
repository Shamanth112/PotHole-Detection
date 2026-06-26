import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import {
  Shield, Zap, Brain, Camera, FileText, History,
  CheckCircle2, ArrowRight, ChevronLeft, ChevronRight,
  MapPin, AlertTriangle, Star, Wrench
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

/* ── Reusable scroll-reveal wrapper ────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
  className?: string;
}) {
  const variants = {
    up:    { hidden: { opacity: 0, y: 40 },   visible: { opacity: 1, y: 0 } },
    down:  { hidden: { opacity: 0, y: -40 },  visible: { opacity: 1, y: 0 } },
    left:  { hidden: { opacity: 0, x: -50 },  visible: { opacity: 1, x: 0 } },
    right: { hidden: { opacity: 0, x: 50 },   visible: { opacity: 1, x: 0 } },
    scale: { hidden: { opacity: 0, scale: 0.85 }, visible: { opacity: 1, scale: 1 } },
  };
  const v = variants[direction];
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      variants={v}
    >
      {children}
    </motion.div>
  );
}

/* ── Tour steps ──────────────────────────────────────────────────────────── */
const STEPS = [
  {
    id: 'scan',
    step: '01',
    icon: <Camera className="w-6 h-6" />,
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.35)',
    badge: 'AI-Powered',
    title: 'Snap or Scan — AI Does the Rest',
    description:
      'Open the AI Scanner and point your camera at any road damage. Gemini Vision instantly detects potholes, draws detection boxes, estimates depth, and rates severity — all in seconds, no manual input needed.',
    bullets: [
      'Real-time AI pothole detection',
      'Automatic depth & severity estimation',
      'GPS-tagged location attached instantly',
    ],
    image: '/tour_ai_scan.png',
    alt: 'RoadGuard AI Scanner detecting a pothole with bounding box overlay',
  },
  {
    id: 'report',
    step: '02',
    icon: <FileText className="w-6 h-6" />,
    color: '#f97316',
    glow: 'rgba(249,115,22,0.35)',
    badge: 'Quick Report',
    title: 'Or Report It Manually in 30 Seconds',
    description:
      "Prefer manual? Upload a photo, pick severity, and hit submit. The AI still verifies your photo automatically — if it's a valid pothole, the report goes live immediately and your municipality is notified.",
    bullets: [
      'Photo upload + auto AI verification',
      'Choose Low / Medium / High severity',
      'Report sent to municipal team instantly',
    ],
    image: '/tour_report_form.png',
    alt: 'RoadGuard manual pothole report form with photo upload and GPS location',
  },
  {
    id: 'municipal',
    step: '03',
    icon: <Wrench className="w-6 h-6" />,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.35)',
    badge: 'Municipal Action',
    title: 'Municipality Receives & Fixes It',
    description:
      'Your report appears instantly on the Municipal Dashboard. The team reviews it, assigns a crew, marks it "In Progress", fixes the road, and uploads a resolved photo as proof — all tracked in real-time.',
    bullets: [
      'Instant notification to municipal team',
      'Status updates: Reported → In Progress → Fixed',
      'Resolved photo uploaded as proof of repair',
    ],
    image: '/tour_municipal.png',
    alt: 'RoadGuard municipal dashboard showing pothole report with repair action buttons',
  },
  {
    id: 'history',
    step: '04',
    icon: <History className="w-6 h-6" />,
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.35)',
    badge: 'Track Progress',
    title: 'Watch Your Report Get Resolved',
    description:
      "Visit your Report History anytime to see every pothole you've reported, its live status, and the before/after photos once repaired. Your civic contribution is tracked, points awarded, and roads made safer.",
    bullets: [
      'Full history of all your reports',
      'Live status: Reported / In Progress / Resolved',
      'Before & after repair photos visible to you',
    ],
    image: '/tour_history.png',
    alt: 'RoadGuard report history showing status timeline and resolved pothole before-after photos',
  },
];

/* ── Google SVG ─────────────────────────────────────────────────────────── */
function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── Floating particles ─────────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 2 + Math.random() * 3,
  delay: Math.random() * 6,
  dur: 8 + Math.random() * 10,
  color: ['rgba(59,130,246,0.35)', 'rgba(6,182,212,0.3)', 'rgba(167,139,250,0.3)', 'rgba(16,185,129,0.25)'][Math.floor(Math.random() * 4)],
}));

/* ──────────────────────────────────────────────────────────────────────────── */
export default function LandingPage({ onLogin }: LandingPageProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  /* Parallax on hero scroll — gentle drift */
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -50], { clamp: true });
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.55], { clamp: true });

  /* Auto-advance carousel */
  useEffect(() => {
    if (!autoPlay) return;
    intervalRef.current = setInterval(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoPlay, activeStep]);

  const goTo = (idx: number) => {
    setActiveStep(idx);
    setAutoPlay(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeout(() => setAutoPlay(true), 12000);
  };

  const step = STEPS[activeStep] ?? STEPS[0]!;

  return (
    <div
      className="min-h-screen login-bg relative overflow-x-hidden text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Fixed ambient glows ── */}
      <div className="fixed top-0 left-0 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)', transform: 'translate(-35%, -35%)' }} />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)', transform: 'translate(35%, 35%)' }} />

      {/* ── Floating particles ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: p.color }}
            animate={{ y: [0, -30, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* ── Sticky header ── */}
      <motion.header
        className="sticky top-0 z-50 glass-strong border-b"
        style={{ borderColor: 'var(--border)' }}
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="RoadGuard Logo" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-black text-xl tracking-tight">
              Road<span className="gradient-text-blue">Guard</span>
            </span>
          </div>
          <button
            id="login-btn-header"
            onClick={onLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}
          >
            <GoogleIcon className="w-4 h-4" />
            Continue with Google
          </button>
        </div>
      </motion.header>

      <main style={{ position: 'relative', zIndex: 1 }}>

        {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
        <motion.section
          ref={heroRef}
          aria-labelledby="hero-heading"
          className="max-w-6xl mx-auto px-5 pt-16 pb-12 md:pt-24 md:pb-20 text-center"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
          >
            <Zap className="w-3 h-3" />
            AI-Powered Pothole Detection & Road Safety Platform
          </motion.div>

          <motion.h1
            id="hero-heading"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-5"
          >
            Report Potholes.<br />
            <span className="gradient-text-blue">AI Verifies.</span><br />
            Roads Get Fixed.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10"
            style={{ color: 'var(--text-secondary)' }}
          >
            RoadGuard is the smart city pothole detection app that connects citizens directly
            to their municipality. Snap a photo, let Gemini AI verify it, and watch your
            road get repaired — with real-time progress updates.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.button
              id="login-btn-hero"
              onClick={onLogin}
              whileHover={{ scale: 1.04, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}
              whileTap={{ scale: 0.97 }}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-base"
              style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
            >
              <GoogleIcon />
              Continue with Google
            </motion.button>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-sm font-semibold transition-all hover:text-white"
              style={{ color: 'var(--text-secondary)' }}
            >
              See how it works <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </motion.section>

        {/* ══ HOW IT WORKS — TOUR ══════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="max-w-6xl mx-auto px-5 py-16 md:py-24"
        >
          <Reveal direction="up" className="text-center mb-12">
            <p className="text-xs font-black uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>How It Works</p>
            <h2 id="how-heading" className="text-3xl md:text-5xl font-black tracking-tight">
              4 Steps to Safer Roads
            </h2>
            <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              From spotting a pothole to seeing it repaired — here's how RoadGuard works for you as a citizen.
            </p>
          </Reveal>

          {/* Step pills */}
          <Reveal direction="up" delay={0.1}>
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 justify-center flex-wrap">
              {STEPS.map((s, i) => (
                <motion.button
                  key={s.id}
                  id={`tour-step-${s.id}`}
                  onClick={() => goTo(i)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-colors shrink-0"
                  style={{
                    background: activeStep === i ? `rgba(${hexToRgb(s.color)}, 0.15)` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${activeStep === i ? s.color + '66' : 'var(--border)'}`,
                    color: activeStep === i ? s.color : 'var(--text-secondary)',
                  }}
                >
                  <span className="text-xs font-black">{s.step}</span>
                  {s.icon}
                  <span className="hidden sm:inline">{s.badge}</span>
                </motion.button>
              ))}
            </div>
          </Reveal>

          {/* Main tour card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="glass rounded-3xl overflow-hidden"
              style={{ border: `1px solid ${step.color}22` }}
            >
              <div className="grid md:grid-cols-2 gap-0">
                {/* Text side */}
                <div className="p-8 md:p-10 flex flex-col justify-center gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <motion.div
                        key={step.id + '-icon'}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.35 }}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: `rgba(${hexToRgb(step.color)}, 0.15)`, border: `1px solid ${step.color}44`, color: step.color }}
                      >
                        {step.icon}
                      </motion.div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: step.color }}>
                          Step {step.step}
                        </p>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                          style={{ background: `rgba(${hexToRgb(step.color)}, 0.1)`, color: step.color }}>
                          {step.badge}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black tracking-tight leading-snug mb-3">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {step.description}
                    </p>
                  </div>

                  <ul className="space-y-2.5">
                    {step.bullets.map((b, bi) => (
                      <motion.li
                        key={b}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: bi * 0.08 + 0.1, duration: 0.35 }}
                        className="flex items-start gap-3 text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: step.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{b}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* Progress dots + nav */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex gap-2">
                      {STEPS.map((_, i) => (
                        <motion.button
                          key={i}
                          onClick={() => goTo(i)}
                          animate={{ width: activeStep === i ? 24 : 8 }}
                          transition={{ duration: 0.3 }}
                          className="rounded-full h-2"
                          style={{ background: activeStep === i ? step.color : 'var(--border)' }}
                        />
                      ))}
                    </div>
                    <div className="ml-auto flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => goTo((activeStep - 1 + STEPS.length) % STEPS.length)}
                        className="w-9 h-9 rounded-xl glass flex items-center justify-center"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Previous step"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => goTo((activeStep + 1) % STEPS.length)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: step.color, boxShadow: `0 4px 16px ${step.glow}` }}
                        aria-label="Next step"
                      >
                        <ChevronRight className="w-4 h-4 text-white" />
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Screenshot side */}
                <div
                  className="relative flex items-center justify-center p-6 md:p-8 min-h-[280px] md:min-h-[400px]"
                  style={{ background: `linear-gradient(135deg, rgba(${hexToRgb(step.color)},0.05) 0%, transparent 60%)` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.div
                      key={step.id + '-glow'}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.6 }}
                      className="w-72 h-72 rounded-full"
                      style={{ background: `radial-gradient(circle, ${step.glow} 0%, transparent 70%)` }}
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step.id + '-img'}
                      initial={{ opacity: 0, scale: 0.88, rotate: -3, y: 20 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88, rotate: 3, y: -20 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="relative z-10 rounded-2xl overflow-hidden shadow-2xl w-full max-w-[320px]"
                      style={{ border: `1px solid ${step.color}33`, boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 40px ${step.glow}` }}
                      whileHover={{ scale: 1.03, rotate: 1 }}
                    >
                      <img
                        src={step.image}
                        alt={step.alt}
                        className="w-full h-auto object-cover"
                        loading="lazy"
                      />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-md"
                          style={{ background: 'rgba(0,0,0,0.7)', border: `1px solid ${step.color}44` }}>
                          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: step.color }} />
                          <span className="text-xs font-bold" style={{ color: step.color }}>{step.badge}</span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* ══ FLOW DIAGRAM ═════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="flow-heading"
          className="border-y py-16 md:py-20"
          style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="max-w-5xl mx-auto px-5">
            <Reveal direction="up" className="text-center mb-12">
              <h2 id="flow-heading" className="text-2xl md:text-4xl font-black tracking-tight">
                The Complete Journey
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                From citizen report to municipal fix — fully automated and tracked
              </p>
            </Reveal>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
              {/* Connector line — desktop only */}
              <Reveal direction="scale" delay={0.3} className="absolute top-10 left-[12.5%] right-[12.5%] h-px hidden md:block"
              >
                <div className="w-full h-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #f97316, #10b981, #a78bfa)' }} />
              </Reveal>

              {[
                { num: '1', label: 'Citizen spots pothole', sub: 'Takes photo or scans with AI', color: '#3b82f6' },
                { num: '2', label: 'AI verifies report', sub: 'Gemini Vision confirms damage', color: '#f97316' },
                { num: '3', label: 'Municipal team fixes it', sub: 'Crew dispatched, road repaired', color: '#10b981' },
                { num: '4', label: 'Citizen sees proof', sub: 'Before/after photos in history', color: '#a78bfa' },
              ].map(({ num, label, sub, color }, i) => (
                <Reveal key={num} direction="up" delay={i * 0.12}>
                  <div className="flex flex-col items-center text-center gap-3">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 3 }}
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black z-10 cursor-default"
                      style={{ background: `rgba(${hexToRgb(color)}, 0.15)`, border: `2px solid ${color}55` }}
                    >
                      <span style={{ color }}>{num}</span>
                    </motion.div>
                    <div>
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FEATURES GRID ════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="features-heading"
          className="max-w-6xl mx-auto px-5 py-16 md:py-24"
        >
          <Reveal direction="up" className="text-center mb-12">
            <h2 id="features-heading" className="text-2xl md:text-4xl font-black tracking-tight">
              Everything a Citizen Needs
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Powerful tools designed to make road safety effortless
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Brain className="w-6 h-6" />, color: '#3b82f6', title: 'Gemini AI Verification', desc: 'Every photo is auto-verified by Google Gemini Vision. No false reports, no manual moderation needed.' },
              { icon: <MapPin className="w-6 h-6" />, color: '#06b6d4', title: 'GPS-Tagged Reports', desc: 'Location is auto-detected and attached to every report so municipalities know exactly where to go.' },
              { icon: <AlertTriangle className="w-6 h-6" />, color: '#f97316', title: 'Severity Classification', desc: 'AI estimates pothole depth and classifies severity as Low, Medium, or High for prioritization.' },
              { icon: <History className="w-6 h-6" />, color: '#a78bfa', title: 'Live Progress Tracking', desc: 'Watch your report move from Reported → In Progress → Resolved with real-time status updates.' },
              { icon: <CheckCircle2 className="w-6 h-6" />, color: '#10b981', title: 'Before & After Proof', desc: 'Municipality uploads a repair photo once fixed. You can see both the original damage and the repair.' },
              { icon: <Star className="w-6 h-6" />, color: '#eab308', title: 'Civic Points & Badges', desc: 'Earn points for every verified report. Build your reputation as an Elite Road Guardian in your city.' },
            ].map(({ icon, color, title, desc }, i) => (
              <Reveal key={title} direction="up" delay={(i % 3) * 0.1}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="glass rounded-2xl p-6 flex flex-col gap-4 h-full cursor-default"
                  style={{ border: `1px solid ${color}1a` }}
                >
                  <motion.div
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `rgba(${hexToRgb(color)}, 0.12)`, color }}
                  >
                    {icon}
                  </motion.div>
                  <div>
                    <h3 className="font-black text-base mb-1">{title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══ FINAL CTA ════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="cta-heading"
          className="max-w-3xl mx-auto px-5 py-16 md:py-24 text-center"
        >
          <Reveal direction="scale">
            <div
              className="glass rounded-3xl p-10 md:p-14 relative overflow-hidden"
              style={{ border: '1px solid rgba(59,130,246,0.2)' }}
            >
              {/* Animated glow */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-80 h-80 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)' }} />
              </motion.div>

              <div className="relative z-10">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-flex items-center justify-center mb-6 relative mx-auto"
                >
                  <img src="/logo.png" alt="RoadGuard Logo" className="w-24 h-24 rounded-3xl object-cover glow-blue" />
                </motion.div>

                <h2 id="cta-heading" className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                  Ready to Make Your Roads Safer?
                </h2>
                <p className="text-sm leading-relaxed mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Join citizens using RoadGuard to report potholes, track repairs,
                  and build safer cities with AI.
                </p>

                <div
                  className="max-w-sm mx-auto rounded-3xl p-6 space-y-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
                >
                  <h3 className="font-bold text-base">Sign in to get started</h3>
                  <motion.button
                    id="login-btn-cta"
                    onClick={onLogin}
                    whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm"
                    style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </motion.button>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Free for citizens · By continuing you agree to our Terms & Privacy Policy
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ── */}
      <Reveal direction="up">
        <footer className="border-t py-8" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="max-w-6xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="RoadGuard Logo" className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-black text-sm">Road<span className="gradient-text-blue">Guard</span></span>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              © 2025 RoadGuard · AI Pothole Detection & Road Safety Platform · Smart City Infrastructure Monitoring
            </p>
            <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </footer>
      </Reveal>

      {/* SEO: Visually hidden but crawlable */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        <h2>Pothole Detection App — AI Road Damage Reporting</h2>
        <p>
          RoadGuard is the best pothole detection app for AI-powered pothole detection and road damage reporting.
          Citizens can report potholes, track repairs, and see before-after photos of resolved road damage.
          Our AI pothole detector uses Google Gemini Vision to verify every report automatically.
        </p>
      </div>
    </div>
  );
}

/* ── Utility: hex color → "r,g,b" for rgba() ── */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
