import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowDownUp, 
  Coins, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw,
  Zap,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { tg } from '../services/telegram';
import { 
  swapPointsToTokensFirestore, 
  getUserSwapsFirestore, 
  type AppSettings 
} from '../services/firestore';
import type { User, SwapRecord } from '../types';

interface SwapTabProps {
  user: User | null;
  appSettings?: AppSettings | null;
  onRefresh: () => void;
  onNavigateToWithdraw?: () => void;
}

export const SwapTab: React.FC<SwapTabProps> = ({ 
  user, 
  appSettings, 
  onRefresh,
  onNavigateToWithdraw 
}) => {
  const [pointsInput, setPointsInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const swapRate = appSettings?.swap_rate !== undefined ? Number(appSettings.swap_rate) : 1000;
  const minSwap = appSettings?.min_swap_points !== undefined ? Number(appSettings.min_swap_points) : 1000;
  const swapEnabled = appSettings?.swap_enabled !== false;

  const userPoints = Number(user?.balance || 0);
  const userTokens = Number(user?.eforce_balance || 0);

  const parsedPoints = parseFloat(pointsInput) || 0;
  const calculatedTokens = parsedPoints > 0 && swapRate > 0 
    ? Number((parsedPoints / swapRate).toFixed(4)) 
    : 0;

  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user?.id]);

  const loadHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const list = await getUserSwapsFirestore(user.id);
      setSwaps(list);
    } catch (e) {
      console.warn('Failed to load swap history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSetPercent = (pct: number) => {
    tg.haptic.impact('light');
    setErrorMsg(null);
    const val = Math.floor((userPoints * pct) / 100);
    setPointsInput(val > 0 ? String(val) : '');
  };

  const handleAddPreset = (addVal: number) => {
    tg.haptic.impact('light');
    setErrorMsg(null);
    const current = parseFloat(pointsInput) || 0;
    const next = Math.min(userPoints, current + addVal);
    setPointsInput(String(Math.floor(next)));
  };

  const handleSwap = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user?.id) {
      setErrorMsg('User profile not detected. Please restart mini app.');
      return;
    }

    if (!swapEnabled) {
      setErrorMsg('Token swapping is currently paused by admin.');
      tg.haptic.notification('error');
      return;
    }

    if (isNaN(parsedPoints) || parsedPoints <= 0) {
      setErrorMsg('Please enter a valid points amount to swap.');
      tg.haptic.notification('error');
      return;
    }

    if (parsedPoints < minSwap) {
      setErrorMsg(`Minimum swap is ${minSwap.toLocaleString()} Points.`);
      tg.haptic.notification('error');
      return;
    }

    if (parsedPoints > userPoints) {
      setErrorMsg(`Insufficient Points balance! You have ${userPoints.toLocaleString()} Points.`);
      tg.haptic.notification('error');
      return;
    }

    setSubmitting(true);
    tg.haptic.impact('heavy');

    try {
      const result = await swapPointsToTokensFirestore(user.id, parsedPoints);

      // Trigger Confetti
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#FF6600', '#FFAE00', '#FFFFFF', '#10B981']
        });
      } catch (_) {}

      tg.haptic.notification('success');
      setSuccessMsg(`Successfully swapped ${result.pointsSwapped.toLocaleString()} Points into ${result.tokensReceived.toFixed(4)} E-FORCE!`);
      setPointsInput('');
      onRefresh();
      loadHistory();
    } catch (err: any) {
      setErrorMsg(err.message || 'Swap transaction failed.');
      tg.haptic.notification('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-24 space-y-4">
      {/* Swap Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#12131F] to-[#0A0A10] border border-orange-500/25 p-4 sm:p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-brand-orange/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-amber-500 p-0.5 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,102,0,0.3)]">
              <div className="w-full h-full bg-[#0C0D14] rounded-[10px] flex items-center justify-center">
                <ArrowDownUp size={20} className="text-brand-orange" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">TOKEN SWAP</h2>
                {swapEnabled ? (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                    PAUSED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">Convert mined points into on-chain E-FORCE tokens</p>
            </div>
          </div>
        </div>

        {/* Dynamic Rate Highlight */}
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles size={14} className="text-brand-orange animate-pulse" />
            <span className="text-gray-300 font-medium">Exchange Rate:</span>
          </div>
          <div className="font-mono text-xs font-black text-brand-orange">
            {swapRate.toLocaleString()} Points = 1.00 E-FORCE
          </div>
        </div>
      </div>

      {/* Admin Paused Alert */}
      {!swapEnabled && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300"
        >
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Token Swapping Temporarily Paused</div>
            <div className="text-[11px] text-red-300/80 mt-0.5">
              The administrator has temporarily paused token swapping. Please check back shortly or continue mining points!
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Swap Card */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-3 relative shadow-xl backdrop-blur-sm">
        {/* FROM: Points Input */}
        <div className="p-3.5 rounded-xl bg-[#0F101A] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium flex items-center gap-1.5">
              <Zap size={13} className="text-orange-400 fill-orange-400" />
              <span>You Pay (Mined Points)</span>
            </span>
            <span className="text-[11px] text-gray-400">
              Available:{' '}
              <strong className="text-white font-mono">{userPoints.toLocaleString()} PTS</strong>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              min="0"
              step="1"
              value={pointsInput}
              onChange={(e) => {
                setPointsInput(e.target.value);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              placeholder="0"
              disabled={!swapEnabled || submitting}
              className="w-full bg-transparent font-mono text-2xl sm:text-3xl font-black text-white focus:outline-none placeholder:text-gray-600"
            />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 shrink-0">
              <Flame size={14} className="text-brand-orange fill-brand-orange" />
              <span className="text-xs font-black text-white tracking-wider">POINTS</span>
            </div>
          </div>

          {/* Quick Selectors */}
          <div className="flex items-center gap-1.5 pt-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleSetPercent(pct)}
                disabled={!swapEnabled || submitting || userPoints <= 0}
                className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-orange-500/20 text-gray-400 hover:text-white border border-white/5 hover:border-orange-500/30 text-[10px] font-bold transition-all disabled:opacity-40"
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {[1000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleAddPreset(preset)}
                disabled={!swapEnabled || submitting || userPoints < preset}
                className="flex-1 py-0.5 rounded-md bg-white/[0.03] hover:bg-white/10 text-gray-500 hover:text-gray-300 text-[9px] font-mono font-medium transition-all disabled:opacity-30"
              >
                +{preset >= 1000 ? `${preset / 1000}k` : preset}
              </button>
            ))}
          </div>
        </div>

        {/* Direction Switch Icon */}
        <div className="flex items-center justify-center -my-1 relative z-10">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1E202E] to-[#12131D] border border-orange-500/40 shadow-[0_0_12px_rgba(255,102,0,0.3)] flex items-center justify-center text-brand-orange">
            <ArrowDownUp size={16} />
          </div>
        </div>

        {/* TO: E-FORCE Token Output */}
        <div className="p-3.5 rounded-xl bg-[#0F101A] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium flex items-center gap-1.5">
              <Coins size={13} className="text-amber-400" />
              <span>You Receive (E-FORCE Token)</span>
            </span>
            <span className="text-[11px] text-gray-400">
              Tokens Balance:{' '}
              <strong className="text-amber-400 font-mono">{userTokens.toFixed(2)}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-2xl sm:text-3xl font-black text-brand-orange tracking-tight select-none">
              {calculatedTokens > 0 ? calculatedTokens.toFixed(4) : '0.0000'}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-orange to-amber-500 text-white shrink-0 shadow-sm">
              <img src="/canva.png" alt="E-FORCE" className="w-4 h-4 rounded-full object-contain" />
              <span className="text-xs font-black tracking-wider">E-FORCE</span>
            </div>
          </div>
        </div>

        {/* Protocol Details Summary */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <span>Minimum Swap</span>
            <span className="text-gray-200 font-mono font-medium">{minSwap.toLocaleString()} Points</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Conversion Rate</span>
            <span className="text-gray-200 font-mono font-medium">1 Token = {swapRate.toLocaleString()} PTS</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Protocol Swap Fee</span>
            <span className="text-emerald-400 font-medium">0% (Instant In-App)</span>
          </div>
        </div>

        {/* Error / Success Feedback */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-medium"
            >
              <AlertCircle size={15} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 font-medium"
            >
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swap Action Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSwap}
          disabled={
            !swapEnabled ||
            submitting ||
            parsedPoints <= 0 ||
            parsedPoints < minSwap ||
            parsedPoints > userPoints
          }
          className={`w-full py-4 rounded-xl font-black text-sm tracking-wider uppercase transition-all duration-300 shadow-orange-glow flex items-center justify-center gap-2 ${
            !swapEnabled
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
              : parsedPoints > userPoints
              ? 'bg-red-500/20 text-red-300 border border-red-500/40 cursor-not-allowed'
              : parsedPoints > 0 && parsedPoints < minSwap
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-not-allowed'
              : parsedPoints > 0
              ? 'bg-gradient-to-r from-brand-orange via-amber-500 to-orange-500 text-white hover:brightness-110'
              : 'bg-white/10 text-gray-400 border border-white/10'
          }`}
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : !swapEnabled ? (
            'SWAP TEMPORARILY DISABLED'
          ) : parsedPoints > userPoints ? (
            'INSUFFICIENT POINTS'
          ) : parsedPoints > 0 && parsedPoints < minSwap ? (
            `MINIMUM ${minSwap.toLocaleString()} POINTS REQUIRED`
          ) : parsedPoints > 0 ? (
            <>
              <ArrowDownUp size={16} />
              <span>SWAP NOW FOR {calculatedTokens.toFixed(4)} E-FORCE</span>
            </>
          ) : (
            'ENTER POINTS AMOUNT TO SWAP'
          )}
        </motion.button>
      </div>

      {/* Withdraw Shortcut Banner */}
      {userTokens > 0 && onNavigateToWithdraw && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-400/5 to-transparent border border-emerald-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Coins size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                You have {userTokens.toFixed(2)} E-FORCE ready!
              </div>
              <div className="text-[10px] text-gray-400">Withdraw to your BEP20 BNB Smart Chain wallet</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToWithdraw}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs shrink-0 hover:bg-emerald-400 flex items-center gap-1 transition-colors"
          >
            <span>Withdraw</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Recent Swaps History */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Your Swap History</span>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
          </button>
        </div>

        {swaps.length > 0 ? (
          <div className="space-y-2">
            {swaps.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <span className="text-gray-400">-{item.points_swapped.toLocaleString()} PTS</span>
                    <ArrowRight size={11} className="text-brand-orange" />
                    <span className="text-amber-400">+{item.tokens_received.toFixed(4)} E-FORCE</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {new Date(item.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Completed
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-gray-500">
            {loadingHistory ? 'Loading swap transactions...' : 'No swaps yet. Convert your points to tokens above!'}
          </div>
        )}
      </div>
    </div>
  );
};
