import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Plus, Trash2, Send, Users, 
  Coins, CheckSquare, Zap, Search, Link2, Check
} from 'lucide-react';
import type { AdminStats, Task } from '../types';
import { api, getApiBaseUrl } from '../services/api';
import { tg } from '../services/telegram';

export const AdminTab: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [urlSaved, setUrlSaved] = useState(false);

  // New Task Form State
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardCoins, setRewardCoins] = useState('25');
  const [speedBoost, setSpeedBoost] = useState('0.10');
  const [taskType, setTaskType] = useState<'standard' | 'special'>('standard');
  const [adRequired, setAdRequired] = useState(false);
  const [link, setLink] = useState('');
  const [waitTime] = useState('15');

  // Broadcast State
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // User search & boost state
  const [searchQuery, setSearchQuery] = useState('');
  const [userList, setUserList] = useState<any[]>([]);

  const handleSaveServerUrl = () => {
    localStorage.setItem('eforce_api_url', serverUrl);
    setUrlSaved(true);
    tg.haptic.notification('success');
    loadData();
    setTimeout(() => setUrlSaved(false), 2000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, tasksData] = await Promise.all([
        api.admin.getStats(),
        api.admin.getTasks()
      ]);
      setStats(statsData);
      setTasks(tasksData);
    } catch (e: any) {
      console.warn('Admin load error:', e);
      setStats({
        totalUsers: 0,
        totalMinedTokens: 0.0,
        activeTasks: 0,
        completedTasks: 0,
        totalReferrals: 0,
      });
      setTasks([]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    tg.haptic.impact('heavy');
    try {
      await api.admin.createTask({
        title,
        description,
        reward_coins: parseFloat(rewardCoins) || 10,
        speed_boost: parseFloat(speedBoost) || 0.05,
        task_type: taskType,
        ad_required: adRequired,
        link,
        wait_time_sec: parseInt(waitTime, 10) || 10,
      });

      tg.haptic.notification('success');
      setIsCreatingTask(false);
      setTitle('');
      setDescription('');
      setLink('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    tg.haptic.impact('medium');
    try {
      await api.admin.deleteTask(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg) return;

    tg.haptic.impact('heavy');
    setBroadcasting(true);
    setBroadcastResult(null);

    try {
      const res = await api.admin.broadcast(broadcastMsg, photoUrl || undefined);
      setBroadcastResult(`Broadcast complete! Sent: ${res.sent}, Failed: ${res.failed}`);
      setBroadcastMsg('');
      setPhotoUrl('');
    } catch (err: any) {
      setBroadcastResult(`Error: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSearchUsers = async () => {
    try {
      const users = await api.admin.getUsers(searchQuery);
      setUserList(users);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleBanToggle = async (id: number, currentBanned: boolean) => {
    tg.haptic.impact('medium');
    try {
      await api.admin.banUser(id, !currentBanned);
      handleSearchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBoostUser = async (id: number) => {
    const boost = prompt('Enter Speed Boost to add (e.g. 0.50):', '0.25');
    if (!boost) return;
    try {
      await api.admin.boostUser(id, parseFloat(boost), 0);
      alert('Speed boosted successfully!');
      handleSearchUsers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-brand-orange" />
          <h2 className="text-lg font-black text-white">Admin Command Center</h2>
        </div>
        <button
          onClick={loadData}
          className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-300"
        >
          Refresh
        </button>
      </div>

      {/* Live Backend Connection Card */}
      <div className="glass-panel p-3 rounded-2xl mb-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
            <Link2 size={14} className="text-brand-orange" />
            <span>Live Backend Server URL</span>
          </div>
          <span className="text-[10px] text-green-400 font-bold px-1.5 py-0.5 rounded bg-green-500/10">
            Real Server
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://localhost:3000/api or https://your-server.com/api"
            className="flex-1 px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-gray-500 font-mono"
          />
          <button
            onClick={handleSaveServerUrl}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              urlSaved ? 'bg-green-500 text-black' : 'bg-brand-orange text-white'
            }`}
          >
            {urlSaved ? <Check size={14} /> : 'Save'}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="glass-panel p-3 rounded-2xl">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
            <Users size={14} className="text-brand-orange" />
            <span>Total Users</span>
          </div>
          <div className="text-xl font-black text-white">{stats?.totalUsers || 0}</div>
        </div>

        <div className="glass-panel-orange p-3 rounded-2xl">
          <div className="flex items-center gap-1.5 text-orange-300 text-xs mb-1">
            <Coins size={14} className="text-brand-orange" />
            <span>Mined Tokens</span>
          </div>
          <div className="text-xl font-black text-brand-orange font-mono">
            {stats?.totalMinedTokens?.toFixed(1) || '0.0'}
          </div>
        </div>

        <div className="glass-panel p-3 rounded-2xl">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
            <CheckSquare size={14} className="text-green-400" />
            <span>Completed Tasks</span>
          </div>
          <div className="text-xl font-black text-white">{stats?.completedTasks || 0}</div>
        </div>

        <div className="glass-panel p-3 rounded-2xl">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
            <Zap size={14} className="text-yellow-400" />
            <span>Total Referrals</span>
          </div>
          <div className="text-xl font-black text-white">{stats?.totalReferrals || 0}</div>
        </div>
      </div>

      {/* Task Manager Section */}
      <div className="glass-panel p-4 rounded-2xl mb-5 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <CheckSquare size={14} className="text-brand-orange" />
            <span>Task Manager ({tasks.length})</span>
          </h3>
          <button
            onClick={() => setIsCreatingTask(!isCreatingTask)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-orange text-white"
          >
            <Plus size={14} />
            <span>{isCreatingTask ? 'Cancel' : 'New Task'}</span>
          </button>
        </div>

        {/* Task Creation Form */}
        {isCreatingTask && (
          <form onSubmit={handleCreateTask} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2.5 mb-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Task Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Watch Partner Ad or Join Channel"
                required
                className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Short instructions"
                className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Reward Coins</label>
                <input
                  type="number"
                  value={rewardCoins}
                  onChange={e => setRewardCoins(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Speed Boost (+/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  value={speedBoost}
                  onChange={e => setSpeedBoost(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                <select
                  value={taskType}
                  onChange={e => setTaskType(e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white"
                >
                  <option value="standard">Standard Task</option>
                  <option value="special">🔥 Special Task</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Show Video Ad?</label>
                <select
                  value={adRequired ? 'yes' : 'no'}
                  onChange={e => setAdRequired(e.target.value === 'yes')}
                  className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white"
                >
                  <option value="no">No Ads</option>
                  <option value="yes">Yes (Show Ad)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Target Link (Optional)</label>
              <input
                type="text"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://t.me/... or https://..."
                className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-gray-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg font-bold text-xs bg-gradient-to-r from-brand-orange to-amber-500 text-white shadow-sm"
            >
              Add Task to System
            </button>
          </form>
        )}

        {/* Existing Task List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {tasks.map(t => (
            <div key={t.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{t.title}</span>
                  {t.task_type === 'special' && (
                    <span className="px-1 py-0.2 rounded text-[9px] bg-orange-500/20 text-orange-400 font-bold">
                      SPECIAL
                    </span>
                  )}
                  {t.ad_required && (
                    <span className="px-1 py-0.2 rounded text-[9px] bg-red-500/20 text-red-400 font-bold">
                      AD
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                  <span>+{t.reward_coins} Coins</span>
                  <span className="text-brand-orange">+{t.speed_boost}/hr Speed</span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteTask(t.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Bot Broadcast Section */}
      <div className="glass-panel p-4 rounded-2xl mb-5 border border-white/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-1.5">
          <Send size={14} className="text-brand-orange" />
          <span>Telegram Bot Broadcast</span>
        </h3>

        <form onSubmit={handleBroadcast} className="space-y-2.5">
          <textarea
            value={broadcastMsg}
            onChange={e => setBroadcastMsg(e.target.value)}
            rows={3}
            placeholder="Broadcast announcement text (HTML formatting supported: <b>bold</b>, <i>italic</i>)..."
            required
            className="w-full p-2.5 rounded-xl bg-black/50 border border-white/20 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-orange resize-none"
          />

          <input
            type="text"
            value={photoUrl}
            onChange={e => setPhotoUrl(e.target.value)}
            placeholder="Optional image / banner URL (https://...)"
            className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-gray-500"
          />

          {broadcastResult && (
            <div className="p-2 rounded-lg bg-orange-500/20 text-orange-200 text-xs">
              {broadcastResult}
            </div>
          )}

          <button
            type="submit"
            disabled={broadcasting}
            className="w-full py-2.5 rounded-xl font-extrabold text-xs text-black bg-gradient-to-r from-white via-orange-100 to-brand-orange shadow-orange-glow flex items-center justify-center gap-1.5"
          >
            {broadcasting ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send size={13} />
                <span>Blast Message to All Users</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* User Management Section */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-1.5">
          <Users size={14} className="text-brand-orange" />
          <span>User Inspector & Speed Booster</span>
        </h3>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by ID or username..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-gray-500"
          />
          <button
            onClick={handleSearchUsers}
            className="px-3 py-1.5 rounded-lg bg-brand-orange text-white text-xs font-bold flex items-center gap-1"
          >
            <Search size={13} /> Search
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {userList.map(u => (
            <div key={u.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>{u.first_name || 'Miner'}</span>
                  {u.username && <span className="text-gray-400 font-normal">@{u.username}</span>}
                  {Boolean(u.is_banned) && (
                    <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">Banned</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 flex gap-2">
                  <span>Bal: {Number(u.balance).toFixed(2)}</span>
                  <span className="text-orange-400">⚡ {Number(u.speed_per_hr).toFixed(2)}/hr</span>
                  <span>Refs: {u.referral_count}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleBoostUser(u.id)}
                  className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold hover:bg-orange-500/30"
                >
                  +Boost
                </button>
                <button
                  onClick={() => handleBanToggle(u.id, Boolean(u.is_banned))}
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    Boolean(u.is_banned)
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {Boolean(u.is_banned) ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
