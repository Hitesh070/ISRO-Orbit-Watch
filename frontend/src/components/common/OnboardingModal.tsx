/**
 * OrbitGuard First-Visit Onboarding Tour (Phase 6)
 * ===============================================
 * Multi-slide interactive walkthrough introducing:
 * 1. Space Situational Awareness (SSA) mission overview
 * 2. High-performance 25,000+ GPU Point Cloud in TEME frame
 * 3. Conjunction Assessment Engine & Foster Pc screening
 * 4. EEE/RF Ground Station Suite & Antenna Tracking Controller
 * 5. Controls, Keyboard Shortcuts & Scientific Disclaimers
 */

import React, { useState } from 'react';
import {
  X,
  Globe,
  Radio,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    icon: Sparkles,
    badge: 'Welcome to OrbitGuard v4.2',
    title: 'Real-Time Space Situational Awareness & Ground Station',
    description:
      'OrbitGuard is a high-fidelity astrodynamics and RF engineering platform built for real-time satellite tracking, debris conjunction screening, and automated antenna tracking. Designed specifically for ISRO and aerospace engineering defense.',
    points: [
      'Propagates 3,700+ active satellites and debris pieces directly in the browser.',
      'Industry-standard Foster-1992 collision probability (Pc) and Akella Pc,max bounds.',
      'Complete RF Ground Station: Doppler shift with Earth rotation, link budget, and antenna slewing.',
    ],
  },
  {
    icon: Globe,
    badge: '3D Celestial Globe & Point Cloud',
    title: '25,000+ GPU Point Cloud at 60 FPS',
    description:
      'To prevent main-thread UI stutter, SGP4 propagation is offloaded to a dedicated Web Worker (propagator.worker.ts) using transferable Float32Array ping-pong buffers. A custom GLSL shader executes linear velocity extrapolation at 60 FPS.',
    points: [
      'True Equator, Mean Equinox (TEME) celestial inertial reference frame.',
      'Earth mesh rotates under satellites by Greenwich Mean Sidereal Time (GMST).',
      'Screen-space GPU picking allows clicking any satellite dot to inspect its real-time dossier.',
    ],
  },
  {
    icon: ShieldAlert,
    badge: 'Conjunction Assessment Engine',
    title: 'Screening-Grade Collision Risk & Encounter Plane',
    description:
      'Replaces heuristic risk scores with rigorous 2-D encounter-plane mathematics. Evaluates Mahalanobis distance and integrates the Gaussian probability density over the hard-body circle using 64-point Gauss-Legendre quadrature.',
    points: [
      'Foster-1992 bivariate Gaussian integration over combined Hard Body Radius (HBR).',
      'Akella-Alfriend maximum Pc (Pc,max) evaluates worst-case covariance scale factor k.',
      'Scientific Honesty: Public TLEs lack covariance; all risk values are labeled screening-grade.',
    ],
  },
  {
    icon: Radio,
    badge: 'EEE / RF Ground Station',
    title: 'Diurnal Doppler & Steerable Antenna Tracking',
    description:
      'A complete toolkit for satellite tracking and communications. Computes topocentric range rate including the observer station’s rotational velocity (v_obs = 465 m/s at the equator) and drives real or simulated antenna rotators.',
    points: [
      'Relativistic Doppler curve (S-curve) and uplink frequency pre-compensation.',
      'Pass-resolved Link Budget (FSPL, C/N0, Eb/N0, pointing loss, atmospheric loss).',
      'Antenna controller supporting Yaesu GS-232, Easycomm, and ESP32 stepper firmware.',
    ],
  },
  {
    icon: GraduationCap,
    badge: 'Ready for Launch',
    title: 'Essential Hotkeys & Interview Trainer',
    description:
      'You are ready to explore! Use quick keyboard shortcuts to navigate efficiently, or launch the built-in Technical Interview Simulator to practice whiteboard defense for ISRO Scientist / Engineer panels.',
    points: [
      'Press [ ? ] for full documentation & architectural reference.',
      'Press [ ~ ] or [ ` ] to toggle the real-time Performance & Worker Latency HUD.',
      'Press [ 1 ], [ 5 ], [ 6 ] to warp simulation time (1x, 5x, 60x fast-forward).',
      'Press [ I ] or click the graduation cap icon to launch the Interview Simulator.',
    ],
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slide = SLIDES[currentSlide];
  const Icon = slide.icon;

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-space-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-space-950 border border-cyan-500/30 rounded-2xl p-5 md:p-6 shadow-2xl text-slate-100 flex flex-col justify-between"
        role="dialog"
        aria-modal="true"
        aria-label="OrbitGuard Onboarding Tour"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {slide.badge}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {currentSlide + 1} / {SLIDES.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Skip Tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Slide Content */}
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 shadow-glow-cyan">
                <Icon className="w-6 h-6" />
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-100 leading-snug">
                {slide.title}
              </h2>
            </div>

            <p className="text-xs md:text-sm text-slate-300 font-sans leading-relaxed">
              {slide.description}
            </p>

            <div className="bg-space-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              {slide.points.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 font-sans">
                  <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-cyan-400" />
                  </div>
                  <span className="leading-snug">{pt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-6 pt-4 border-t border-cyan-500/20 flex items-center justify-between">
          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === idx ? 'w-6 bg-cyan-400 shadow-glow-cyan' : 'w-2 bg-slate-800'
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentSlide > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-400 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-space-950 font-bold text-xs font-mono shadow-glow-cyan transition"
            >
              {currentSlide === SLIDES.length - 1 ? (
                <>
                  Explore OrbitGuard <Check className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
