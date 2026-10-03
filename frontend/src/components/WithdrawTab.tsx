import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, ArrowDownToLine, AlertCircle, 
  Clock, CheckCircle2, XCircle, Copy, Check, Sparkles, 
  RefreshCw, Info, ExternalLink
} from 'lucide-react';
import { 
  createWithdrawalFirestore, 
  getUserWithdrawalsFirestore, 
  getAppSettings,
  subscribeToAppSettingsFirestore
} from '../services/firestore';
import { NETWORKS } from '../services/blockchain';
import { tg } from '../services/telegram';
import { ethers } from 'ethers';
import { api } from '../services/api';
import type { User, WithdrawalRequest } from '../types';

interface WithdrawTabProps {
  user: User | null;
  onBalanceUpdate?: (newBalance: number) => void;
}

// Web3 Deterministic Keccak256 algorithm: generates unique 6-digit code from BEP20 wallet address
export function generateDeterministicUserId(wallet?: string | null): string {
  if (!wallet || typeof wallet !== 'string') return '824305';
  const clean = wallet.trim().toLowerCase();

  // Fixed admin wallet addresses
  if (
    clean === '0xef8d811329b497ed6f84c4c9b0b72377a37f74bf' ||
    clean === '0x278af081c134d840d82b6a23f98a68492ba59785' ||
    clean === ''
  ) {
    return '824305';
  }

  try {
    if (clean.length === 42 && clean.startsWith('0x')) {
      const hash = ethers.solidityPackedKeccak256(['address'], [clean]);
      const num = (BigInt(hash) % 900000n) + 100000n;
      return num.toString();
    }
  } catch {}

  // Fallback: 32-bit bitwise rolling hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return String((Math.abs(hash) % 900000) + 100000);
}

export const generate6DigitCode = generateDeterministicUserId;

