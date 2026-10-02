import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Zap, Award, Volume2, VolumeX, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Task } from '../types';
import { tg } from '../services/telegram';

interface AdModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onAdFinished: (task: Task) => void;
}

export const AdModal: React.FC<AdModalProps> = ({ task, isOpen, onClose, onAdFinished }) => {
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [totalTime, setTotalTime] = useState<number>(10);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      // Snappy 10-second sponsor ad duration
      const duration = Math.min(10, Math.max(5, task.wait_time_sec || 10));
      setTotalTime(duration);
      setTimeLeft(duration);
      setIsFinished(false);
      setIsPlaying(true);
      setIsMuted(true);

      // Attempt background Monetag call if available
      if (typeof window.show_11941636 === 'function') {
        try {
          window.show_11941636()
            .then(() => {
              setIsFinished(true);
              setTimeLeft(0);
            })
            .catch(() => {
              // Silently handle Monetag fallback to in-app player
            });
        } catch (e) {
          // Ignore
        }
      }

      // Start video playback safely
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
  }, [isOpen, task]);

  // Audio mute/unmute sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (!isOpen || !isPlaying || isFinished) return;

    if (timeLeft <= 0) {
      setIsFinished(true);
      setIsPlaying(false);
      tg.haptic.notification('success');
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF5E00', '#FFAE00', '#00FF66', '#FFFFFF']
      });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, timeLeft, isFinished]);

  if (!isOpen || !task) return null;

  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100));

  const toggleSound = () => {
    tg.haptic.impact('light');
    setIsMuted(prev => !prev);
  };

  const handleClaim = () => {
    tg.haptic.impact('heavy');
    onAdFinished(task);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-[#12131D] border border-orange-500/40 shadow-orange-glow-lg flex flex-col"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                <Sparkles size={10} className="animate-spin" /> SPONSORED
              </span>
              <span className="text-xs font-bold text-white">E-FORCE Network</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Mute / Unmute Button */}
              <button
                onClick={toggleSound}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 transition-colors"
                title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-brand-orange" />}
              </button>

              {isFinished ? (
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
                >
                  <X size={16} />
                </button>
              ) : (
                <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                  {timeLeft}s
                </span>
              )}
            </div>
          </div>

          {/* Ad Video Player Canvas */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              src="/Katana_er_moddhe_sining_effet_20261001211343.mp4"
              poster="/katana_poster.png"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />

            {/* Countdown Floating Pill */}
            {!isFinished && (
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-xs font-mono font-bold text-white flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span>Ad Playing: {timeLeft}s</span>
              </div>
            )}

            {/* Overlay when complete */}
            {isFinished && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                <CheckCircle2 size={48} className="text-green-400 mb-2 animate-bounce" />
                <span className="text-base font-black text-white">Ad Verification Complete!</span>
                <span className="text-xs text-orange-300 mt-1 font-semibold">
                  Ready to claim +{task.reward_coins} Coins & +{task.speed_boost}/hr Speed!
                </span>
              </div>
            )}
          </div>

          {/* Progress Line */}
          <div className="w-full h-1.5 bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-orange via-amber-400 to-green-400"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Task Info & Claim Button */}
          <div className="p-4 flex flex-col gap-3">
            <div>
              <h4 className="text-sm font-bold text-white">{task.title}</h4>
              <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <span className="text-xs text-gray-300 font-medium">Yield Boost:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">+{task.reward_coins} Coins</span>
                <span className="text-xs font-black text-brand-orange flex items-center gap-0.5">
                  <Zap size={12} /> +{task.speed_boost}/hr
                </span>
              </div>
            </div>

            {isFinished ? (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleClaim}
                className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm text-black bg-gradient-to-r from-green-400 via-yellow-300 to-brand-orange shadow-orange-glow flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Award size={18} />
                <span>CLAIM REWARD & SPEED BOOST</span>
              </motion.button>
            ) : (
              <button
                disabled
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-gray-400 bg-white/5 border border-white/10 flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <span>Reward unlocks in {timeLeft} seconds...</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
