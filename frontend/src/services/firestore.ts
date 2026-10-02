import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from './firebase';
import type { User, MiningState, Task, ReferralData, LeaderboardUser } from '../types';

const BASE_MINING_RATE = 0.5; // E-FORCE per hour
const SESSION_DURATION_HOURS = 24;
const REFERRAL_SPEED_BOOST = 0.05;
const REFERRAL_COIN_BONUS = 10.0;

// Helper to calculate real-time mining state
export function calculateMining(session: any, userSpeed: number = BASE_MINING_RATE): MiningState {
  if (!session || session.status === 'idle') {
    return {
      status: 'idle',
      is_mining: false,
      speed_per_hr: userSpeed,
      session_hours: SESSION_DURATION_HOURS,
      elapsed_seconds: 0,
      remaining_seconds: SESSION_DURATION_HOURS * 3600,
      progress_percent: 0,
      mined_unclaimed: 0.0,
      total_balance: 0.0
    };
  }

  const now = Date.now();
  const startTime = new Date(session.start_time).getTime();
  const totalDuration = SESSION_DURATION_HOURS * 3600 * 1000;
  const elapsedMs = Math.max(0, now - startTime);
  const remainingMs = Math.max(0, totalDuration - elapsedMs);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const remainingSec = Math.floor(remainingMs / 1000);
  const isFinished = elapsedMs >= totalDuration;

  const effectiveSec = Math.min(elapsedSec, SESSION_DURATION_HOURS * 3600);
  const mined = (effectiveSec / 3600) * userSpeed;

  return {
    status: isFinished ? 'claimable' : 'mining',
    is_mining: !isFinished,
    speed_per_hr: userSpeed,
    session_hours: SESSION_DURATION_HOURS,
    elapsed_seconds: elapsedSec,
    remaining_seconds: remainingSec,
    progress_percent: Math.min(100, (elapsedMs / totalDuration) * 100),
    mined_unclaimed: Number(mined.toFixed(6)),
    total_balance: 0.0
  };
}

