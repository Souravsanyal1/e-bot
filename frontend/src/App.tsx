import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import type { TabType } from './components/BottomNav';
import { MiningTab } from './components/MiningTab';
import { TasksTab } from './components/TasksTab';
import { FriendsTab } from './components/FriendsTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { AdminTab } from './components/AdminTab';
import { api } from './services/api';
import { tg } from './services/telegram';
import type { User, MiningState, Task, ReferralData, LeaderboardUser } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('mining');
  const [user, setUser] = useState<User | null>(null);
  const [mining, setMining] = useState<MiningState | null>(null);
  const [standardTasks, setStandardTasks] = useState<Task[]>([]);
  const [specialTasks, setSpecialTasks] = useState<Task[]>([]);
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [topMiners, setTopMiners] = useState<LeaderboardUser[]>([]);

  // Initialize Telegram & Sync Profile
  useEffect(() => {
    tg.init();

    // Check referral query param
    const searchParams = new URLSearchParams(window.location.search);
    const startParam = searchParams.get('tgWebAppStartParam') || searchParams.get('startapp') || '';
    let referrerId: number | undefined;
    if (startParam.startsWith('ref_')) {
      const parsed = parseInt(startParam.replace('ref_', ''), 10);
      if (!isNaN(parsed)) referrerId = parsed;
    }

    // Check admin query param or hash
    const hasAdminParam = searchParams.get('admin') === 'true' || window.location.hash.includes('admin');
    if (hasAdminParam) {
      setCurrentTab('admin');
    }

    syncUserData(referrerId, hasAdminParam);
  }, []);

  const handleToggleAdmin = () => {
    tg.haptic.notification('success');
    setUser(prev => prev ? { ...prev, is_admin: !prev.is_admin } : null);
    setCurrentTab(prev => (prev === 'admin' ? 'mining' : 'admin'));
  };

  const syncUserData = async (refId?: number, forceAdmin?: boolean) => {
    try {
      const data = await api.syncUser(refId);
      setUser(forceAdmin ? { ...data.user, is_admin: true } : data.user);
      setMining(data.mining);
    } catch (e: any) {
      console.warn('Sync fallback for dev mode:', e);
      // Fallback mock user if backend is not yet started or running standalone frontend
      setUser({
        id: 999888777,
        username: 'eforce_master',
        first_name: 'E-FORCE Miner',
        balance: 125.5,
        speed_per_hr: 0.85,
        referral_count: 5,
        is_admin: true
      });
      setMining({
        status: 'mining',
        is_mining: true,
        speed_per_hr: 0.85,
        session_hours: 24,
        elapsed_seconds: 3600,
        remaining_seconds: 82800,
        progress_percent: 4.16,
        mined_unclaimed: 0.85,
        total_balance: 125.5
      });
    } finally {
      loadTabContent();
    }
  };

  const loadTabContent = async () => {
    try {
      const [tasksData, refData, leadersData] = await Promise.all([
        api.getTasks().catch(() => ({ standard: [], special: [] })),
        api.getReferrals().catch(() => null),
        api.getLeaderboard().catch(() => ({ topMiners: [] }))
      ]);

      setStandardTasks(tasksData.standard);
      setSpecialTasks(tasksData.special);
      if (refData) setReferrals(refData);
      setTopMiners(leadersData.topMiners);
    } catch (e) {
      console.warn('Tab data fetch error:', e);
    }
  };

  // Mining Actions
  const handleStartMining = async () => {
    try {
      const res = await api.startMining();
      setMining(res.mining);
    } catch (e) {
      // Dev mode local update
      setMining(prev => prev ? { ...prev, is_mining: true, status: 'mining', remaining_seconds: 86400 } : null);
    }
  };

  const handleClaimMining = async () => {
    try {
      const res = await api.claimMining();
      setMining(res.mining_state);
      setUser(prev => prev ? { ...prev, balance: res.new_balance } : null);
    } catch (e) {
      // Dev mode local update
      setUser(prev => prev ? { ...prev, balance: (prev.balance || 0) + (mining?.mined_unclaimed || 0) } : null);
      setMining(prev => prev ? { ...prev, mined_unclaimed: 0, remaining_seconds: 86400 } : null);
    }
  };

  // Task Actions
  const handleCompleteTask = async (taskId: number) => {
    try {
      const res = await api.completeTask(taskId);
      setUser(prev => prev ? { ...prev, balance: res.newBalance, speed_per_hr: res.newSpeed } : null);
      if (mining) {
        setMining({ ...mining, speed_per_hr: res.newSpeed });
      }
      loadTabContent();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* Dynamic Ambient Orange Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-brand-orange/15 via-orange-600/5 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-10 right-0 w-80 h-80 bg-brand-orange/10 blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <Navbar
        user={user}
        activeSpeed={mining?.speed_per_hr || user?.speed_per_hr || 0.5}
        onToggleAdmin={handleToggleAdmin}
      />

      {/* Main Tab Router View */}
      <main className="flex-1 w-full max-w-md mx-auto pt-2">
        <AnimatePresence mode="wait">
          {currentTab === 'mining' && (
            <motion.div
              key="mining"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <MiningTab
                user={user}
                mining={mining}
                onStartMining={handleStartMining}
                onClaimMining={handleClaimMining}
                onNavigateToTasks={() => setCurrentTab('tasks')}
                onNavigateToFriends={() => setCurrentTab('friends')}
              />
            </motion.div>
          )}

          {currentTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <TasksTab
                standardTasks={standardTasks}
                specialTasks={specialTasks}
                onCompleteTask={handleCompleteTask}
                onRefresh={loadTabContent}
              />
            </motion.div>
          )}

          {currentTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <FriendsTab
                referrals={referrals}
                onRefresh={loadTabContent}
              />
            </motion.div>
          )}

          {currentTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <LeaderboardTab
                topMiners={topMiners}
                currentUser={user}
              />
            </motion.div>
          )}

          {currentTab === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AdminTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Sticky Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isAdmin={Boolean(user?.is_admin)}
      />
    </div>
  );
};

export default App;
