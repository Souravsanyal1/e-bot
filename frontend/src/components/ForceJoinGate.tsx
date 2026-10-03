import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Send, 
  Users, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { tg } from '../services/telegram';
import { verifyChannelMembership, saveUserForceJoined } from '../services/firestore';
import type { ForceJoinItem } from '../types';

interface ForceJoinGateProps {
  userId: number;
  channels: ForceJoinItem[];
  onComplete: () => void;
}

export const ForceJoinGate: React.FC<ForceJoinGateProps> = ({ userId, channels, onComplete }) => {
  const [visitedChannels, setVisitedChannels] = useState<Record<string, boolean>>({});
  const [verifiedChannels, setVerifiedChannels] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [botAdminNotice, setBotAdminNotice] = useState<string | null>(null);

  const handleOpenChannel = (item: ForceJoinItem) => {
    tg.haptic.impact('medium');
    setVisitedChannels(prev => ({ ...prev, [item.id]: true }));
    setErrorMessage(null);
    if (item.invite_link) {
      tg.openTelegramLink(item.invite_link);
    }
  };

  const handleVerifyAll = async () => {
    tg.haptic.impact('heavy');
    setVerifying(true);
    setErrorMessage(null);
    setBotAdminNotice(null);

    const newVerified: Record<string, boolean> = { ...verifiedChannels };
    let allPassed = true;
    let failedNames: string[] = [];
    let hadBotAdminIssue = false;

    for (const item of channels) {
      // If already verified previously, keep it
      if (newVerified[item.id]) continue;

      const check = await verifyChannelMembership(userId, item.username_or_id);
      if (check.joined) {
        newVerified[item.id] = true;
      } else {
        if (check.botNotAdmin) {
          hadBotAdminIssue = true;
          // If the bot cannot check because it's not admin, but the user clicked Join
          if (visitedChannels[item.id]) {
            newVerified[item.id] = true; // allow visited fallback
          } else {
            allPassed = false;
            failedNames.push(item.name);
          }
        } else {
          allPassed = false;
          failedNames.push(item.name);
        }
      }
    }

    setVerifiedChannels(newVerified);

    if (hadBotAdminIssue) {
      setBotAdminNotice('Note: Bot requires Admin rights in the channel to auto-verify directly. Please ensure you tap Join.');
    }

    if (allPassed || Object.keys(newVerified).length >= channels.length) {
      tg.haptic.notification('success');
      try {
        await saveUserForceJoined(userId);
      } catch (e) {
        console.warn('saveUserForceJoined error:', e);
      }
      setTimeout(() => {
        onComplete();
      }, 600);
    } else {
      tg.haptic.notification('error');
      setErrorMessage(
        failedNames.length > 0 
          ? `Please tap "Join" for: ${failedNames.join(', ')}` 
          : 'Please join all required channels/groups first!'
      );
    }
    setVerifying(false);
  };

  const allVerified = channels.every(c => verifiedChannels[c.id]);

  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] text-white flex flex-col items-center justify-start sm:justify-center px-4 py-8 relative overflow-y-auto overflow-x-hidden select-none pb-16 font-sans">
      {/* Dynamic Ambient Orange Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-brand-orange/20 via-orange-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-10 right-0 w-80 h-80 bg-brand-orange/15 blur-3xl pointer-events-none" />
      <div className="fixed -top-10 left-0 w-80 h-80 bg-cyan-700/10 blur-3xl pointer-events-none" />

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
        {/* Top Header Card */}
        <div className="relative rounded-3xl p-6 bg-gradient-to-b from-[#181926]/90 via-[#13141F]/80 to-[#0F1018]/90 border border-orange-500/25 shadow-2xl backdrop-blur-xl text-center space-y-3">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-brand-orange to-yellow-500 blur-lg opacity-40 animate-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-[#0F1018] border-2 border-orange-500/50 flex items-center justify-center shadow-inner">
              <Lock size={36} className="text-brand-orange" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#0A0A0F] flex items-center justify-center">
              <ShieldCheck size={16} className="text-black stroke-[3]" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-brand-orange text-[10px] font-black uppercase tracking-wider mb-2">
              <Sparkles size={12} />
              <span>Mandatory Membership</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              JOIN OFFICIAL CHANNELS
            </h1>
            <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
              To prevent bot spam and receive official withdrawal notices, please join our official Telegram channel & community group to unlock full mining access.
            </p>
          </div>
        </div>

        {/* Required Channel List */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-1 flex items-center justify-between">
            <span>Required Communities ({channels.length})</span>
            <span className="text-orange-400 font-mono">Step 1 of 2</span>
          </div>

          {channels.map((item) => {
            const isVerified = Boolean(verifiedChannels[item.id]);
            const isVisited = Boolean(visitedChannels[item.id]);

            return (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.01 }}
                className={`p-4 rounded-2xl border transition-all ${
                  isVerified
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : isVisited
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-[#141522]/80 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      isVerified
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-white/5 border-white/10 text-orange-400'
                    }`}>
                      {item.type === 'group' ? <Users size={20} /> : <Send size={20} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-xs sm:text-sm truncate">
                          {item.name}
                        </span>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.type === 'group' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {item.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
                        {item.username_or_id}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isVerified ? (
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono">
                        <CheckCircle2 size={14} />
                        <span>Joined</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenChannel(item)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm ${
                          isVisited
                            ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                            : 'bg-gradient-to-r from-brand-orange to-orange-500 text-white shadow-orange-glow hover:brightness-110'
                        }`}
                      >
                        <span>{isVisited ? 'Re-open' : 'Join'}</span>
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bot Admin Notice if applicable */}
        {botAdminNotice && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
            <p className="leading-snug">{botAdminNotice}</p>
          </div>
        )}

        {/* Error Alert Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <p className="font-semibold leading-snug">{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification Action Button */}
        <div className="pt-2 space-y-3">
          <button
            type="button"
            disabled={verifying}
            onClick={handleVerifyAll}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden ${
              allVerified
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-black shadow-lg shadow-emerald-500/30'
                : 'bg-gradient-to-r from-brand-orange via-orange-500 to-yellow-500 text-black shadow-orange-glow hover:brightness-110 active:scale-[0.99]'
            }`}
          >
            {verifying ? (
              <>
                <RefreshCw size={18} className="animate-spin text-black" />
                <span>Checking Membership...</span>
              </>
            ) : allVerified ? (
              <>
                <CheckCircle2 size={18} className="text-black" />
                <span>Membership Verified! Entering...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} className="text-black" />
                <span>I Have Joined All Channels (Verify)</span>
                <ArrowRight size={16} className="text-black" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-gray-500">
            Account ID: <span className="font-mono text-gray-400">{userId}</span> • Instant automated verification
          </p>
        </div>
      </motion.div>
    </div>
  );
};