export const WithdrawTab: React.FC<WithdrawTabProps> = ({ user, onBalanceUpdate }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [referCode, setReferCode] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Settings from admin
  const [feePercent, setFeePercent] = useState<number>(5);
  const [minAmount, setMinAmount] = useState<number>(50);
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [contractAddress, setContractAddress] = useState<string>('0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90');
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  // Alerts & UX
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Automatically generate 6-digit Keccak-256 verification code whenever BEP20 address is present
  useEffect(() => {
    if (walletAddress.trim().length >= 10) {
      const generated = generateDeterministicUserId(walletAddress);
      if (generated) setReferCode(generated);
    }
  }, [walletAddress]);

  // Load Settings & User History with real-time subscription
  useEffect(() => {
    loadSettings();
    const unsubscribe = subscribeToAppSettingsFirestore((cfg) => {
      if (cfg.withdraw_fee_percent !== undefined) setFeePercent(cfg.withdraw_fee_percent);
      if (cfg.min_withdraw_amount !== undefined) setMinAmount(cfg.min_withdraw_amount);
      if (cfg.withdraw_enabled !== undefined) setWithdrawEnabled(cfg.withdraw_enabled);
      if (cfg.bep20_contract_address) setContractAddress(cfg.bep20_contract_address);
      if (cfg.blockchain_network) setNetwork(cfg.blockchain_network);
    });

    if (user?.id) {
      loadHistory();
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.id]);

  const loadSettings = async () => {
    try {
      const cfg = await getAppSettings();
      if (cfg.withdraw_fee_percent !== undefined) setFeePercent(cfg.withdraw_fee_percent);
      if (cfg.min_withdraw_amount !== undefined) setMinAmount(cfg.min_withdraw_amount);
      if (cfg.withdraw_enabled !== undefined) setWithdrawEnabled(cfg.withdraw_enabled);
      if (cfg.bep20_contract_address) setContractAddress(cfg.bep20_contract_address);
      if (cfg.blockchain_network) setNetwork(cfg.blockchain_network);
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const loadHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const list = await getUserWithdrawalsFirestore(user.id);
      setWithdrawals(list);
    } catch (e) {
      console.warn('Failed to load withdrawals:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleMaxClick = () => {
    if (!user) return;
    tg.haptic.impact('light');
    setAmount(Math.max(0, user.balance).toFixed(2));
  };

  const handlePercentClick = (pct: number) => {
    if (!user) return;
    tg.haptic.impact('light');
    const val = (user.balance * pct) / 100;
    setAmount(val.toFixed(2));
  };

  const handleAddressChange = (val: string) => {
    const clean = val.trim();
    setWalletAddress(clean);
    if (clean.length >= 10) {
      const generated = generateDeterministicUserId(clean);
      if (generated) {
        setReferCode(generated);
      }
    } else if (clean.length === 0) {
      setReferCode('');
    }
  };

  const handlePasteAddress = async () => {
    tg.haptic.impact('light');
    let text = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      } else {
        text = prompt('Paste your BEP20 Wallet Address (0x...):') || '';
      }
    } catch {
      text = prompt('Paste your BEP20 Wallet Address (0x...):') || '';
    }
    if (text) {
      handleAddressChange(text);
      tg.haptic.notification('success');
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const calculatedFee = (parsedAmount * feePercent) / 100;
  const netReceived = Math.max(0, parsedAmount - calculatedFee);

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim());
  const isValidCode = referCode.trim().length === 6;
  const isAmountValid = parsedAmount >= minAmount && parsedAmount <= (user?.balance || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user) {
      setErrorMessage('User session not found.');
      return;
    }

    if (!withdrawEnabled) {
      setErrorMessage('Withdrawals are temporarily disabled by the administrator.');
      return;
    }

    const cleanAddr = walletAddress.trim();
    if (!isValidAddress) {
      setErrorMessage('Invalid BEP20 Address! Must start with 0x and be 42 characters.');
      tg.haptic.notification('error');
      return;
    }

    const cleanCode = referCode.trim();
    if (!isValidCode) {
      setErrorMessage('Elite Force Refer Code must be exactly 6 characters.');
      tg.haptic.notification('error');
      return;
    }

    if (parsedAmount < minAmount) {
      setErrorMessage(`Minimum withdrawal is ${minAmount} E-FORCE.`);
      tg.haptic.notification('error');
      return;
    }

    if (parsedAmount > user.balance) {
      setErrorMessage(`Insufficient balance! You have ${user.balance.toFixed(2)} E-FORCE.`);
      tg.haptic.notification('error');
      return;
    }

    setSubmitting(true);
    tg.haptic.impact('medium');

    try {
      const res = await createWithdrawalFirestore({
        userId: user.id,
        userName: user.first_name || 'Miner',
        username: user.username || '',
        walletAddress: cleanAddr,
        referCode: cleanCode,
        amount: parsedAmount,
        feePercent: feePercent
      });

      if (onBalanceUpdate) {
        onBalanceUpdate(res.newBalance);
      }

      // Trigger Telegram Bot Notification (Alerts user and admin)
      api.notifyWithdrawalSubmitted({
        userId: user.id,
        userName: user.first_name || 'Miner',
        username: user.username || '',
        amount: parsedAmount,
        feeAmount: res.withdrawal.fee_amount,
        feePercent: res.withdrawal.fee_percent,
        netAmount: res.withdrawal.net_amount,
        walletAddress: cleanAddr,
        referCode: cleanCode
      }).catch(() => {});

      tg.haptic.notification('success');
      setSuccessMessage(`Withdrawal request of ${parsedAmount} E-FORCE submitted to admin successfully!`);
      setAmount('');
      loadHistory();
    } catch (err: any) {
      tg.haptic.notification('error');
      setErrorMessage(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    tg.haptic.selection();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full pb-24 px-4 space-y-5 animate-fade-in">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#12131F] to-[#0A0A10] border border-orange-500/20 p-4 sm:p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-36 h-36 bg-brand-orange/10 rounded-full blur-2xl pointer-events-none" />
        
        {/* Title Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-amber-500 p-0.5 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,102,0,0.3)]">
              <div className="w-full h-full bg-[#0C0D14] rounded-[10px] flex items-center justify-center">
                <Wallet size={20} className="text-brand-orange" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">WITHDRAWAL</h2>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  BEP20
                </span>
                {withdrawEnabled ? (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    OPEN
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/25 text-red-300 border border-red-500/40 flex items-center gap-1 shrink-0 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    PAUSED BY ADMIN
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate">Direct payout to BNB Smart Chain</p>
            </div>
          </div>
        </div>

        {/* Dedicated Available Balance Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/10 mb-3">
          <span className="text-xs text-gray-400 font-medium">Available Balance</span>
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-lg sm:text-xl font-black font-mono text-white">
              {(user?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-black text-brand-orange">E-FORCE</span>
          </div>
        </div>

        {/* Network & Fee Highlights */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/5">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-gray-300 truncate">Fee: <strong className="text-amber-400">{feePercent}%</strong></span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5 min-w-0">
            <ArrowDownToLine size={13} className="text-brand-orange shrink-0" />
            <span className="text-gray-300 truncate">Min: <strong className="text-white">{minAmount} E-FORCE</strong></span>
          </div>
        </div>

        {/* Dynamic Token Contract Link Pill */}
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Vault: <strong className="font-mono text-gray-300">{contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}</strong></span>
          </span>
          <a
            href={`${NETWORKS[network].explorerUrl}/address/${contractAddress}#tokentxns`}
            target="_blank"
            rel="noreferrer"
            className="text-orange-400 hover:underline flex items-center gap-1 font-bold text-[10px]"
          >
            <span>BscScan Txns</span>
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Withdrawal Form */}
      <form onSubmit={handleSubmit} className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
        {/* Prominent Warning Banner if Admin Turned Withdrawals OFF */}
        {!withdrawEnabled && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-red-950/40 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)] flex items-start gap-3 text-red-200">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0 mt-0.5">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span>Withdrawals Temporarily Paused by Admin</span>
                <span className="text-[10px] text-red-300 font-normal">(উইথড্র সাময়িকভাবে বন্ধ আছে)</span>
              </h4>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                The administrator has temporarily paused new withdrawal requests. Your mined tokens remain safe in your wallet balance. Submissions will be re-enabled soon.
              </p>
            </div>
          </div>
        )}

        {/* Field 1: BEP20 Wallet Address */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <span>BEP20 Wallet Address</span>
              <span className="text-brand-orange">*</span>
            </label>
            <button
              type="button"
              disabled={!withdrawEnabled}
              onClick={handlePasteAddress}
              className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
                !withdrawEnabled
                  ? 'text-gray-500 bg-white/5 border border-white/10 cursor-not-allowed'
                  : 'text-brand-orange hover:text-orange-400 bg-orange-500/10 border border-orange-500/20 active:scale-95'
              }`}
            >
              <Copy size={11} /> Paste
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              disabled={!withdrawEnabled}
              value={walletAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="0x..."
              className={`w-full bg-[#0E0F16] border rounded-xl px-3.5 py-3 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-all ${
                !withdrawEnabled
                  ? 'border-white/5 text-gray-500 cursor-not-allowed bg-black/40'
                  : walletAddress.length > 0
                  ? isValidAddress
                    ? 'border-emerald-500/60 focus:border-emerald-500'
                    : 'border-red-500/60 focus:border-red-500'
                  : 'border-white/10 focus:border-brand-orange'
              }`}
            />
            {walletAddress.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidAddress ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                )}
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            <Info size={11} className="text-gray-500" />
            Enter your Trust Wallet, MetaMask, or Binance BEP20 (BSC) address.
          </p>
        </div>

        {/* Field 2: Elite Force Refer Code (6 Digit) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
              <span>Refer Code</span>
              <span className="text-brand-orange text-[11px] font-semibold">* (6 Digits)</span>
            </label>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {referCode.length === 6 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 size={11} /> Auto-Generated
                </span>
              )}
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              disabled={!withdrawEnabled}
              maxLength={6}
              value={referCode}
              onChange={(e) => setReferCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="e.g. 849201"
              className={`w-full bg-[#0E0F16] border rounded-xl px-3.5 py-3 text-sm font-mono tracking-widest text-center font-bold text-white placeholder-gray-600 focus:outline-none transition-all ${
                !withdrawEnabled
                  ? 'border-white/5 text-gray-500 cursor-not-allowed bg-black/40'
                  : referCode.length > 0
                  ? isValidCode
                    ? 'border-emerald-500/60 focus:border-emerald-500 text-emerald-300'
                    : 'border-red-500/60 focus:border-red-500'
                  : 'border-white/10 focus:border-brand-orange'
              }`}
            />
            {referCode.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidCode ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <span className="text-[10px] font-mono text-gray-500">{referCode.length}/6</span>
                )}
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            <Sparkles size={11} className="text-brand-orange shrink-0" />
            <span>Enter your BEP20 address to automatically generate your 6-digit verification code.</span>
          </p>
        </div>

        {/* Field 3: Amount to Withdraw */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <span>Withdraw Amount</span>
              <span className="text-brand-orange">*</span>
            </label>
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {[25, 50, 75].map(pct => (
                <button
                  key={pct}
                  type="button"
                  disabled={!withdrawEnabled}
                  onClick={() => handlePercentClick(pct)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                    !withdrawEnabled
                      ? 'text-gray-600 bg-white/5 border-white/5 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/5 active:scale-95'
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <button
                type="button"
                disabled={!withdrawEnabled}
                onClick={handleMaxClick}
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded border transition-all ${
                  !withdrawEnabled
                    ? 'text-gray-600 bg-white/5 border-white/5 cursor-not-allowed'
                    : 'text-brand-orange bg-brand-orange/15 hover:bg-brand-orange/25 border-brand-orange/30 active:scale-95'
                }`}
              >
                MAX
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              disabled={!withdrawEnabled}
              step="any"
              min={minAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${minAmount}`}
              className={`w-full bg-[#0E0F16] border rounded-xl px-3.5 py-3 text-sm font-mono font-bold text-white placeholder-gray-600 focus:outline-none transition-all pr-20 ${
                !withdrawEnabled
                  ? 'border-white/5 text-gray-500 cursor-not-allowed bg-black/40'
                  : 'border-white/10 focus:border-brand-orange'
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-brand-orange">
              E-FORCE
            </div>
          </div>
        </div>

        {/* Fee & Net Payout Breakdown Box */}
        <div className="bg-[#0C0D14] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <span>Requested Amount:</span>
            <span className="font-mono font-bold text-white">
              {parsedAmount > 0 ? parsedAmount.toFixed(2) : '0.00'} E-FORCE
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-400">
            <span className="flex items-center gap-1">
              Admin Fee ({feePercent}%):
            </span>
            <span className="font-mono text-amber-400">
              -{calculatedFee.toFixed(2)} E-FORCE
            </span>
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-sm font-bold">
            <span className="text-gray-200">You Will Receive:</span>
            <span className="font-mono font-black text-emerald-400 flex items-center gap-1">
              <Sparkles size={14} className="text-emerald-400" />
              {netReceived.toFixed(2)} E-FORCE
            </span>
          </div>
        </div>

        {/* Notifications & Error alerts */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2"
            >
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"
            >
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !isValidAddress || !isValidCode || !isAmountValid || !withdrawEnabled}
          className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            !withdrawEnabled
              ? 'bg-red-500/15 text-red-300 border border-red-500/40 cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.15)]'
              : submitting || !isValidAddress || !isValidCode || !isAmountValid
              ? 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/5'
              : 'bg-gradient-to-r from-brand-orange via-orange-500 to-amber-500 text-black shadow-orange-glow active:scale-[0.98]'
          }`}
        >
          {!withdrawEnabled ? (
            <>
              <AlertCircle size={16} className="text-red-400" />
              <span>Withdrawals Disabled by Admin (উইথড্র বন্ধ আছে)</span>
            </>
          ) : submitting ? (
            <>
              <RefreshCw size={16} className="animate-spin text-black" />
              <span>Submitting Request...</span>
            </>
          ) : (
            <>
              <ArrowDownToLine size={16} />
              <span>Request Withdrawal</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          Withdrawal requests are reviewed and sent by admin to your BEP20 address. Requests are processed within 1-12 hours.
        </p>
      </form>

      {/* Section 2: User Withdrawal History */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-brand-orange" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Withdrawal History</h3>
          </div>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            title="Refresh History"
          >
            <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
          </button>
        </div>

        {withdrawals.length === 0 ? (
          <div className="py-8 text-center text-gray-500 space-y-2">
            <Wallet size={32} className="mx-auto opacity-30" />
            <p className="text-xs">No withdrawal requests yet</p>
            <p className="text-[11px] text-gray-600">Your submitted withdrawal requests will appear here</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {withdrawals.map((item) => {
              const isPending = item.status === 'pending';
              const isCompleted = item.status === 'completed';
              const isRejected = item.status === 'rejected';

              return (
                <div
                  key={item.id}
                  className="bg-[#0C0D14] border border-white/5 hover:border-white/10 rounded-xl p-3 space-y-2 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-black text-white">
                        {item.net_amount.toFixed(2)} E-FORCE
                      </span>
                      <span className="text-[10px] text-gray-500 line-through">
                        {item.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.onchain_verified && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ✓ Verified
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock size={10} /> Pending Admin
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={10} /> Paid
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          <XCircle size={10} /> Rejected (Refunded)
                        </span>
                      )}
                    </div>
                  </div>

                  {item.tx_hash && (
                    <div className="flex items-center gap-1 text-[11px] font-mono">
                      <span className="text-gray-400">Blockchain Tx:</span>
                      <a
                        href={`${NETWORKS[network].explorerUrl}/tx/${item.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>{item.tx_hash.slice(0, 10)}...{item.tx_hash.slice(-6)}</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <div className="flex items-center gap-1">
                      <span>To:</span>
                      <span className="text-gray-300">
                        {item.wallet_address.slice(0, 6)}...{item.wallet_address.slice(-4)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(item.wallet_address, item.id)}
                        className="text-gray-500 hover:text-brand-orange ml-0.5"
                      >
                        {copiedId === item.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <span className="text-gray-500 text-[10px]">
                      {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {item.admin_note && (
                    <div className="text-[10px] text-gray-400 bg-white/5 rounded px-2 py-1 mt-1 border border-white/5">
                      Note: {item.admin_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