// 1. Sync / Initialize User in Cloud Firestore
export async function syncUserFirestore(
  tgUser: { id: number; username?: string; first_name?: string; last_name?: string },
  referrerId?: number
): Promise<{ user: User; mining: MiningState }> {
  const userIdStr = String(tgUser.id);
  const userRef = doc(db, 'users', userIdStr);
  const userSnap = await getDoc(userRef);

  let userData: any;

  if (!userSnap.exists()) {
    const validRef = (referrerId && Number(referrerId) !== tgUser.id) ? Number(referrerId) : null;
    userData = {
      id: tgUser.id,
      username: tgUser.username || '',
      first_name: tgUser.first_name || 'Miner',
      last_name: tgUser.last_name || '',
      balance: 0.0,
      speed_per_hr: BASE_MINING_RATE,
      referral_count: 0,
      referred_by: validRef,
      is_banned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await setDoc(userRef, userData);

    // Process referral reward if joined via valid referrer link
    if (validRef) {
      try {
        const refRef = doc(db, 'users', String(validRef));
        const refSnap = await getDoc(refRef);
        if (refSnap.exists()) {
          const currentRefData = refSnap.data();
          const newSpeed = Number(currentRefData.speed_per_hr || BASE_MINING_RATE) + REFERRAL_SPEED_BOOST;
          const newBalance = Number(currentRefData.balance || 0) + REFERRAL_COIN_BONUS;
          const newCount = Number(currentRefData.referral_count || 0) + 1;

          await setDoc(refRef, {
            referral_count: newCount,
            speed_per_hr: newSpeed,
            balance: newBalance,
            updated_at: new Date().toISOString()
          }, { merge: true });

          // Record in referrals collection
          await setDoc(doc(db, 'referrals', `${validRef}_${tgUser.id}`), {
            referrer_id: validRef,
            referred_id: tgUser.id,
            bonus_coins: REFERRAL_COIN_BONUS,
            speed_boost: REFERRAL_SPEED_BOOST,
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('Referral credit error:', err);
      }
    }
  } else {
    userData = userSnap.data();
    // Update name/username in case changed
    if (tgUser.username !== userData.username || tgUser.first_name !== userData.first_name) {
      await setDoc(userRef, {
        username: tgUser.username || '',
        first_name: tgUser.first_name || 'Miner',
        updated_at: new Date().toISOString()
      }, { merge: true });
    }
  }

  // Get current active mining session
  const sessionRef = doc(db, 'mining_sessions', userIdStr);
  const sessionSnap = await getDoc(sessionRef);
  const sessionData = sessionSnap.exists() ? sessionSnap.data() : null;

  const miningState = calculateMining(sessionData, userData.speed_per_hr);
  miningState.total_balance = Number(userData.balance || 0);

  return {
    user: {
      id: userData.id,
      username: userData.username,
      first_name: userData.first_name,
      balance: Number(userData.balance || 0),
      speed_per_hr: Number(userData.speed_per_hr || BASE_MINING_RATE),
      referral_count: Number(userData.referral_count || 0),
      is_admin: false
    },
    mining: miningState
  };
}

// 2. Start 24H Mining Session in Cloud Firestore
export async function startMiningFirestore(userId: number, currentSpeed: number): Promise<MiningState> {
  const userIdStr = String(userId);
  const now = new Date();
  const endTime = new Date(now.getTime() + SESSION_DURATION_HOURS * 3600 * 1000);

  const sessionData = {
    user_id: userId,
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    base_speed: currentSpeed,
    status: 'active',
    updated_at: now.toISOString()
  };

  await setDoc(doc(db, 'mining_sessions', userIdStr), sessionData, { merge: true });
  return calculateMining(sessionData, currentSpeed);
}

// 3. Claim Mined Yield in Cloud Firestore
export async function claimMiningFirestore(userId: number, currentSpeed: number): Promise<{ balance: number; mining: MiningState }> {
  const userIdStr = String(userId);
  const sessionRef = doc(db, 'mining_sessions', userIdStr);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    throw new Error('No active mining session found');
  }

  const session = sessionSnap.data();
  const miningState = calculateMining(session, currentSpeed);
  const claimAmount = miningState.mined_unclaimed;

  if (claimAmount <= 0) {
    throw new Error('No mined tokens available to claim yet.');
  }

  // Update user balance in Firestore
  const userRef = doc(db, 'users', userIdStr);
  const userSnap = await getDoc(userRef);
  const currentBal = userSnap.exists() ? Number(userSnap.data().balance || 0) : 0;
  const newBalance = Number((currentBal + claimAmount).toFixed(6));

  await setDoc(userRef, {
    balance: newBalance,
    updated_at: new Date().toISOString()
  }, { merge: true });

  // Reset mining session to idle
  await setDoc(sessionRef, {
    status: 'idle',
    last_claim_amount: claimAmount,
    last_claim_at: new Date().toISOString()
  }, { merge: true });

  const freshMiningState = calculateMining(null, currentSpeed);
  freshMiningState.total_balance = newBalance;

  return {
    balance: newBalance,
    mining: freshMiningState
  };
}

// 4. Fetch Tasks from Cloud Firestore
export async function getTasksFirestore(userId: number): Promise<{ standard: Task[]; special: Task[] }> {
  const tasksRef = collection(db, 'tasks');
  let tasksSnap = await getDocs(tasksRef);

  // If no tasks exist in Firestore yet, seed default ones
  if (tasksSnap.empty) {
    const defaults = [
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

    for (const t of defaults) {
      await setDoc(doc(db, 'tasks', t.id), t);
    }
    tasksSnap = await getDocs(tasksRef);
  }

  // Fetch completed tasks for this user
  const userTasksSnap = await getDocs(
    query(collection(db, 'user_tasks'), where('user_id', '==', Number(userId)))
  );
  const completedTaskIds = new Set(userTasksSnap.docs.map(d => String(d.data().task_id)));

  const standard: Task[] = [];
  const special: Task[] = [];

  tasksSnap.forEach(d => {
    const taskData = d.data();
    const task: Task = {
      id: Number(taskData.id || d.id),
      title: taskData.title,
      description: taskData.description,
      reward_coins: Number(taskData.reward_coins || 0),
      speed_boost: Number(taskData.speed_boost || 0),
      task_type: taskData.task_type || 'standard',
      action_type: taskData.action_type || 'link',
      link: taskData.link || '',
      ad_required: Boolean(taskData.ad_required),
      wait_time_sec: Number(taskData.wait_time_sec || 0),
      is_completed: completedTaskIds.has(String(taskData.id || d.id))
    };

    if (task.task_type === 'special') {
      special.push(task);
    } else {
      standard.push(task);
    }
  });

  return { standard, special };
}

// 5. Complete Task in Cloud Firestore
export async function completeTaskFirestore(
  userId: number,
  taskId: number
): Promise<{ reward_coins: number; speed_boost: number; new_balance: number; new_speed: number }> {
  const userIdStr = String(userId);
  const taskIdStr = String(taskId);

  // Check task data
  const taskRef = doc(db, 'tasks', taskIdStr);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) {
    throw new Error('Task not found');
  }
  const task = taskSnap.data();

  // Record user task completion
  const userTaskDocId = `${userId}_${taskId}`;
  await setDoc(doc(db, 'user_tasks', userTaskDocId), {
    user_id: Number(userId),
    task_id: taskIdStr,
    completed: true,
    completed_at: new Date().toISOString()
  });

  // Credit user reward & speed boost in users collection
  const userRef = doc(db, 'users', userIdStr);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};

  const currentBal = Number(userData.balance || 0);
  const currentSpeed = Number(userData.speed_per_hr || BASE_MINING_RATE);

  const rewardCoins = Number(task.reward_coins || 0);
  const speedBoost = Number(task.speed_boost || 0);

  const newBalance = Number((currentBal + rewardCoins).toFixed(6));
  const newSpeed = Number((currentSpeed + speedBoost).toFixed(6));

  await setDoc(userRef, {
    balance: newBalance,
    speed_per_hr: newSpeed,
    updated_at: new Date().toISOString()
  }, { merge: true });

  return {
    reward_coins: rewardCoins,
    speed_boost: speedBoost,
    new_balance: newBalance,
    new_speed: newSpeed
  };
}

// 6. Fetch Leaderboard from Cloud Firestore
export async function getLeaderboardFirestore(): Promise<{ topMiners: LeaderboardUser[] }> {
  try {
    const q = query(
      collection(db, 'users'),
      limit(50)
    );
    const snap = await getDocs(q);
    const users = snap.docs
      .map(d => d.data())
      .filter(u => !u.is_banned)
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
      .slice(0, 50)
      .map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        name: u.first_name || u.username || 'Miner',
        balance: Number(u.balance || 0),
        speed: Number(u.speed_per_hr || BASE_MINING_RATE),
        referrals: Number(u.referral_count || 0)
      }));

    return { topMiners: users };
  } catch (e) {
    console.warn('Leaderboard fetch fallback:', e);
    return { topMiners: [] };
  }
}

