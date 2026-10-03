import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, ShieldCheck, RefreshCw, ArrowRight, Sparkles } from 'lucide-react';
import { tg } from '../services/telegram';

interface StartBotGateProps {
  userId?: number;
  referrerId?: number;
  onVerify: () => Promise<void> | void;
}

export const StartBotGate: React.FC<StartBotGateProps> = ({ userId, referrerId, onVerify }) => {
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const botHandle = 'Elite_Force_Official_Mining_bot';
  const startPayload = referrerId ? `ref_${referrerId}` : 'start';
  const botDeepLink = `https://t.me/${botHandle}?start=${startPayload}`;

  const handleOpenBot = () => {
    tg.haptic.impact('heavy');
    tg.openTelegramLink(botDeepLink);
  };

  const handleVerify = async () => {
    tg.haptic.impact('medium');
    setChecking(true);
    setErrorMsg(null);
    try {
      await onVerify();
    } catch (e: any) {
      setErrorMsg(e.message || 'Bot chat not found. Please tap Start in the bot first!');
      tg.haptic.notification('error');
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] text-white flex flex-col items-center justify-start sm:justify-center px-4 py-8 relative overflow-y-auto overflow-x-hidden select-none pb-16 font-sans">
      {/* Dynamic Ambient Orange Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-brand-orange/20 via-orange-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-10 right-0 w-80 h-80 bg-brand-orange/15 blur-3xl pointer-events-none" />
      <div className="fixed -top-10 left-0 w-80 h-80 bg-orange-700/15 blur-3xl pointer-events-none" />

      {/* Cyber Grid Lines */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: `linear-gradient(#FF5E00 1px, transparent 1px), linear-gradient(90deg, #FF5E00 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 space-y-4 my-auto"
      >
        {/* Main Card */}
        <div className="rounded-3xl p-6 bg-gradient-to-b from-[#161724] via-[#10111A] to-[#0A0A0F] border border-orange-500/35 shadow-orange-glow relative overflow-hidden">
          {/* Top glowing orange bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600 animate-pulse" />

          {/* Animated Bot Avatar */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="relative mb-3">
              <span className="absolute inset-0 rounded-3xl bg-brand-orange/30 animate-ping opacity-75" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-orange via-orange-500 to-amber-500 p-[1.5px] shadow-orange-glow flex items-center justify-center">
                <div className="w-full h-full rounded-[22px] bg-[#0E0F17] flex items-center justify-center">
                  <Bot size={38} className="text-brand-orange animate-pulse" />
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-black tracking-widest uppercase mb-2">
              <Sparkles size={12} className="text-brand-orange" />
              <span>ACTIVATION REQUIRED</span>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight uppercase leading-tight">
              Start Bot to Activate
            </h1>
            <p className="text-xs text-gray-300 mt-1.5 max-w-xs leading-relaxed">
              To join the mining network and protect against automated bots, you must start our official Telegram bot first.
            </p>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="p-4 rounded-2xl bg-black/50 border border-white/10 mb-5 space-y-2.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <ShieldCheck size={13} />
              <span>3 Quick Steps to Activate:</span>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-brand-orange font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap <b>Open Bot & Tap Start</b> below to visit <code className="text-orange-300 font-mono text-[11px]">@{botHandle}</code>.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-brand-orange font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Press the <b>START</b> button at the bottom of the Telegram bot chat.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-brand-orange font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Return to this screen and tap <b>Verify & Enter Mining Protocol</b>.
                </span>
              </div>
            </div>
          </div>

          {/* Error Message if not started yet */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center mb-4 font-medium animate-shake">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={handleOpenBot}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-brand-orange via-orange-500 to-amber-500 text-white font-black text-sm tracking-wide shadow-orange-glow hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={17} />
              <span>Open Bot & Tap /start</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={handleVerify}
              disabled={checking}
              className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={checking ? 'animate-spin text-brand-orange' : 'text-gray-300'} />
              <span>{checking ? 'Checking Telegram Bot Status...' : "I've Tapped /start (Verify & Enter)"}</span>
            </button>
          </div>
        </div>

        {/* Security Note Footer */}
        <div className="text-center text-[11px] text-gray-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
            <span>Official Bot Security Protocol: Only verified accounts are registered.</span>
          </p>
          <p className="text-[10px] text-gray-600 font-mono">
            {userId ? `Telegram UID: #${userId}` : 'E-FORCE Official Security Protocol v2.5'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
