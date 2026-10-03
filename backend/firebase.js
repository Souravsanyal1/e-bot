import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { config } from './config.js';

const firebaseConfig = {
  apiKey: "AIzaSyAKLl-xBUIOIfxwFvmwOj5NHr85Q8u4mXo",
  authDomain: "e-force-bot.firebaseapp.com",
  projectId: "e-force-bot",
  storageBucket: "e-force-bot.firebasestorage.app",
  messagingSenderId: "255667053401",
  appId: "1:255667053401:web:57effd8fc3b362fb2aa248",
  measurementId: "G-3MVJKTS2P1"
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

console.log('🔥 Cloud Firestore initialized for project: e-force-bot');

// Firestore Data Helpers
export const firestoreDB = {
  // --- USERS ---
  async getUser(userId) {
    const userRef = doc(firestore, 'users', String(userId));
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data() : null;
  },

  async setUser(userId, data) {
    const userRef = doc(firestore, 'users', String(userId));
    await setDoc(userRef, {
      ...data,
      id: Number(userId),
      updated_at: new Date().toISOString()
    }, { merge: true });
    return this.getUser(userId);
  },

  async getAllUsers(limitCount = 100) {
    const q = query(collection(firestore, 'users'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  async getLeaderboard(limitCount = 50) {
    const q = query(
      collection(firestore, 'users'), 
      where('is_banned', '!=', true),
      orderBy('balance', 'desc'), 
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, index) => {
      const data = d.data();
      return {
        rank: index + 1,
        id: data.id,
        first_name: data.first_name || 'Miner',
        username: data.username || '',
        balance: Number(data.balance || 0),
        speed_per_hr: Number(data.speed_per_hr || 0.5)
      };
    });
  },

  // --- MINING SESSIONS ---
  async getMiningSession(userId) {
    const sessionRef = doc(firestore, 'mining_sessions', String(userId));
    const snap = await getDoc(sessionRef);
    return snap.exists() ? snap.data() : null;
  },

  async setMiningSession(userId, data) {
    const sessionRef = doc(firestore, 'mining_sessions', String(userId));
    await setDoc(sessionRef, {
      ...data,
      user_id: Number(userId),
      updated_at: new Date().toISOString()
    }, { merge: true });
    return this.getMiningSession(userId);
  },

  // --- TASKS ---
  async getAllTasks() {
    const snap = await getDocs(collection(firestore, 'tasks'));
    if (snap.empty) {
      // Seed default tasks
      await this.seedDefaultTasks();
      const freshSnap = await getDocs(collection(firestore, 'tasks'));
      return freshSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async seedDefaultTasks() {
    const initialTasks = [
      {
        id: '1',
        title: 'Watch Sponsored E-FORCE Ad',
        description: 'Watch a fast sponsor video ad to boost your mining engine rate permanently!',
        reward_coins: 25.0,
        speed_boost: 0.10,
        task_type: 'standard',
        action_type: 'ad',
        link: '',
        ad_required: true,
        wait_time_sec: 15
      },
      {
        id: '2',
        title: 'Join Official Telegram Channel',
        description: 'Subscribe to the official announcement channel for critical airdrop news.',
        reward_coins: 50.0,
        speed_boost: 0.15,
        task_type: 'standard',
        action_type: 'telegram',
        link: 'https://t.me/Elite_Force_Official_Mining_bot',
        ad_required: false,
        wait_time_sec: 5
      },
      {
        id: '3',
        title: 'Follow E-FORCE on X (Twitter)',
        description: 'Follow our official X handle and retweet the pinned 24H mining announcement.',
        reward_coins: 35.0,
        speed_boost: 0.08,
        task_type: 'standard',
        action_type: 'link',
        link: 'https://x.com',
        ad_required: false,
        wait_time_sec: 10
      },
      {
        id: '4',
        title: '🔥 SPECIAL: Supercharge Core with Video Partner',
        description: 'Watch our special partner video showcase and unlock double speed boost!',
        reward_coins: 100.0,
        speed_boost: 0.25,
        task_type: 'special',
        action_type: 'ad',
        link: '',
        ad_required: true,
        wait_time_sec: 20
      },
      {
        id: '5',
        title: '⚡ SPECIAL: Connect TON / Web3 Wallet Preview',
        description: 'Bookmark the upcoming Web3 smart contract connection portal.',
        reward_coins: 75.0,
        speed_boost: 0.20,
        task_type: 'special',
        action_type: 'link',
        link: 'https://ton.org',
        ad_required: false,
        wait_time_sec: 10
      }
    ];

    for (const task of initialTasks) {
      const taskRef = doc(firestore, 'tasks', task.id);
      await setDoc(taskRef, task);
    }
  },

  async getUserTasks(userId) {
    const q = query(collection(firestore, 'user_tasks'), where('user_id', '==', Number(userId)));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  async completeUserTask(userId, taskId) {
    const docId = `${userId}_${taskId}`;
    const ref = doc(firestore, 'user_tasks', docId);
    await setDoc(ref, {
      user_id: Number(userId),
      task_id: String(taskId),
      completed: true,
      completed_at: new Date().toISOString()
    });
  },

  // --- REFERRALS ---
  async addReferral(referrerId, referredId, bonusCoins, speedBoost) {
    const docId = `${referrerId}_${referredId}`;
    const ref = doc(firestore, 'referrals', docId);
    await setDoc(ref, {
      referrer_id: Number(referrerId),
      referred_id: Number(referredId),
      bonus_coins: Number(bonusCoins),
      speed_boost: Number(speedBoost),
      created_at: new Date().toISOString()
    });
  },

  async getReferrals(referrerId) {
    const q = query(
      collection(firestore, 'referrals'),
      where('referrer_id', '==', Number(referrerId)),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  // --- CLEAR ALL USER DATA ---
  async clearAllUserData() {
    const collectionsToClear = ['users', 'user_tasks', 'mining_sessions', 'referrals', 'withdrawals'];
    for (const colName of collectionsToClear) {
      const colRef = collection(firestore, colName);
      const snap = await getDocs(colRef);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    }
    return { success: true };
  },

  // --- APP SETTINGS ---
  async getSettings() {
    try {
      const snap = await getDoc(doc(firestore, 'settings', 'config'));
      return snap.exists() ? snap.data() : {};
    } catch (e) {
      console.warn('Firestore getSettings error:', e.message);
      return {};
    }
  },

  async updateSettings(settings) {
    try {
      const ref = doc(firestore, 'settings', 'config');
      await setDoc(ref, settings, { merge: true });
      return this.getSettings();
    } catch (e) {
      console.warn('Firestore updateSettings error:', e.message);
      throw e;
    }
  }
};