// 7. Fetch Referrals from Cloud Firestore
export async function getReferralsFirestore(userId: number): Promise<ReferralData> {
  const userIdStr = String(userId);
  const userRef = doc(db, 'users', userIdStr);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};

  const q = query(collection(db, 'referrals'), where('referrer_id', '==', Number(userId)), limit(100));
  const snap = await getDocs(q);

  const friends = snap.docs.map(d => {
    const data = d.data();
    return {
      name: `Miner #${data.referred_id}`,
      username: '',
      joined_at: data.created_at,
      bonus_coins: Number(data.bonus_coins || REFERRAL_COIN_BONUS),
      speed_boost: Number(data.speed_boost || REFERRAL_SPEED_BOOST)
    };
  });

  const referralLink = `https://t.me/Elite_Force_Official_Mining_bot?start=ref_${userId}`;

  return {
    referral_link: referralLink,
    total_invited: Number(userData.referral_count || friends.length),
    speed_boost_earned: Number(((userData.referral_count || friends.length) * REFERRAL_SPEED_BOOST).toFixed(2)),
    bonus_per_friend: REFERRAL_COIN_BONUS,
    boost_per_friend: REFERRAL_SPEED_BOOST,
    friends
  };
}

// 8. Real-time User Profile Listener
export function subscribeToUserFirestore(userId: number, callback: (user: User) => void) {
  const userRef = doc(db, 'users', String(userId));
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        id: data.id,
        username: data.username || '',
        first_name: data.first_name || 'Miner',
        balance: Number(data.balance || 0),
        speed_per_hr: Number(data.speed_per_hr || BASE_MINING_RATE),
        referral_count: Number(data.referral_count || 0),
        is_admin: false
      });
    }
  });
}
