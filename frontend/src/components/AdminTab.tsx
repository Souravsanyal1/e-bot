import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Plus, Trash2, Send, Users, 
  Coins, CheckSquare, Zap, Search, RefreshCw, 
  ArrowLeft, CheckCircle2, AlertTriangle, Radio, 
  ExternalLink, Ban, Sparkles, MessageSquare
} from 'lucide-react';
import { 
  getAdminStatsFirestore, 
  getAdminUsersFirestore, 
  getTasksFirestore, 
  adminCreateTaskFirestore, 
  adminDeleteTaskFirestore, 
  adminBanUserFirestore, 
  adminBoostUserFirestore, 
  adminBroadcastFirestore 
} from '../services/firestore';
import type { AdminStats, Task } from '../types';

interface AdminTabProps {
  onExit?: () => void;
}

type AdminSection = 'overview' | 'users' | 'tasks' | 'broadcast';

export const AdminTab: React.FC<AdminTabProps> = ({ onExit }) => {
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

  // Load all live data from Cloud Firestore
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, tasksData, usersData] = await Promise.all([
        getAdminStatsFirestore(),
        getTasksFirestore(0),
        getAdminUsersFirestore(searchQuery)
      ]);

      setStats(statsData);
      setTasks([...tasksData.standard, ...tasksData.special]);
      setUserList(usersData);
    } catch (err: any) {
      console.warn('Admin load error:', err);
    } finally {
      setLoading(false);
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
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-brand-orange' : ''} />
            <span className="hidden sm:inline">Refresh Data</span>
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
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* Navigation Tabs Bar for Desktop */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-3 overflow-x-auto">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: Zap },
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
            {/* 4 Big KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Miners</span>
                  <div className="p-2 rounded-xl bg-orange-500/10 text-brand-orange">
                    <Users size={18} />
                  </div>
                </div>
                <div className="text-3xl font-black font-mono text-white">
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
                <div className="text-3xl font-black font-mono text-brand-orange fire-text-gradient">
                  {stats.totalMinedTokens.toFixed(4)}
                </div>
                <div className="text-[11px] text-orange-200/70 mt-1">E-FORCE Distributed in Network</div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Tasks</span>
                  <div className="p-2 rounded-xl bg-white/10 text-orange-400">
                    <CheckSquare size={18} />
                  </div>
                </div>
                <div className="text-3xl font-black font-mono text-white">
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
                <div className="text-3xl font-black font-mono text-white">
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
                    <span className="text-gray-400">Adsgram Unit ID:</span>
                    <span className="font-mono text-yellow-300 font-bold bg-yellow-500/10 px-2 py-0.5 rounded">51502 (Rewarded Video)</span>
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
          </div>
        )}

        {/* SECTION 2: USERS MANAGEMENT TABLE */}
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

              <form onSubmit={handleSearch} className="w-full sm:w-80 flex items-center gap-2">
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
                  className="px-3.5 py-2 rounded-xl bg-brand-orange text-black font-extrabold text-xs hover:brightness-110 transition-all"
                >
                  Filter
                </button>
              </form>
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
                  Task & Adsgram Mission Manager ({tasks.length})
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
                      <option value="ad">Adsgram Rewarded Video Ad</option>
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
                    <span>Requires Rewarded Adsgram Ad Video view</span>
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
    </div>
  );
};
