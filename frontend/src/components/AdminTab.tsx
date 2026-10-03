import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Plus, Trash2, Send, Users, 
  Coins, CheckSquare, Zap, Search, RefreshCw, 
  ArrowLeft, CheckCircle2, AlertTriangle, Radio, 
  ExternalLink, Ban, Sparkles, MessageSquare,
  Sliders, Wallet, Copy, Check, XCircle, Clock,
  Eye, EyeOff, Cpu, Play, TrendingUp, Gauge
} from 'lucide-react';
import { 
  getAdminStatsFirestore, 
  getAdminUsersFirestore, 
  getTasksFirestore, 
  adminCreateTaskFirestore, 
  adminDeleteTaskFirestore, 
  adminBanUserFirestore, 
  adminBoostUserFirestore, 
  adminBroadcastFirestore,
  getAppSettings,
  updateAppSettings,
  getAllWithdrawalsFirestore,
  adminUpdateWithdrawalStatusFirestore,
  clearAllUserDataFirestore
} from '../services/firestore';
import { 
  verifyWalletAndReferCodeOnChain, 
  executeAutoTokenPayout, 
  NETWORKS 
} from '../services/blockchain';
import { api } from '../services/api';
import type { AdminStats, Task, WithdrawalRequest } from '../types';

interface AdminTabProps {
  adminEmail?: string;
  onExit?: () => void;
  onSignOut?: () => void;
  onSettingsUpdated?: (settings: any) => void;
}

type AdminSection = 'overview' | 'withdrawals' | 'users' | 'tasks' | 'broadcast';

