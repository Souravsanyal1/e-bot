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
    <div className="min-h-screen bg-[#0A0507] text-white flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden select-none">
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
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 space-y-4"
      >
        {/* Main Banned Hero Card */}
        <div className="rounded-3xl p-6 bg-gradient-to-b from-[#1A0B0E] via-[#14080B] to-[#0D0406] border border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.25)] relative overflow-hidden">
          {/* Subtle Warning Stripe along the top edge */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse" />

          {/* Glowing Red Icon with Ping Ring */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="relative mb-4">
              <span className="absolute inset-0 rounded-3xl bg-red-500/30 animate-ping opacity-75" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-red-950 p-[1.5px] shadow-[0_0_25px_rgba(239,68,68,0.5)] flex items-center justify-center">
                <div className="w-full h-full rounded-[22px] bg-[#170508] flex items-center justify-center">
                  <ShieldAlert size={38} className="text-red-500 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-black tracking-widest uppercase mb-2">
              <Ban size={12} className="text-red-400" />
              <span>ACCESS RESTRICTED</span>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight uppercase">
              Account Suspended
            </h1>
            <p className="text-xs text-red-200/70 mt-1 max-w-xs leading-relaxed">
              Your access to the E-FORCE Mining Protocol has been blocked by Platform Administration.
            </p>
          </div>

          {/* User Identification Chip */}
          <div className="p-3 rounded-2xl bg-black/50 border border-white/5 flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/20 flex items-center justify-center text-red-400 font-bold shrink-0">
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span>{user?.first_name?.charAt(0) || 'M'}</span>
                )}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{user?.first_name || 'Miner'}</span>
                  {user?.username && <span className="text-[11px] text-gray-400 font-mono">@{user.username}</span>}
                </div>
                <div className="text-[10px] text-red-400/90 font-mono">
                  UID: #{user?.id || '—'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-mono font-bold uppercase">
                STATUS: BANNED
              </span>
            </div>
          </div>

          {/* Reason Box */}
          <div className="p-3.5 rounded-2xl bg-red-950/20 border border-red-500/20 mb-4 space-y-1">
            <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
              <AlertTriangle size={13} />
              <span>Reason for Restriction:</span>
            </div>
            <p className="text-xs text-gray-300 font-medium leading-relaxed pl-5">
              {user?.ban_reason || 'Violation of E-FORCE fair-play protocol, multi-accounting, or bot automation abuse.'}
            </p>
          </div>

          {/* Restrictions Summary */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 mb-5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Lock size={12} className="text-red-400" />
              <span>Applied Restrictions</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-gray-400">Mining Reactor:</span>
                <span className="text-red-400 font-bold font-mono">HALTED</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-gray-400">Withdrawals:</span>
                <span className="text-red-400 font-bold font-mono">FROZEN</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-gray-400">Leaderboard:</span>
                <span className="text-red-400 font-bold font-mono">EXCLUDED</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                <span className="text-gray-400">Token Balance:</span>
                <span className="text-red-400 font-bold font-mono">LOCKED</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={handleContactSupport}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-extrabold text-sm tracking-wide shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={16} />
              <span>Appeal to Official Support</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={checking}
              className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={checking ? 'animate-spin text-red-400' : 'text-gray-400'} />
              <span>{checking ? 'Checking Status...' : 'Check Status / Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="text-center text-[11px] text-gray-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <HelpCircle size={12} className="text-gray-400" />
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
