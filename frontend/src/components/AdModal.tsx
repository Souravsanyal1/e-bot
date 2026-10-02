import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Zap, Award } from 'lucide-react';
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
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && task) {
      const waitTime = task.wait_time_sec || 15;
      setTimeLeft(waitTime);
      setIsFinished(false);
      setIsPlaying(true);
    }
  }, [isOpen, task]);

  useEffect(() => {
    if (!isOpen || !isPlaying || isFinished) return;

    if (timeLeft <= 0) {
      setIsFinished(true);
      setIsPlaying(false);
      tg.haptic.notification('success');
      confetti({
        particleCount: 50,
        spread: 60,
        colors: ['#FF5E00', '#FFAE00', '#FFFFFF']
      });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, timeLeft, isFinished]);

  if (!isOpen || !task) return null;

  const totalTime = task.wait_time_sec || 15;
  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100));

  const handleClaim = () => {
    tg.haptic.impact('heavy');
    onAdFinished(task);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-[#12131D] border border-orange-500/30 shadow-orange-glow-lg flex flex-col"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                SPONSORED AD
              </span>
              <span className="text-xs font-bold text-white">E-FORCE Boost</span>
            </div>
            {isFinished ? (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
              >
                <X size={16} />
              </button>
            ) : (
              <span className="text-xs font-mono font-bold text-orange-400">
                {timeLeft}s
              </span>
            )}
          </div>

          {/* Ad Video Player Canvas */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
            <video
              src="/Katana_er_moddhe_sining_effet_20261001211343.mp4"
              poster="/katana_poster.png"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />

            {/* Countdown Floating Pill */}
            {!isFinished && (
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-mono font-bold text-white flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span>Ad Playing: {timeLeft}s</span>
              </div>
            )}

            {/* Overlay when complete */}
            {isFinished && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                <CheckCircle2 size={46} className="text-green-400 mb-2 animate-bounce" />
                <span className="text-base font-black text-white">Ad Verification Complete!</span>
                <span className="text-xs text-orange-300 mt-1">
                  Ready to claim +{task.reward_coins} E-FORCE & +{task.speed_boost}/hr Speed!
                </span>
              </div>
            )}
          </div>

          {/* Progress Line */}
          <div className="w-full h-1.5 bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-orange to-amber-400"
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
              <span className="text-xs text-gray-300">Boost Unlocked:</span>
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
                className="w-full py-3 px-4 rounded-xl font-extrabold text-sm text-black bg-gradient-to-r from-white via-orange-100 to-brand-orange shadow-orange-glow flex items-center justify-center gap-2"
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
