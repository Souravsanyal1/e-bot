import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import type { TabType } from './components/BottomNav';
import { MiningTab } from './components/MiningTab';
import { TasksTab } from './components/TasksTab';
import { WithdrawTab } from './components/WithdrawTab';
import { FriendsTab } from './components/FriendsTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { AdminTab } from './components/AdminTab';
import { AdminLogin } from './components/AdminLogin';
import { 
  syncUserFirestore, 
  startMiningFirestore, 
  claimMiningFirestore, 
  getTasksFirestore, 
  completeTaskFirestore, 
  getReferralsFirestore, 
  getLeaderboardFirestore, 
  subscribeToUserFirestore 
} from './services/firestore';
import { tg } from './services/telegram';
import type { User, MiningState, Task, ReferralData, LeaderboardUser } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType | 'admin'>('mining');
  const [user, setUser] = useState<User | null>(null);
  const [mining, setMining] = useState<MiningState | null>(null);
  const [standardTasks, setStandardTasks] = useState<Task[]>([]);
  const [specialTasks, setSpecialTasks] = useState<Task[]>([]);
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [topMiners, setTopMiners] = useState<LeaderboardUser[]>([]);

  // Admin authentication state using Gmail & Password / Session
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem('eforce_admin_session');
      return Boolean(session);
    } catch {
      return false;
    }
  });

  const [adminEmail, setAdminEmail] = useState<string>(() => {
    try {
      const session = localStorage.getItem('eforce_admin_session');
      if (session) {
        return JSON.parse(session).email || '';
      }
      return '';
    } catch {
      return '';
    }
  });

  // Initialize Telegram & Sync Profile with Cloud Firestore
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

    // Check if accessing admin route
    const hasAdminParam = searchParams.get('admin') === 'true' || window.location.hash.includes('admin');
    if (hasAdminParam) {
      setCurrentTab('admin');
    }

    // Initialize Monetag In-App Interstitial (Zone ID: 11941636)
    const initMonetag = () => {
      if (typeof window.show_11941636 === 'function') {
        try {
          window.show_11941636({
            type: 'inApp',
            inAppSettings: {
              frequency: 2,
              capping: 0.1,
              interval: 30,
              timeout: 5,
              everyPage: false
            }
          });
        } catch (e) {
          console.warn('Monetag InApp init error:', e);
        }
      } else {
        setTimeout(initMonetag, 1000);
      }
    };
    initMonetag();

    syncUserData(referrerId);
  }, []);

  const syncUserData = async (refId?: number, forceAdmin?: boolean) => {
    const tgUser = tg.getUser();
    try {
      // 1. Primary: Cloud Firestore Sync
      const firestoreData = await syncUserFirestore(tgUser, refId);
      setUser({ ...firestoreData.user, is_admin: Boolean(forceAdmin) });
      setMining(firestoreData.mining);

      // 2. Real-time Firestore balance & speed subscription
      subscribeToUserFirestore(tgUser.id, (freshUser) => {
        setUser(prev => prev ? { ...prev, balance: freshUser.balance, speed_per_hr: freshUser.speed_per_hr } : freshUser);
      });
    } catch (e: any) {
      console.warn('Firestore primary sync fallback:', e);
      setUser({
        id: tgUser.id,
        username: tgUser.username || '',
        first_name: tgUser.first_name || 'Miner',
        balance: 0.0,
        speed_per_hr: 0.5,
        referral_count: 0,
        is_admin: Boolean(forceAdmin)
      });
      setMining({
        status: 'idle',
        is_mining: false,
        speed_per_hr: 0.5,
        session_hours: 24,
        elapsed_seconds: 0,
        remaining_seconds: 86400,
        progress_percent: 0,
        mined_unclaimed: 0.0,
        total_balance: 0.0
      });
    } finally {
      loadTabContent(tgUser.id);
    }
  };

  const loadTabContent = async (userId?: number) => {
    const activeUserId = userId || user?.id || tg.getUser().id;
    try {
      const [tasksData, refData, leadersData] = await Promise.all([
        getTasksFirestore(activeUserId).catch(() => ({ standard: [], special: [] })),
        getReferralsFirestore(activeUserId).catch(() => null),
        getLeaderboardFirestore().catch(() => ({ topMiners: [] }))
      ]);

      setStandardTasks(tasksData.standard);
      setSpecialTasks(tasksData.special);
      if (refData) setReferrals(refData);
      setTopMiners(leadersData.topMiners);
    } catch (e) {
      console.warn('Tab data fetch error:', e);
    }
  };

  // Mining Actions via Cloud Firestore
  const handleStartMining = async () => {
    if (!user) return;
    try {
      const freshMining = await startMiningFirestore(user.id, user.speed_per_hr || 0.5);
      setMining(freshMining);
    } catch (e) {
      setMining(prev => prev ? { ...prev, is_mining: true, status: 'mining', remaining_seconds: 86400 } : null);
    }
  };

  const handleClaimMining = async () => {
    if (!user) return;
    try {
      const res = await claimMiningFirestore(user.id, user.speed_per_hr || 0.5);
      setMining(res.mining);
      setUser(prev => prev ? { ...prev, balance: res.balance } : null);
    } catch (e: any) {
      console.warn('Claim error:', e.message);
    }
  };

  // Task Actions via Cloud Firestore
  const handleCompleteTask = async (taskId: number) => {
    if (!user) return;
    try {
      const res = await completeTaskFirestore(user.id, taskId);
      setUser(prev => prev ? { ...prev, balance: res.new_balance, speed_per_hr: res.new_speed } : null);
      if (mining) {
        setMining({ ...mining, speed_per_hr: res.new_speed });
      }
      loadTabContent(user.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Full Desktop Command Center View for Admin
  if (currentTab === 'admin') {
    if (!adminAuthenticated) {
      return (
        <AdminLogin
          onSuccess={(email) => {
            setAdminEmail(email);
            setAdminAuthenticated(true);
          }}
          onExit={() => setCurrentTab('mining')}
        />
      );
    }

    return (
      <AdminTab
        adminEmail={adminEmail}
        onExit={() => setCurrentTab('mining')}
        onSignOut={() => {
          localStorage.removeItem('eforce_admin_session');
          setAdminAuthenticated(false);
          setAdminEmail('');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* Dynamic Ambient Orange Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-brand-orange/15 via-orange-600/5 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-10 right-0 w-80 h-80 bg-brand-orange/10 blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <Navbar
        user={user}
        activeSpeed={mining?.speed_per_hr || user?.speed_per_hr || 0.5}
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

          {currentTab === 'withdraw' && (
            <motion.div
              key="withdraw"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <WithdrawTab
                user={user}
                onBalanceUpdate={(newBalance) => {
                  setUser(prev => prev ? { ...prev, balance: newBalance } : null);
                }}
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
        </AnimatePresence>
      </main>

      {/* Bottom Sticky Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />
    </div>
  );
};

export default App;
