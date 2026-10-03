import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, AlertTriangle, RefreshCw, Send, 
  Lock, Ban, HelpCircle 
} from 'lucide-react';
import type { User } from '../types';
import { tg } from '../services/telegram';

interface BannedPageProps {
  user: User | null;
  onRefresh?: () => Promise<void> | void;
}

export const BannedPage: React.FC<BannedPageProps> = ({ user, onRefresh }) => {
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    tg.haptic.impact('medium');
    setChecking(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    } finally {
      setTimeout(() => setChecking(false), 1200);
    }
  };

  const handleContactSupport = () => {
    tg.haptic.impact('heavy');
    const supportMessage = encodeURIComponent(
      `Hello E-FORCE Support,\n\nMy account has been suspended and I would like to appeal.\nTelegram UID: ${user?.id || 'Unknown'}\nUsername: @${user?.username || 'none'}`
    );
    tg.openTelegramLink(`https://t.me/Elite_Force_Official_Mining_bot?text=${supportMessage}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0507] text-white flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-10 relative overflow-y-auto overflow-x-hidden select-none pb-16">
      {/* Background Red Warning Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-red-600/20 via-red-900/10 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-10 right-0 w-80 h-80 bg-red-600/15 blur-3xl pointer-events-none" />
      <div className="fixed -top-10 left-0 w-80 h-80 bg-red-800/15 blur-3xl pointer-events-none" />

      {/* Cyber Grid Lines Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: `linear-gradient(#ff0000 1px, transparent 1px), linear-gradient(90deg, #ff0000 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 space-y-3.5 my-auto"
      >
        {/* Main Banned Hero Card */}
        <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-b from-[#1C0C10] via-[#14080B] to-[#0D0406] border border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.25)] relative overflow-hidden">
          {/* Warning Stripe along the top edge */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse" />

          {/* Glowing Red Icon with Ping Ring */}
          <div className="flex flex-col items-center text-center mb-4">
            <div className="relative mb-3">
              <span className="absolute inset-0 rounded-2xl bg-red-500/30 animate-ping opacity-75" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-red-950 p-[1.5px] shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-[#170508] flex items-center justify-center">
                  <ShieldAlert size={30} className="text-red-500 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-black tracking-widest uppercase mb-1.5">
              <Ban size={11} className="text-red-400" />
              <span>ACCESS RESTRICTED</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase leading-tight">
              Account Suspended
            </h1>
            <p className="text-[11px] sm:text-xs text-red-200/70 mt-1 max-w-xs leading-relaxed">
              Your access to the E-FORCE Mining Protocol has been blocked by Platform Administration.
            </p>
          </div>

          {/* User Identification Chip (Clean Multi-line, NO text overlap) */}
          <div className="p-3 rounded-2xl bg-black/60 border border-red-500/20 flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-red-950/70 border border-red-500/30 flex items-center justify-center text-red-300 font-bold shrink-0 overflow-hidden">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{user?.first_name?.charAt(0) || 'M'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <span className="text-xs font-black text-white truncate leading-tight">
                  {user?.first_name || 'Miner'}
                </span>
                {user?.username && (
                  <span className="text-[11px] text-gray-400 font-mono truncate leading-tight mt-0.5">
                    @{user.username}
                  </span>
                )}
                <span className="text-[10px] text-red-400 font-mono leading-tight mt-0.5">
                  UID: #{user?.id || '—'}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end justify-center">
              <span className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-mono font-black tracking-wide uppercase">
                BANNED
              </span>
            </div>
          </div>

          {/* Reason Box */}
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/25 mb-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
              <AlertTriangle size={13} className="shrink-0" />
              <span>Reason for Restriction:</span>
            </div>
            <p className="text-xs text-gray-300 font-medium leading-relaxed pl-5 break-words">
              {user?.ban_reason || 'Violation of E-FORCE fair-play protocol, multi-accounting, or bot automation abuse.'}
            </p>
          </div>

          {/* Restrictions Summary */}
          <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-2 mb-4 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Lock size={12} className="text-red-400" />
              <span>Applied Restrictions</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-[10px]">Mining Reactor:</span>
                <span className="text-red-400 font-bold font-mono text-[10px]">HALTED</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-[10px]">Withdrawals:</span>
                <span className="text-red-400 font-bold font-mono text-[10px]">FROZEN</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-[10px]">Leaderboard:</span>
                <span className="text-red-400 font-bold font-mono text-[10px]">EXCLUDED</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-[10px]">Token Balance:</span>
                <span className="text-red-400 font-bold font-mono text-[10px]">LOCKED</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleContactSupport}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={15} />
              <span>Appeal to Official Support</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={checking}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={13} className={checking ? 'animate-spin text-red-400' : 'text-gray-400'} />
              <span>{checking ? 'Checking Status...' : 'Check Status / Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="text-center text-[11px] text-gray-500 space-y-1 pb-4">
          <p className="flex items-center justify-center gap-1">
            <HelpCircle size={12} className="text-gray-400 shrink-0" />
            <span>Believe this was a mistake? Contact the Telegram Administrator.</span>
          </p>
          <p className="text-[10px] text-gray-600 font-mono">
            E-FORCE Anti-Fraud Enforcement System • Protocol v2.4
          </p>
        </div>
      </motion.div>
    </div>
  );
};
