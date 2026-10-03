import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Zap, Clock, Sparkles, TrendingUp, Award, PlayCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { MiningState, User } from '../types';
import type { AppSettings } from '../services/firestore';
import { tg } from '../services/telegram';

interface MiningTabProps {
  user: User | null;
  mining: MiningState | null;
  appSettings?: AppSettings | null;
  onStartMining: () => Promise<void>;
  onClaimMining: () => Promise<void>;
  onNavigateToTasks: () => void;
  onNavigateToFriends: () => void;
}

export const MiningTab: React.FC<MiningTabProps> = ({
  user,
  mining,
  appSettings,
  onStartMining,
  onClaimMining,
  onNavigateToTasks,
  onNavigateToFriends,
}) => {
  const baseRate = appSettings?.base_mining_rate ?? 0.5;
  const refBoostRate = appSettings?.referral_speed_boost ?? 0.05;
  const sessionHours = appSettings?.session_duration_hours ?? 24;

  const currentSpeed = mining?.speed_per_hr ?? user?.speed_per_hr ?? baseRate;
  const referralCount = user?.referral_count || 0;
  const totalRefBoost = referralCount * refBoostRate;
  const totalTasksBoost = Math.max(0, currentSpeed - baseRate - totalRefBoost);

  const [loading, setLoading] = useState(false);
  const [liveUnclaimed, setLiveUnclaimed] = useState<number>(mining?.mined_unclaimed || 0);
  const [countdown, setCountdown] = useState<number>(mining?.remaining_seconds || sessionHours * 3600);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isMining = Boolean(mining?.is_mining);

  // Dynamic video speed and glow effect based on mining status
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMining) {
      video.playbackRate = 1.2;
      video.play().catch(() => {});
    } else {
      video.playbackRate = 0.85;
      video.play().catch(() => {});
    }
  }, [isMining]);

  // Sync state whenever mining changes
  useEffect(() => {
    if (mining) {
      setLiveUnclaimed(mining.mined_unclaimed);
      setCountdown(mining.remaining_seconds);
    }
  }, [mining]);

  // Real-time local ticking: increments unclaimed yield and decrements countdown timer every second
  useEffect(() => {
    if (!mining || !mining.is_mining) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });

      // Increment unclaimed tokens based on speed_per_hr (speed / 3600 per second)
      setLiveUnclaimed((prev) => {
        const incrementPerSec = (mining.speed_per_hr || 0.5) / 3600;
        return prev + incrementPerSec;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mining]);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleAction = async () => {
    tg.haptic.impact('heavy');
    setLoading(true);

    try {
      if (mining?.status === 'claimable' || (mining?.is_mining && liveUnclaimed > 0.001)) {
        await onClaimMining();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF5E00', '#FFAE00', '#FFFFFF']
        });
        tg.haptic.notification('success');
      } else {
        await onStartMining();
        tg.haptic.notification('success');
      }
    } catch (e: any) {
      tg.haptic.notification('error');
    } finally {
      setLoading(false);
    }
  };

  const isClaimable = mining?.status === 'claimable' || (isMining && liveUnclaimed >= 0.01);
  const totalBalance = (user?.balance || 0) + (isMining ? liveUnclaimed : 0);
  const progressPercent = mining ? Math.min(100, Math.max(0, ((86400 - countdown) / 86400) * 100)) : 0;

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-24 flex flex-col items-center">
      {/* Limited Program Notice Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mb-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/25"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-brand-orange animate-pulse" />
          <span className="text-[11px] font-semibold text-orange-200">Genesis Phase: 24-Hour Mining Engine</span>
        </div>
        <span className="text-[10px] font-bold text-brand-orange bg-white/10 px-2 py-0.5 rounded-full">
          LIMITED
        </span>
      </motion.div>

      {/* Main Balance Display */}
      <div className="text-center my-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center justify-center gap-1">
          <img src="/canva.png" alt="E-FORCE" className="w-4 h-4 rounded-full object-contain" />
          <span>Total Balance</span>
        </div>
        <motion.div
          key={Math.floor(totalBalance)}
          className="text-4xl sm:text-5xl font-black tracking-tight fire-text-gradient font-mono"
        >
          {totalBalance.toFixed(4)}
        </motion.div>
        <span className="text-xs font-bold text-orange-400/90 tracking-widest uppercase">E-FORCE</span>
      </div>

      {/* 3D Circular Energy Reactor with Katana Video Asset */}
      <div className="relative my-4 flex items-center justify-center">
        {/* Ambient Orange & White Cyber Glow Aura */}
        <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-brand-orange/35 via-amber-400/25 to-white/20 blur-2xl pointer-events-none animate-pulse" />

        {/* Outer Cyber Energy Ring Accent */}
        <div className="absolute w-[246px] h-[246px] rounded-full border border-orange-500/30 shadow-[0_0_20px_rgba(255,106,0,0.3)] pointer-events-none" />

        {/* Circular Progress SVG */}
        <svg className="w-64 h-64 -rotate-90 transform relative z-10 pointer-events-none" viewBox="0 0 256 256">
          <circle
            cx="128"
            cy="128"
            r="116"
            stroke="rgba(255, 174, 0, 0.25)"
            strokeWidth="6"
            fill="transparent"
          />
          <motion.circle
            cx="128"
            cy="128"
            r="116"
            stroke="url(#orangeGradient)"
            strokeWidth="6"
            strokeDasharray={2 * Math.PI * 116}
            strokeDashoffset={2 * Math.PI * 116 * (1 - progressPercent / 100)}
            strokeLinecap="round"
            fill="transparent"
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#FFAE00" />
              <stop offset="70%" stopColor="#FF5E00" />
              <stop offset="100%" stopColor="#FF2A00" />
            </linearGradient>
          </defs>
        </svg>

        {/* Central Video Reactor: Katana character with shining katana effect */}
        <motion.div
          animate={isMining ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-[228px] h-[228px] rounded-full overflow-hidden border-2 border-white/80 shadow-[0_0_30px_rgba(255,120,0,0.65),inset_0_0_20px_rgba(255,174,0,0.35)] flex items-center justify-center bg-white cursor-pointer"
          onClick={handleAction}
        >
          <video
            ref={videoRef}
            src="/Katana_er_moddhe_sining_effet_20261001211343.mp4"
            poster="/katana_poster.png"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={`w-full h-full object-cover transition-all duration-500 ${
              isMining ? 'brightness-110 saturate-125' : 'brightness-100'
            }`}
          />
        </motion.div>
      </div>

      {/* Real-time Session Metrics Card */}
      <div className="w-full grid grid-cols-2 gap-3 my-3">
        {/* Countdown Timer */}
        <div className="glass-panel p-3 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium mb-1">
            <Clock size={13} className="text-orange-400" />
            <span>Cycle Remaining</span>
          </div>
          <div className="font-mono text-lg font-bold text-white tracking-wider">
            {formatTime(countdown)}
          </div>
          <span className="text-[10px] text-gray-500">{sessionHours}H Protocol</span>
        </div>

        {/* Live Accumulation Yield */}
        <div className="glass-panel-orange p-3 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-orange-300 text-xs font-medium mb-1">
            <Zap size={13} className="text-brand-orange fill-brand-orange" />
            <span>Unclaimed Yield</span>
          </div>
          <div className="font-mono text-lg font-bold text-brand-orange tracking-tight">
            +{liveUnclaimed.toFixed(4)}
          </div>
          <span className="text-[10px] text-orange-200/60">Ready in pool</span>
        </div>
      </div>

      {/* Main Action Button (Start / Claim) */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAction}
        disabled={loading}
        className={`w-full py-4 px-6 rounded-2xl font-extrabold text-base tracking-wide flex items-center justify-center gap-2 shadow-orange-glow transition-all duration-300 ${
          isClaimable
            ? 'bg-gradient-to-r from-brand-orange via-orange-500 to-amber-500 text-white hover:brightness-110'
            : isMining
            ? 'bg-gradient-to-r from-orange-600 to-brand-orange text-white'
            : 'bg-gradient-to-r from-white via-orange-100 to-orange-400 text-black font-black hover:bg-orange-50'
        }`}
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isClaimable ? (
          <>
            <Award size={20} className="text-yellow-200 animate-bounce" />
            <span>CLAIM {liveUnclaimed.toFixed(4)} E-FORCE</span>
          </>
        ) : isMining ? (
          <>
            <Zap size={18} className="text-yellow-300 fill-yellow-300 animate-pulse" />
            <span>MINING IN PROGRESS ({formatTime(countdown)})</span>
          </>
        ) : (
          <>
            <Zap size={20} className="fill-black" />
            <span>START {sessionHours}H MINING CORE</span>
          </>
        )}
      </motion.button>

      {/* Mining Power Breakdown & Boost Boosters */}
      <div className="w-full mt-5 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-orange" />
            <h3 className="text-sm font-bold text-white">Engine Power Breakdown</h3>
          </div>
          <span className="text-xs font-mono font-bold text-orange-400">
            {currentSpeed.toFixed(2)} /hr
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-gray-400">
            <span>Base {sessionHours}H Rate:</span>
            <span className="text-white font-medium">{baseRate.toFixed(2)} E-FORCE/hr</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Tasks Completed Boost:</span>
            <span className="text-orange-400 font-medium">
              +{totalTasksBoost.toFixed(2)}/hr
            </span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Referrals Boost ({referralCount} friends):</span>
            <span className="text-green-400 font-medium">
              +{totalRefBoost.toFixed(2)}/hr
            </span>
          </div>
        </div>

        {/* Quick Speed Boost CTA Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5">
          <button
            onClick={onNavigateToTasks}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500/25 to-amber-500/20 border border-orange-500/40 text-xs font-black text-white hover:bg-orange-500/30 transition-all text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <PlayCircle size={13} className="text-brand-orange animate-pulse" />
            <span>Watch Ads & Boost</span>
          </button>
          <button
            onClick={onNavigateToFriends}
            className="py-2.5 px-3 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white hover:bg-white/15 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Invite Friends (+{refBoostRate.toFixed(2)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