export const AdminTab: React.FC<AdminTabProps> = ({ adminEmail, onExit, onSignOut, onSettingsUpdated }) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalMinedTokens: 0,
    activeTasks: 0,
    completedTasks: 0,
    totalReferrals: 0,
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userList, setUserList] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawFilter, setWithdrawFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [withdrawSearch, setWithdrawSearch] = useState('');
  const [copiedWdAddressId, setCopiedWdAddressId] = useState<string | null>(null);
  const [processingWdId, setProcessingWdId] = useState<string | null>(null);

  // Withdrawal Config Settings
  const [withdrawFeePercent, setWithdrawFeePercent] = useState<number>(5);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState<number>(50);
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean>(true);
  const [bep20ContractAddress, setBep20ContractAddress] = useState<string>('0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90');
  const [blockchainNetwork, setBlockchainNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [autoApproveEnabled, setAutoApproveEnabled] = useState<boolean>(true);
  const [scanReferCodeOnchain, setScanReferCodeOnchain] = useState<boolean>(true);
  const [payoutPrivateKey, setPayoutPrivateKey] = useState<string>('');
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [savingWithdrawConfig, setSavingWithdrawConfig] = useState(false);
  const [withdrawConfigSaved, setWithdrawConfigSaved] = useState(false);
  const [batchScanning, setBatchScanning] = useState<boolean>(false);
  const [batchScanMessage, setBatchScanMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Task creation state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskReward, setTaskReward] = useState('25');
  const [taskSpeed, setTaskSpeed] = useState('0.10');
  const [taskType, setTaskType] = useState<'standard' | 'special'>('standard');
  const [taskAction, setTaskAction] = useState<'link' | 'telegram' | 'ad'>('link');
  const [taskLink, setTaskLink] = useState('');
  const [taskAdRequired, setTaskAdRequired] = useState(false);
  const [taskWaitTime] = useState('10');

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{ sent: number; total: number } | null>(null);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // App Settings / Monetag state
  const [monetagZoneId, setMonetagZoneId] = useState('11941636');
  const [monetagEnabled, setMonetagEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Mining Engine Protocol Settings
  const [baseMiningRate, setBaseMiningRate] = useState<number>(0.5);
  const [referralSpeedBoost, setReferralSpeedBoost] = useState<number>(0.05);
  const [referralCoinBonus, setReferralCoinBonus] = useState<number>(10.0);
  const [sessionDurationHours, setSessionDurationHours] = useState<number>(24);
  const [savingMiningSettings, setSavingMiningSettings] = useState(false);
  const [miningSettingsSaved, setMiningSettingsSaved] = useState(false);

  // Clear All User Data state
  const [clearingData, setClearingData] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  // Load all live data from Cloud Firestore
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, tasksData, usersData, appSettings, withdrawalsData] = await Promise.all([
        getAdminStatsFirestore(),
        getTasksFirestore(0),
        getAdminUsersFirestore(searchQuery),
        getAppSettings(),
        getAllWithdrawalsFirestore().catch(() => [])
      ]);

      setStats(statsData);
      setTasks([...tasksData.standard, ...tasksData.special]);
      setUserList(usersData);
      setWithdrawals(withdrawalsData);
      setMonetagZoneId(appSettings.monetag_zone_id || '11941636');
      setMonetagEnabled(appSettings.monetag_enabled !== false);
      setWithdrawFeePercent(appSettings.withdraw_fee_percent !== undefined ? appSettings.withdraw_fee_percent : 5);
      setMinWithdrawAmount(appSettings.min_withdraw_amount !== undefined ? appSettings.min_withdraw_amount : 50);
      setWithdrawEnabled(appSettings.withdraw_enabled !== false);
      setBep20ContractAddress(appSettings.bep20_contract_address || '0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90');
      setBlockchainNetwork(appSettings.blockchain_network || 'testnet');
      setAutoApproveEnabled(appSettings.auto_approve_enabled !== false);
      setScanReferCodeOnchain(appSettings.scan_refer_code_onchain !== false);
      setPayoutPrivateKey(appSettings.payout_private_key || '');

      setBaseMiningRate(appSettings.base_mining_rate !== undefined ? appSettings.base_mining_rate : 0.5);
      setReferralSpeedBoost(appSettings.referral_speed_boost !== undefined ? appSettings.referral_speed_boost : 0.05);
      setReferralCoinBonus(appSettings.referral_coin_bonus !== undefined ? appSettings.referral_coin_bonus : 10.0);
      setSessionDurationHours(appSettings.session_duration_hours !== undefined ? appSettings.session_duration_hours : 24);
    } catch (err: any) {
      console.warn('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMiningSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMiningSettings(true);
    try {
      const updated = {
        base_mining_rate: Number(baseMiningRate),
        referral_speed_boost: Number(referralSpeedBoost),
        referral_coin_bonus: Number(referralCoinBonus),
        session_duration_hours: Number(sessionDurationHours)
      };
      await updateAppSettings(updated);
      setMiningSettingsSaved(true);
      if (onSettingsUpdated) {
        onSettingsUpdated(await getAppSettings());
      }
      setTimeout(() => setMiningSettingsSaved(false), 3000);
    } catch (err: any) {
      alert('Error saving mining settings: ' + err.message);
    } finally {
      setSavingMiningSettings(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateAppSettings({
        monetag_zone_id: monetagZoneId.trim() || '11941636',
        monetag_enabled: monetagEnabled
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.warn('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveWithdrawConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWithdrawConfig(true);
    try {
      await updateAppSettings({
        withdraw_fee_percent: Number(withdrawFeePercent),
        min_withdraw_amount: Number(minWithdrawAmount),
        withdraw_enabled: withdrawEnabled,
        bep20_contract_address: bep20ContractAddress.trim() || '0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90',
        blockchain_network: blockchainNetwork,
        auto_approve_enabled: autoApproveEnabled,
        scan_refer_code_onchain: scanReferCodeOnchain,
        payout_private_key: payoutPrivateKey.trim()
      });
      setWithdrawConfigSaved(true);
      setTimeout(() => setWithdrawConfigSaved(false), 3000);
    } catch (err: any) {
      alert('Error saving withdrawal settings: ' + err.message);
    } finally {
      setSavingWithdrawConfig(false);
    }
  };

  // Run on-chain verification for a single request
  const handleVerifySingleOnChain = async (wd: WithdrawalRequest) => {
    setProcessingWdId(wd.id);
    try {
      const res = await verifyWalletAndReferCodeOnChain({
        walletAddress: wd.wallet_address,
        referCode: wd.refer_code,
        contractAddress: bep20ContractAddress,
        network: blockchainNetwork
      });

      alert(`Blockchain Verification Result for ${wd.user_name}:\n\nStatus: ${res.verified ? 'VERIFIED ✓' : 'NOT VERIFIED'}\nScore: ${res.score}%\nDetails: ${res.details}`);
      
      // Update in firestore
      await adminUpdateWithdrawalStatusFirestore(wd.id, wd.status, res.details);
      const updated = await getAllWithdrawalsFirestore();
      setWithdrawals(updated);
    } catch (err: any) {
      alert('Verification error: ' + err.message);
    } finally {
      setProcessingWdId(null);
    }
  };

  // Batch scan all pending withdrawals on-chain
  const handleBatchBlockchainScan = async () => {
    const pendingList = withdrawals.filter(w => w.status === 'pending');
    if (pendingList.length === 0) {
      alert('No pending withdrawal requests to scan on the blockchain.');
      return;
    }

    setBatchScanning(true);
    setBatchScanMessage(`Scanning ${pendingList.length} pending addresses on ${NETWORKS[blockchainNetwork].name}...`);

    let verifiedCount = 0;
    try {
      for (let i = 0; i < pendingList.length; i++) {
        const item = pendingList[i];
        setBatchScanMessage(`Scanning (${i + 1}/${pendingList.length}): ${item.wallet_address.slice(0, 10)}...`);

        const res = await verifyWalletAndReferCodeOnChain({
          walletAddress: item.wallet_address,
          referCode: item.refer_code,
          contractAddress: bep20ContractAddress,
          network: blockchainNetwork
        });

        if (res.verified) {
          verifiedCount++;
        }

        await adminUpdateWithdrawalStatusFirestore(item.id, item.status, res.details);
      }

      const updated = await getAllWithdrawalsFirestore();
      setWithdrawals(updated);
      setBatchScanMessage(`Completed! Verified ${verifiedCount} of ${pendingList.length} addresses on-chain.`);
      setTimeout(() => setBatchScanMessage(null), 4000);
    } catch (e: any) {
      setBatchScanMessage(`Scan error: ${e.message}`);
    } finally {
      setBatchScanning(false);
    }
  };

  // Auto-Payout single request on-chain via Hot Wallet
  const handleAutoPayoutSingle = async (wd: WithdrawalRequest) => {
    if (!payoutPrivateKey) {
      const key = prompt('Enter your Payout Hot Wallet Private Key to dispatch on-chain transaction:');
      if (!key) return;
      setPayoutPrivateKey(key);
    }

    if (!confirm(`Execute REAL on-chain transfer of ${wd.net_amount.toFixed(2)} tokens to ${wd.wallet_address} on ${NETWORKS[blockchainNetwork].name}?`)) {
      return;
    }

    setProcessingWdId(wd.id);
    try {
      const res = await executeAutoTokenPayout({
        privateKey: payoutPrivateKey,
        tokenAddress: bep20ContractAddress,
        recipientAddress: wd.wallet_address,
        amount: wd.net_amount,
        network: blockchainNetwork
      });

      alert(`Transaction Confirmed on BSC!\n\nTx Hash: ${res.txHash}\nExplorer: ${res.explorerUrl}`);

      // Mark completed in firestore with real Tx Hash
      await adminUpdateWithdrawalStatusFirestore(wd.id, 'completed', `Auto-paid on-chain: ${res.txHash}`);
      
      // Notify user via Telegram Bot
      api.notifyWithdrawalStatus({
        userId: wd.user_id,
        status: 'completed',
        amount: wd.amount,
        netAmount: wd.net_amount,
        walletAddress: wd.wallet_address,
        txHash: res.txHash,
        adminNote: `Auto-paid on-chain: ${res.txHash}`
      }).catch(() => {});

      const updated = await getAllWithdrawalsFirestore();
      setWithdrawals(updated);
    } catch (err: any) {
      alert('On-chain payout failed: ' + err.message);
    } finally {
      setProcessingWdId(null);
    }
  };

  const handleApproveWithdrawal = async (wd: WithdrawalRequest) => {
    if (!confirm(`Confirm payout of ${wd.net_amount.toFixed(2)} E-FORCE to BEP20 address ${wd.wallet_address}?`)) {
      return;
    }
    setProcessingWdId(wd.id);
    try {
      await adminUpdateWithdrawalStatusFirestore(wd.id, 'completed');

      // Notify user via Telegram Bot
      api.notifyWithdrawalStatus({
        userId: wd.user_id,
        status: 'completed',
        amount: wd.amount,
        netAmount: wd.net_amount,
        walletAddress: wd.wallet_address
      }).catch(() => {});

      const updated = await getAllWithdrawalsFirestore();
      setWithdrawals(updated);
    } catch (err: any) {
      alert('Failed to approve withdrawal: ' + err.message);
    } finally {
      setProcessingWdId(null);
    }
  };

  const handleRejectWithdrawal = async (wd: WithdrawalRequest) => {
    const reason = prompt(
      `Reject withdrawal #${wd.id}?\n\nThis will automatically REFUND ${wd.amount} E-FORCE back to ${wd.user_name}'s balance.\nEnter reason (optional):`,
      'Invalid BEP20 address or unverified user'
    );
    if (reason === null) return;

    setProcessingWdId(wd.id);
    try {
      await adminUpdateWithdrawalStatusFirestore(wd.id, 'rejected', reason);

      // Notify user via Telegram Bot
      api.notifyWithdrawalStatus({
        userId: wd.user_id,
        status: 'rejected',
        amount: wd.amount,
        netAmount: wd.net_amount,
        walletAddress: wd.wallet_address,
        adminNote: reason
      }).catch(() => {});

      const [updatedWd, updatedUsers] = await Promise.all([
        getAllWithdrawalsFirestore(),
        getAdminUsersFirestore(searchQuery)
      ]);
      setWithdrawals(updatedWd);
      setUserList(updatedUsers);
      alert(`Withdrawal rejected. ${wd.amount} E-FORCE has been refunded to ${wd.user_name}.`);
    } catch (err: any) {
      alert('Failed to reject withdrawal: ' + err.message);
    } finally {
      setProcessingWdId(null);
    }
  };

  const copyWdAddress = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedWdAddressId(id);
    setTimeout(() => setCopiedWdAddressId(null), 2000);
  };

  const handleClearAllUserData = async () => {
    if (confirmInput.trim().toUpperCase() !== 'RESET') {
      alert("Please type 'RESET' in uppercase to confirm.");
      return;
    }

    setClearingData(true);
    try {
      // 1. Wipe Cloud Firestore
      await clearAllUserDataFirestore();

      // 2. Wipe Backend Database (SQLite / Postgres)
      await api.admin.clearAllUserData().catch(() => {});

      // 3. Clear local storage user caches
      try {
        localStorage.removeItem('eforce_user_profile');
        localStorage.removeItem('eforce_mining_cache');
      } catch (_) {}

      // 4. Reload fresh admin dashboard
      await loadData();

      setShowClearModal(false);
      setConfirmInput('');
      alert('All user data has been permanently cleared! (Users, mining sessions, completed tasks, referrals & withdrawals have been wiped clean).');
    } catch (err: any) {
      alert('Error clearing user data: ' + err.message);
    } finally {
      setClearingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const users = await getAdminUsersFirestore(searchQuery);
      setUserList(users);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;

    try {
      await adminCreateTaskFirestore({
        title: taskTitle,
        description: taskDesc,
        reward_coins: parseFloat(taskReward) || 10,
        speed_boost: parseFloat(taskSpeed) || 0.05,
        task_type: taskType,
        action_type: taskAction,
        link: taskLink,
        ad_required: taskAdRequired,
        wait_time_sec: parseInt(taskWaitTime, 10) || 10,
      });

      setIsCreatingTask(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskLink('');
      await loadData();
      alert('Task created successfully in Cloud Firestore!');
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`);
    }
  };

  const handleDeleteTask = async (taskId: number | string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await adminDeleteTaskFirestore(taskId);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleBan = async (user: any) => {
    const action = user.is_banned ? 'Unban' : 'Ban';
    if (!confirm(`Are you sure you want to ${action} user ${user.first_name || user.id}?`)) return;
    try {
      await adminBanUserFirestore(user.id, !user.is_banned);
      const updated = await getAdminUsersFirestore(searchQuery);
      setUserList(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBoostUser = async (user: any) => {
    const boostInput = prompt(`Enter Speed Boost to add for ${user.first_name || user.id} (e.g. 0.50):`, '0.25');
    if (!boostInput) return;
    const addSpeed = parseFloat(boostInput);
    if (isNaN(addSpeed)) return;

    const coinsInput = prompt('Bonus coins to credit (e.g. 50):', '0');
    const addCoins = parseFloat(coinsInput || '0') || 0;

    try {
      await adminBoostUserFirestore(user.id, addSpeed, addCoins);
      alert(`Successfully boosted ${user.first_name || user.id}!`);
      const updated = await getAdminUsersFirestore(searchQuery);
      setUserList(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    if (!confirm(`Blast this Telegram message to all registered users via @Elite_Force_Official_Mining_bot?`)) {
      return;
    }

    setBroadcasting(true);
    setBroadcastResult(null);
    setBroadcastProgress({ sent: 0, total: userList.length || 1 });

    try {
      const res = await adminBroadcastFirestore(
        broadcastMsg, 
        photoUrl, 
        (sent, total) => setBroadcastProgress({ sent, total })
      );
      setBroadcastResult(`Broadcast Finished! Successfully sent to ${res.sent} miners (${res.failed} failed/blocked).`);
      setBroadcastMsg('');
      setPhotoUrl('');
    } catch (err: any) {
      setBroadcastResult(`Broadcast failed: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#08080C] text-white">
      {/* Top Desktop Navigation Bar */}
      <header className="sticky top-0 z-30 w-full bg-[#0F1018]/90 backdrop-blur-md border-b border-orange-500/20 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-orange to-orange-400 p-0.5 shadow-orange-glow flex items-center justify-center">
            <ShieldAlert size={22} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">E-FORCE COMMAND CENTER</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brand-orange text-black">
                ADMIN
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Live Cloud Firestore
              </span>
              <span>•</span>
              <span className="text-orange-400 font-mono">@Elite_Force_Official_Mining_bot</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {adminEmail && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-[11px] text-orange-200">{adminEmail}</span>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-brand-orange' : ''} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>

          <button
            type="button"
            onClick={() => { setConfirmInput(''); setShowClearModal(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-400 hover:text-red-300 transition-all cursor-pointer shadow-sm"
            title="Erase all users, balances, mining data and withdrawals"
          >
            <Trash2 size={14} />
            <span className="hidden md:inline">Clear All User Data</span>
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-xs font-bold text-orange-300 transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back to App</span>
            </button>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-300 transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* Navigation Tabs Bar for Desktop */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-3 overflow-x-auto">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: Zap },
            { 
              id: 'withdrawals', 
              label: `Withdrawals (${withdrawals.filter(w => w.status === 'pending').length > 0 ? `${withdrawals.filter(w => w.status === 'pending').length} Pending` : withdrawals.length})`, 
              icon: Wallet 
            },
            { id: 'users', label: `Users (${stats.totalUsers})`, icon: Users },
            { id: 'tasks', label: `Task Manager (${tasks.length})`, icon: CheckSquare },
            { id: 'broadcast', label: 'Telegram Broadcast', icon: Send }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as AdminSection)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-orange to-orange-500 text-white shadow-orange-glow font-extrabold'
                    : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* SECTION 1: OVERVIEW & KEY METRICS */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* 5 Big KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Miners</span>
                  <div className="p-2 rounded-xl bg-orange-500/10 text-brand-orange">
                    <Users size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {stats.totalUsers.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>Synced in Cloud Firestore</span>
                </div>
              </div>

              <div className="glass-panel-orange p-5 rounded-2xl border border-orange-500/30">
                <div className="flex items-center justify-between text-orange-300 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Mined Yield Total</span>
                  <div className="p-2 rounded-xl bg-white/10 text-yellow-300">
                    <Coins size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-brand-orange fire-text-gradient">
                  {stats.totalMinedTokens.toFixed(2)}
                </div>
                <div className="text-[11px] text-orange-200/70 mt-1">E-FORCE Distributed in Network</div>
              </div>

              {/* Withdrawals KPI Card */}
              <div 
                onClick={() => setActiveSection('withdrawals')}
                className="glass-panel p-5 rounded-2xl border border-amber-500/30 hover:border-amber-500 cursor-pointer transition-all bg-gradient-to-b from-amber-500/10 to-transparent"
              >
                <div className="flex items-center justify-between text-amber-300 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Pending Withdrawals</span>
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Wallet size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-amber-400">
                  {withdrawals.filter(w => w.status === 'pending').length}
                </div>
                <div className="text-[11px] text-gray-300 mt-1 flex items-center justify-between">
                  <span>Queued: <strong>{withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.net_amount, 0).toFixed(2)}</strong></span>
                  <span className="text-brand-orange underline text-[10px]">Review →</span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Tasks</span>
                  <div className="p-2 rounded-xl bg-white/10 text-orange-400">
                    <CheckSquare size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {stats.activeTasks}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">{stats.completedTasks} completions logged</div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Referral Network</span>
                  <div className="p-2 rounded-xl bg-white/10 text-purple-400">
                    <Sparkles size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {stats.totalReferrals}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">Direct user peer invites</div>
              </div>
            </div>

            {/* Quick Actions & System Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Radio size={18} className="text-brand-orange" />
                  Live Platform Status
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400">Database Engine:</span>
                    <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">Google Cloud Firestore</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400">Telegram Bot Handle:</span>
                    <a 
                      href="https://t.me/Elite_Force_Official_Mining_bot" 
                      target="_blank" 
                      rel="noreferrer"
                      className="font-mono text-orange-400 hover:underline flex items-center gap-1"
                    >
                      @Elite_Force_Official_Mining_bot
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400">Ad Monetization Engine:</span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-300">
                      {monetagEnabled 
                        ? `Monetag Official Ads (Zone: ${monetagZoneId || '11941636'})` 
                        : 'Native In-App Cyber Video (Safe & 100% Active)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">Live Web App:</span>
                    <a 
                      href="https://e-force-bot.web.app" 
                      target="_blank" 
                      rel="noreferrer"
                      className="font-mono text-blue-400 hover:underline flex items-center gap-1"
                    >
                      https://e-force-bot.web.app
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    <Send size={18} className="text-brand-orange" />
                    Quick Broadcast Dispatcher
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Send an instantaneous announcement, promo or mining booster alert to all miners directly via the Telegram Bot API.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('broadcast')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-extrabold text-sm tracking-wide shadow-orange-glow hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  <span>Open Telegram Bot Broadcast Studio</span>
                </button>
              </div>
            </div>

            {/* Mining Engine & Yield Power Breakdown Protocol Configuration Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-orange-500/30 shadow-orange-glow mt-6 bg-gradient-to-b from-orange-500/5 via-transparent to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Gauge size={19} className="text-brand-orange" />
                    <span>Mining Engine & Yield Rate Protocol Configuration</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Control live mining engine rates, referral speed boosters, bonus tokens, and session cycle hours across the mini-app.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1.5">
                    <Zap size={13} className="text-brand-orange fill-brand-orange" />
                    <span>Active Protocol: {(Number(baseMiningRate) || 0.5).toFixed(2)}/hr Base</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Form Inputs (Left) */}
                <form onSubmit={handleSaveMiningSettings} className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Base Mining Rate */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <label className="text-xs text-gray-300 font-bold block flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-brand-orange" />
                        <span>Base 24H Rate (E-FORCE/hr)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={baseMiningRate}
                        onChange={(e) => setBaseMiningRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-orange font-mono font-bold"
                        required
                      />
                      <p className="text-[11px] text-gray-400">
                        Default mining speed given to every new miner before boosters.
                      </p>
                    </div>

                    {/* Referral Speed Boost */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <label className="text-xs text-gray-300 font-bold block flex items-center gap-1.5">
                        <Zap size={14} className="text-yellow-400" />
                        <span>Referral Boost (+E-FORCE/hr)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={referralSpeedBoost}
                        onChange={(e) => setReferralSpeedBoost(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-orange font-mono font-bold"
                        required
                      />
                      <p className="text-[11px] text-gray-400">
                        Permanent hourly speed boost added per invited friend.
                      </p>
                    </div>

                    {/* Referral Welcome / Sign-up Coin Bonus */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <label className="text-xs text-gray-300 font-bold block flex items-center gap-1.5">
                        <Coins size={14} className="text-yellow-300" />
                        <span>Referral Bonus (E-FORCE coins)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={referralCoinBonus}
                        onChange={(e) => setReferralCoinBonus(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-orange font-mono font-bold"
                        required
                      />
                      <p className="text-[11px] text-gray-400">
                        Instant token bounty credited to referrer when a friend joins.
                      </p>
                    </div>

                    {/* Mining Session Duration */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <label className="text-xs text-gray-300 font-bold block flex items-center gap-1.5">
                        <Clock size={14} className="text-cyan-400" />
                        <span>Session Duration (Hours)</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="168"
                        value={sessionDurationHours}
                        onChange={(e) => setSessionDurationHours(parseInt(e.target.value) || 24)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-orange font-mono font-bold"
                        required
                      />
                      <p className="text-[11px] text-gray-400">
                        Hours per mining cycle before user must claim yield (Default: 24).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingMiningSettings}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-black text-xs tracking-wider uppercase shadow-orange-glow hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {savingMiningSettings ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      <span>Save Mining Engine Settings</span>
                    </button>

                    {miningSettingsSaved && (
                      <span className="text-xs font-bold text-green-400 flex items-center gap-1.5 animate-pulse">
                        <CheckCircle2 size={15} /> Saved & Applied Live in Firestore!
                      </span>
                    )}
                  </div>
                </form>

                {/* Live Preview Card (Right) */}
                <div className="lg:col-span-5 bg-black/60 border border-orange-500/30 rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                      Live User Interface Preview
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      MiningTab.tsx
                    </span>
                  </div>

                  {/* Exact Visual Replication of Engine Power Breakdown */}
                  <div className="glass-panel p-3.5 rounded-xl border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={15} className="text-brand-orange" />
                        <h4 className="text-xs font-bold text-white">Engine Power Breakdown</h4>
                      </div>
                      <span className="text-xs font-mono font-bold text-orange-400">
                        {(Number(baseMiningRate) || 0.5).toFixed(2)} /hr
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-400 text-[11px]">
                        <span>Base {sessionDurationHours}H Rate:</span>
                        <span className="text-white font-medium">
                          {(Number(baseMiningRate) || 0.5).toFixed(2)} E-FORCE/hr
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-[11px]">
                        <span>Tasks Completed Boost:</span>
                        <span className="text-orange-400 font-medium">+0.00/hr</span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-[11px]">
                        <span>Referrals Boost (0 friends):</span>
                        <span className="text-green-400 font-medium">+0.00/hr</span>
                      </div>
                    </div>

                    {/* Buttons in Preview */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <div className="py-2 px-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-[10px] font-black text-white text-center flex items-center justify-center gap-1">
                        <Play size={10} className="text-brand-orange fill-brand-orange" />
                        <span>Watch Ads & Boost</span>
                      </div>
                      <div className="py-2 px-2 rounded-lg bg-white/10 border border-white/15 text-[10px] font-bold text-white text-center flex items-center justify-center">
                        <span>Invite Friends (+{(Number(referralSpeedBoost) || 0.05).toFixed(2)})</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[11px] text-gray-300">
                    <span className="font-bold text-orange-400">💡 Instant propagation:</span> All changes saved here update in Firestore <code className="text-orange-300 font-mono">settings/config</code> and reflect on all user devices immediately.
                  </div>
                </div>
              </div>
            </div>

            {/* Ad Monetization & Monetag Configuration Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders size={18} className="text-brand-orange" />
                    Monetag Ad Network Configuration
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Powered by Monetag (libtl.com) for Telegram Mini App rewarded & in-app interstitial ads.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                    monetagEnabled
                      ? 'bg-green-500/10 text-green-300 border border-green-500/30'
                      : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    {monetagEnabled
                      ? `Monetag Live (Zone: ${monetagZoneId || '11941636'})`
                      : 'Native Katana Video Ad Player (Active)'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">
                      Monetag Zone ID (from Monetag / libtl.com)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 11941636"
                      value={monetagZoneId}
                      onChange={(e) => setMonetagZoneId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Script: <code className="text-orange-400">https://libtl.com/sdk.js (Zone: {monetagZoneId || '11941636'})</code>
                    </p>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                      <input
                        type="checkbox"
                        checked={monetagEnabled}
                        onChange={(e) => setMonetagEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 accent-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">Enable Monetag Official Ads (show_11941636)</span>
                        <span className="text-[11px] text-gray-400 block">
                          When checked, user clicks trigger Monetag Rewarded Interstitial/Popup. If blocked or unavailable, falls back to native 3D Katana player.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-extrabold text-xs shadow-orange-glow hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    {savingSettings ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>Save Monetag Configuration</span>
                  </button>

                  {settingsSaved && (
                    <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                      <CheckCircle2 size={14} /> Saved & Applied Live!
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Withdrawal System & Blockchain Protocol Settings Panel in Overview */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Wallet size={18} className="text-brand-orange" />
                    BEP20 Blockchain & Auto-Payout Protocol Settings
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Configure the on-chain contract address, network, refer code scanner, and automated hot wallet payout rules.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                    withdrawEnabled
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-300 border border-red-500/30'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    {withdrawEnabled ? 'Withdrawals Active' : 'Withdrawals Paused'}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                    {blockchainNetwork === 'testnet' ? 'BSC Testnet (Chain 97)' : 'BSC Mainnet (Chain 56)'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveWithdrawConfig} className="space-y-4">
                {/* Row 1: Token Contract Address & Network */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-300 font-semibold flex items-center gap-1">
                        <span>BEP-20 Token / Vault Contract Address (Dynamic)</span>
                        <span className="text-brand-orange">*</span>
                      </label>
                      <a
                        href={`${NETWORKS[blockchainNetwork].explorerUrl}/address/${bep20ContractAddress}#tokentxns`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-orange-400 hover:underline flex items-center gap-1"
                      >
                        <span>View on BscScan</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    <input
                      type="text"
                      placeholder="0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90"
                      value={bep20ContractAddress}
                      onChange={(e) => setBep20ContractAddress(e.target.value.trim())}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-brand-orange"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      All user withdrawals and on-chain verification will dynamically route to this contract or payout address.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">
                      Blockchain Network
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBlockchainNetwork('testnet')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          blockchainNetwork === 'testnet'
                            ? 'bg-brand-orange text-black border-brand-orange shadow-orange-glow'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        BSC Testnet (97)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockchainNetwork('mainnet')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          blockchainNetwork === 'mainnet'
                            ? 'bg-brand-orange text-black border-brand-orange shadow-orange-glow'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        BSC Mainnet (56)
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      RPC: {NETWORKS[blockchainNetwork].rpcUrl}
                    </p>
                  </div>
                </div>

                {/* Row 2: Fee, Min Limit, and User Withdrawal Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">
                      Admin Withdrawal Fee Percentage (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={withdrawFeePercent}
                        onChange={(e) => setWithdrawFeePercent(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-brand-orange pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-orange">%</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Deducted automatically from requested user payout amount.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">
                      Minimum Withdrawal Limit (E-FORCE)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={minWithdrawAmount}
                        onChange={(e) => setMinWithdrawAmount(parseFloat(e.target.value) || 1)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-brand-orange pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-orange">E-FORCE</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Miners must hold at least this amount to initiate a withdrawal.
                    </p>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                      <input
                        type="checkbox"
                        checked={withdrawEnabled}
                        onChange={(e) => setWithdrawEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 accent-orange-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">Enable User Withdrawals</span>
                        <span className="text-[11px] text-gray-400 block">
                          Uncheck to temporarily pause new withdrawal submissions.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Row 3: Auto-Approve & On-Chain Scanning Rules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                    <input
                      type="checkbox"
                      checked={autoApproveEnabled}
                      onChange={(e) => setAutoApproveEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 accent-orange-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block flex items-center gap-1.5">
                        <Cpu size={14} className="text-brand-orange" />
                        Automated On-Chain Approval Engine
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        When enabled, valid requests are checked against the BSC blockchain RPC and approved automatically without manual review.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                    <input
                      type="checkbox"
                      checked={scanReferCodeOnchain}
                      onChange={(e) => setScanReferCodeOnchain(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 accent-orange-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block flex items-center gap-1.5">
                        <Zap size={14} className="text-amber-400" />
                        On-Chain Refer Code & Wallet Scanner
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        Scans BSC blocks to verify user's wallet activity and 6-digit refer code before processing payout.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Row 4: Optional Hot Wallet Private Key for Automated Dispensing */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-300 font-semibold flex items-center gap-1">
                      <span>Hot Wallet Private Key for Automated On-Chain Payouts (Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {showPrivateKey ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showPrivateKey ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showPrivateKey ? 'text' : 'password'}
                    placeholder="Enter private key (0x...) to enable 1-click batch automated payouts directly to BSC"
                    value={payoutPrivateKey}
                    onChange={(e) => setPayoutPrivateKey(e.target.value.trim())}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-orange"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    If configured, the admin can dispatch REAL on-chain transfers with 1-click or let the system auto-payout.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingWithdrawConfig}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-extrabold text-xs shadow-orange-glow hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    {savingWithdrawConfig ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>Save Blockchain & Withdrawal Settings</span>
                  </button>

                  {withdrawConfigSaved && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={14} /> Saved & Applied Live to Blockchain Router!
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Danger Zone: Database & User Wipe */}
            <div className="glass-panel p-6 rounded-2xl border border-red-500/30 bg-red-950/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-400" />
                    Danger Zone: Clear All User Data
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-xl">
                    Permanently wipe all registered miner accounts, balances, active & completed mining sessions, completed tasks, referrals, and withdrawals. Tasks and app settings will remain completely safe.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setConfirmInput(''); setShowClearModal(true); }}
                  className="px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-extrabold text-xs transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer shadow-sm shadow-red-500/10"
                >
                  <Trash2 size={15} />
                  <span>Clear All User Data</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: WITHDRAWAL REQUESTS MANAGEMENT */}
        {activeSection === 'withdrawals' && (
          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet size={20} className="text-brand-orange" />
                  BEP20 Withdrawal Requests Queue ({withdrawals.length})
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Process miner payouts directly to BNB Smart Chain addresses. Rejecting automatically refunds the tokens.
                </p>
              </div>

              {/* Quick Summary Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                  <Clock size={13} />
                  <span>Pending: {withdrawals.filter(w => w.status === 'pending').length} ({withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.net_amount, 0).toFixed(2)} E-FORCE)</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  <span>Paid: {withdrawals.filter(w => w.status === 'completed').reduce((s, w) => s + w.net_amount, 0).toFixed(2)} E-FORCE</span>
                </div>
              </div>
            </div>

            {/* Filter, Search, and Blockchain Actions Bar */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {[
                    { id: 'all', label: `All (${withdrawals.length})` },
                    { id: 'pending', label: `Pending (${withdrawals.filter(w => w.status === 'pending').length})` },
                    { id: 'completed', label: `Paid (${withdrawals.filter(w => w.status === 'completed').length})` },
                    { id: 'rejected', label: `Rejected (${withdrawals.filter(w => w.status === 'rejected').length})` }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setWithdrawFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        withdrawFilter === f.id
                          ? 'bg-brand-orange text-black font-extrabold shadow-orange-glow'
                          : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search wallet, code, ID or name..."
                    value={withdrawSearch}
                    onChange={(e) => setWithdrawSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              {/* Blockchain Batch Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={batchScanning}
                    onClick={handleBatchBlockchainScan}
                    className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Cpu size={14} className={batchScanning ? 'animate-spin' : ''} />
                    <span>Scan Pending on Blockchain</span>
                  </button>

                  <a
                    href={`${NETWORKS[blockchainNetwork].explorerUrl}/address/${bep20ContractAddress}#tokentxns`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <span>Inspect Token Contract</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {batchScanMessage && (
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 animate-pulse">
                    <CheckCircle2 size={13} />
                    <span>{batchScanMessage}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Withdrawals List Table */}
            {(() => {
              const filtered = withdrawals
                .filter(w => {
                  if (withdrawFilter === 'all') return true;
                  return w.status === withdrawFilter;
                })
                .filter(w => {
                  if (!withdrawSearch.trim()) return true;
                  const q = withdrawSearch.toLowerCase();
                  return (
                    w.wallet_address.toLowerCase().includes(q) ||
                    w.refer_code.toLowerCase().includes(q) ||
                    String(w.user_id).includes(q) ||
                    w.user_name.toLowerCase().includes(q) ||
                    (w.username && w.username.toLowerCase().includes(q))
                  );
                });

              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center text-gray-500 space-y-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <Wallet size={36} className="mx-auto opacity-30" />
                    <p className="text-sm font-semibold">No withdrawal requests found</p>
                    <p className="text-xs text-gray-600">Matching the selected filter or search query</p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        <th className="py-3 px-4">Miner</th>
                        <th className="py-3 px-4">BEP20 Wallet Address</th>
                        <th className="py-3 px-4 text-center">Refer Code (6D)</th>
                        <th className="py-3 px-4 text-right">Requested</th>
                        <th className="py-3 px-4 text-right">Fee ({withdrawFeePercent}%)</th>
                        <th className="py-3 px-4 text-right">Net Payout</th>
                        <th className="py-3 px-4 text-center">Status / Tx</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {filtered.map(wd => {
                        const isPending = wd.status === 'pending';
                        const isCompleted = wd.status === 'completed';
                        const isRejected = wd.status === 'rejected';
                        const isProcessing = processingWdId === wd.id;

                        return (
                          <tr key={wd.id} className="hover:bg-white/[0.02] transition-colors">
                            {/* Miner Info */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{wd.user_name}</span>
                                {wd.username && (
                                  <span className="text-[10px] text-gray-400 font-normal">@{wd.username}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                ID: {wd.user_id} • {new Date(wd.created_at).toLocaleDateString()} {new Date(wd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>

                            {/* Wallet Address & On-Chain Badge */}
                            <td className="py-3 px-4 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                                  {wd.wallet_address.slice(0, 8)}...{wd.wallet_address.slice(-6)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyWdAddress(wd.wallet_address, wd.id)}
                                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                  title="Copy Full Address"
                                >
                                  {copiedWdAddressId === wd.id ? (
                                    <Check size={12} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                                <a
                                  href={`${NETWORKS[blockchainNetwork].explorerUrl}/address/${wd.wallet_address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-brand-orange transition-all"
                                  title="View on BscScan"
                                >
                                  <ExternalLink size={12} />
                                </a>

                                {wd.onchain_verified && (
                                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    BSC Verified
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-gray-500 mt-0.5 truncate max-w-[200px]" title={wd.wallet_address}>
                                {wd.wallet_address}
                              </div>
                            </td>

                            {/* 6-Digit Refer Code */}
                            <td className="py-3 px-4 text-center">
                              <span className="font-mono text-xs font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                {wd.refer_code}
                              </span>
                            </td>

                            {/* Gross Amount */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-gray-300">
                              {wd.amount.toFixed(2)}
                            </td>

                            {/* Fee */}
                            <td className="py-3 px-4 text-right font-mono text-amber-400 text-[11px]">
                              -{wd.fee_amount.toFixed(2)} ({wd.fee_percent}%)
                            </td>

                            {/* Net Payout */}
                            <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                              {wd.net_amount.toFixed(2)}
                              <span className="text-[10px] text-gray-400 font-normal ml-1">E-FORCE</span>
                            </td>

                            {/* Status & Tx Hash Link */}
                            <td className="py-3 px-4 text-center">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Clock size={10} /> Pending
                                </span>
                              )}
                              {isCompleted && (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 size={10} /> Paid
                                  </span>
                                  {wd.tx_hash && (
                                    <div className="mt-1">
                                      <a
                                        href={`${NETWORKS[blockchainNetwork].explorerUrl}/tx/${wd.tx_hash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] font-mono text-blue-400 hover:underline flex items-center justify-center gap-1"
                                      >
                                        <span>Tx: {wd.tx_hash.slice(0, 8)}...</span>
                                        <ExternalLink size={10} />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                              {isRejected && (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                    <XCircle size={10} /> Rejected
                                  </span>
                                  {wd.admin_note && (
                                    <div className="text-[9px] text-gray-400 mt-0.5 max-w-[120px] truncate" title={wd.admin_note}>
                                      {wd.admin_note}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-center">
                              {isPending ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleVerifySingleOnChain(wd)}
                                    className="p-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                    title="Scan wallet & refer code on BSC"
                                  >
                                    <Cpu size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleAutoPayoutSingle(wd)}
                                    className="px-2 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-brand-orange border border-orange-500/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                    title="Auto-Payout on BSC via Hot Wallet"
                                  >
                                    <Play size={10} />
                                    <span>Auto-Pay</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleApproveWithdrawal(wd)}
                                    className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                    title="Mark as Paid Manually"
                                  >
                                    <Check size={12} />
                                    <span>Paid</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleRejectWithdrawal(wd)}
                                    className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                    title="Reject and Refund E-FORCE to user"
                                  >
                                    <XCircle size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  {isCompleted ? 'Completed ✓' : 'Refunded'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* SECTION 3: USERS MANAGEMENT TABLE */}
        {activeSection === 'users' && (
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={20} className="text-brand-orange" />
                  Miners Directory ({userList.length})
                </h2>
                <p className="text-xs text-gray-400">Search, inspect balance, adjust mining speed or ban miners.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <form onSubmit={handleSearch} className="w-full sm:w-72 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by ID, username or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-brand-orange text-black font-extrabold text-xs hover:brightness-110 transition-all shrink-0 cursor-pointer"
                  >
                    Filter
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => { setConfirmInput(''); setShowClearModal(true); }}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold text-red-400 hover:text-red-300 transition-all shrink-0 cursor-pointer shadow-sm"
                  title="Wipe all miners and balances completely"
                >
                  <Trash2 size={14} />
                  <span>Clear All User Data</span>
                </button>
              </div>
            </div>

            {/* Desktop Responsive Table */}
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Telegram ID</th>
                    <th className="py-3 px-4">Balance</th>
                    <th className="py-3 px-4">Speed Rate</th>
                    <th className="py-3 px-4">Invited</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {userList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        No miners found in Cloud Firestore.
                      </td>
                    </tr>
                  ) : (
                    userList.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{u.first_name || 'Anonymous'}</div>
                          <div className="text-[11px] text-gray-400">@{u.username || 'no-handle'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-300">{u.id}</td>
                        <td className="py-3 px-4 font-mono font-bold text-brand-orange">
                          {Number(u.balance || 0).toFixed(4)} E-FORCE
                        </td>
                        <td className="py-3 px-4 font-mono text-orange-300">
                          +{Number(u.speed_per_hr || 0.5).toFixed(2)}/hr
                        </td>
                        <td className="py-3 px-4 font-mono text-purple-300">
                          {u.referral_count || 0} friends
                        </td>
                        <td className="py-3 px-4">
                          {u.is_banned ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              BANNED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleBoostUser(u)}
                              title="Boost Speed & Bonus"
                              className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-brand-orange border border-orange-500/30"
                            >
                              <Zap size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleBan(u)}
                              title={u.is_banned ? 'Unban User' : 'Ban User'}
                              className={`p-1.5 rounded-lg border ${
                                u.is_banned 
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                              }`}
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 3: TASK MANAGER */}
        {activeSection === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckSquare size={20} className="text-brand-orange" />
                  Task & Rewarded Mission Manager ({tasks.length})
                </h2>
                <p className="text-xs text-gray-400">Manage missions that reward users with E-FORCE tokens and permanent speed boosts.</p>
              </div>

              <button
                onClick={() => setIsCreatingTask(!isCreatingTask)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-orange text-black font-extrabold text-xs hover:brightness-110 shadow-orange-glow transition-all"
              >
                <Plus size={16} />
                <span>{isCreatingTask ? 'Close Form' : 'Create New Mission'}</span>
              </button>
            </div>

            {/* Task Creation Drawer Form */}
            {isCreatingTask && (
              <form onSubmit={handleCreateTask} className="glass-panel p-6 rounded-2xl border border-orange-500/40 space-y-4">
                <h3 className="text-sm font-bold text-orange-300 uppercase tracking-wider flex items-center gap-2">
                  <Plus size={16} />
                  New Mission Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">Task Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Subscribe to Announcement Channel"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">Target Link / URL</label>
                    <input
                      type="text"
                      placeholder="https://t.me/... or https://x.com/..."
                      value={taskLink}
                      onChange={(e) => setTaskLink(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">Reward E-FORCE Coins</label>
                    <input
                      type="number"
                      step="any"
                      value={taskReward}
                      onChange={(e) => setTaskReward(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">Mining Speed Boost (+/hr)</label>
                    <input
                      type="number"
                      step="any"
                      value={taskSpeed}
                      onChange={(e) => setTaskSpeed(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">Section</label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value as any)}
                      className="w-full bg-[#141520] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    >
                      <option value="standard">Standard Missions</option>
                      <option value="special">Special / Partner Events</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-semibold block mb-1">Action Type</label>
                    <select
                      value={taskAction}
                      onChange={(e) => setTaskAction(e.target.value as any)}
                      className="w-full bg-[#141520] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                    >
                      <option value="link">Web Link / Social</option>
                      <option value="telegram">Telegram Channel</option>
                      <option value="ad">Monetag Rewarded Video Ad</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={taskAdRequired}
                      onChange={(e) => setTaskAdRequired(e.target.checked)}
                      className="rounded border-white/20 accent-orange-500"
                    />
                    <span>Requires Rewarded Monetag Ad view</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-extrabold text-xs shadow-orange-glow hover:brightness-110 transition-all"
                >
                  Publish Mission to Cloud Firestore
                </button>
              </form>
            )}

            {/* Task Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((t) => (
                <div key={t.id} className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-orange-500/30 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        {t.task_type}
                      </span>
                      {t.ad_required && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
                          VIDEO AD
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-sm mb-1">{t.title}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{t.description}</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between py-2 border-t border-white/5 text-xs mb-3">
                      <span className="font-bold text-yellow-400">+{t.reward_coins} E-FORCE</span>
                      <span className="font-bold text-brand-orange">+{t.speed_boost}/hr</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.link && (
                        <a
                          href={t.link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-center text-xs font-semibold text-gray-300 transition-colors flex items-center justify-center gap-1"
                        >
                          <ExternalLink size={12} />
                          <span>Open Link</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                        title="Delete Task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: TELEGRAM BROADCAST STUDIO */}
        {activeSection === 'broadcast' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <form onSubmit={handleBroadcast} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Send size={18} className="text-brand-orange" />
                Telegram Bot Direct Broadcaster
              </h2>
              <p className="text-xs text-gray-400">
                Messages will be sent directly to miners' private Telegram chats from <b>@Elite_Force_Official_Mining_bot</b>. Supports HTML formatting (`&lt;b&gt;bold&lt;/b&gt;`, `&lt;i&gt;italic&lt;/i&gt;`).
              </p>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">Message Content (HTML Allowed) *</label>
                <textarea
                  rows={6}
                  required
                  placeholder="🔥 <b>NEW 24H BOOST EVENT!</b>\n\nDouble your mining yield this weekend by activating the reactor core! 🚀"
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">Optional Banner Photo URL (HTTPS)</label>
                <input
                  type="text"
                  placeholder="https://example.com/banner.jpg"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-orange"
                />
              </div>

              {broadcastProgress && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs">
                  <div className="flex justify-between mb-1 font-semibold text-orange-300">
                    <span>Sending Broadcast:</span>
                    <span>{broadcastProgress.sent} / {broadcastProgress.total}</span>
                  </div>
                  <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-orange h-full transition-all duration-200" 
                      style={{ width: `${(broadcastProgress.sent / (broadcastProgress.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {broadcastResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${broadcastResult.includes('failed') ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {broadcastResult}
                </div>
              )}

              <button
                type="submit"
                disabled={broadcasting || !broadcastMsg.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-black text-sm tracking-wide shadow-orange-glow hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Send size={16} />
                <span>{broadcasting ? 'Broadcasting in Progress...' : `Blast to All Miners (${userList.length})`}</span>
              </button>
            </form>

            {/* Live Message Preview */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-brand-orange" />
                  Live Telegram DM Preview
                </h3>
                
                {/* Mock Telegram Chat Bubble */}
                <div className="bg-[#182533] p-4 rounded-2xl border border-white/5 max-w-sm mx-auto shadow-2xl">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                    <div className="w-6 h-6 rounded-full bg-brand-orange flex items-center justify-center text-[10px] font-bold text-black">
                      EF
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Elite Force Official Mining bot</div>
                      <div className="text-[10px] text-blue-400">bot</div>
                    </div>
                  </div>

                  {photoUrl && (
                    <img 
                      src={photoUrl} 
                      alt="Banner Preview" 
                      className="w-full h-36 object-cover rounded-xl mb-2 border border-white/10" 
                      onError={(e) => { (e.target as any).style.display = 'none'; }}
                    />
                  )}

                  <div 
                    className="text-xs text-gray-100 whitespace-pre-wrap leading-relaxed font-sans"
                    dangerouslySetInnerHTML={{ __html: broadcastMsg || 'Your telegram broadcast preview will appear here formatted with HTML tags...' }}
                  />
                  <div className="text-[10px] text-gray-400 text-right mt-2">Just now ✓✓</div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-white/5 text-[11px] text-gray-400 flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
                <span>Miners who have blocked or deleted the bot will be automatically bypassed safely.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CLEAR ALL USER DATA CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#12131A] border border-red-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Permanently Clear All User Data?</h3>
                <p className="text-xs text-red-300/80">Danger Zone Action: Irreversible Data Eradication</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs space-y-2 text-gray-300">
              <p className="font-bold text-red-300">This will permanently and irreversibly wipe:</p>
              <ul className="space-y-1 list-disc pl-4 text-gray-400">
                <li><strong className="text-white">All Miners & Profiles</strong> (balances, speeds, referral counts)</li>
                <li><strong className="text-white">All Active & Historical Mining Sessions</strong></li>
                <li><strong className="text-white">All User Completed Tasks</strong></li>
                <li><strong className="text-white">All Referral Connections & Bonus Logs</strong></li>
                <li><strong className="text-white">All Withdrawal Requests</strong> (pending and completed)</li>
              </ul>
              <p className="text-[11px] text-emerald-400 pt-1 border-t border-red-500/20">
                ✓ Default system tasks and platform app settings will remain completely safe.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Type <span className="font-mono text-red-400 font-black">RESET</span> to confirm data wipe:
              </label>
              <input
                type="text"
                placeholder="Type RESET"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full bg-[#0C0D14] border border-red-500/30 focus:border-red-500 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white placeholder-gray-600 focus:outline-none transition-all uppercase"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={clearingData}
                onClick={() => { setShowClearModal(false); setConfirmInput(''); }}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingData || confirmInput.trim().toUpperCase() !== 'RESET'}
                onClick={handleClearAllUserData}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer"
              >
                {clearingData ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Clearing Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Clear All User Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
