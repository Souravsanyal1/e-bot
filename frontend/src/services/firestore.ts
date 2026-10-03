import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  addDoc,
  getDocs, 
  query, 
  where, 
  limit, 
  onSnapshot, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import type { User, MiningState, Task, ReferralData, LeaderboardUser, WithdrawalRequest, ForceJoinItem, SwapRecord } from '../types';

export const BOT_TOKEN = '8826126541:AAG_8ZxcBe9zQ40wqf-bUUROZAufCt2vnqw';

const BASE_MINING_RATE = 0.5; // E-FORCE per hour
const SESSION_DURATION_HOURS = 24;
const REFERRAL_SPEED_BOOST = 0.05;
const REFERRAL_COIN_BONUS = 10.0;

// Helper to calculate real-time mining state
export function calculateMining(session: any, userSpeed: number = BASE_MINING_RATE): MiningState {
  const durationHours = Number(
    session?.session_hours || 
    (session?.end_time && session?.start_time ? Math.max(1, Math.round((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 3600000)) : SESSION_DURATION_HOURS)
  );

  if (!session || session.status === 'idle') {
    return {
      status: 'idle',
      is_mining: false,
      speed_per_hr: userSpeed,
      session_hours: durationHours,
      elapsed_seconds: 0,
      remaining_seconds: durationHours * 3600,
      progress_percent: 0,
      mined_unclaimed: 0.0,
      total_balance: 0.0
    };
  }

  const now = Date.now();
  const startTime = new Date(session.start_time).getTime();
  const totalDuration = durationHours * 3600 * 1000;
  const elapsedMs = Math.max(0, now - startTime);
  const remainingMs = Math.max(0, totalDuration - elapsedMs);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const remainingSec = Math.floor(remainingMs / 1000);
  const isFinished = elapsedMs >= totalDuration;

  const effectiveSec = Math.min(elapsedSec, durationHours * 3600);
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

// ==========================================
// ANTI-CHEAT & CLIENT FOOTPRINT HELPERS
// ==========================================

let cachedClientIp: string | null = null;

export async function getClientIp(): Promise<string> {
  if (cachedClientIp) return cachedClientIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data.ip) {
      cachedClientIp = String(data.ip).trim();
      return cachedClientIp;
    }
  } catch {
    try {
      const res = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.ip) {
        cachedClientIp = String(data.ip).trim();
        return cachedClientIp;
      }
    } catch {}
  }
  return 'unknown';
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('eforce_device_uid');
    if (!id || id.length < 8) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('eforce_device_uid', id);
    }
    return id;
  } catch {
    return 'dev_unknown';
  }
}

// Check if user has initialized /start in Telegram Bot chat
export async function verifyUserBotStarted(userId: number): Promise<boolean> {
  // Allow admin IDs in testing
  if (userId === 999888777 || userId === 111111111) return true;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${userId}`);
    const data = await res.json();
    return Boolean(data.ok && data.result && data.result.id);
  } catch (e) {
    console.warn('Bot chat verification error:', e);
    return false;
  }
}

// Check if user is a member/admin of a Telegram Channel or Group
export async function verifyChannelMembership(
  userId: number, 
  chatUsernameOrId: string
): Promise<{ joined: boolean; error?: string; botNotAdmin?: boolean }> {
  // Allow admin IDs in testing
  if (userId === 999888777 || userId === 111111111) {
    return { joined: true };
  }

  const cleanChat = chatUsernameOrId.trim();
  if (!cleanChat) return { joined: true };

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(cleanChat)}&user_id=${userId}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok && data.result) {
      const status = data.result.status;
      if (status === 'creator' || status === 'administrator' || status === 'member') {
        return { joined: true };
      }
      if (status === 'restricted' && data.result.is_member) {
        return { joined: true };
      }
      return { joined: false, error: 'User is not a member of this chat' };
    }

    if (data.description) {
      const desc = String(data.description).toLowerCase();
      if (desc.includes('member list is inaccessible') || desc.includes('chat not found')) {
        return { 
          joined: false, 
          botNotAdmin: true, 
          error: 'Bot needs Admin rights in this channel to verify automatically.' 
        };
      }
      return { joined: false, error: data.description };
    }

    return { joined: false, error: 'Verification failed' };
  } catch (err: any) {
    console.warn('Membership verification error:', err);
    return { joined: false, error: err.message || 'Network error' };
  }
}

// Mark user as having completed force join requirements
export async function saveUserForceJoined(userId: number): Promise<void> {
  const userRef = doc(db, 'users', String(userId));
  await setDoc(userRef, {
    has_force_joined: true,
    force_joined_at: new Date().toISOString()
  }, { merge: true });
}

// Helper to credit referral bonus and speed boost in Cloud Firestore
export async function processReferralReward(
  referrerId: number,
  referredUser: { id: number; first_name?: string; username?: string },
  configuredRefBonus: number = REFERRAL_COIN_BONUS,
  configuredRefBoost: number = REFERRAL_SPEED_BOOST,
  configuredBaseRate: number = BASE_MINING_RATE
): Promise<boolean> {
  const refIdNum = Number(referrerId);
  const referredIdNum = Number(referredUser.id);
  if (!refIdNum || isNaN(refIdNum) || refIdNum === referredIdNum) {
    return false;
  }

  const refDocId = `${refIdNum}_${referredIdNum}`;
  const referralRef = doc(db, 'referrals', refDocId);
  const referralSnap = await getDoc(referralRef);

  // If already recorded and rewarded, do not duplicate
  if (referralSnap.exists()) {
    return false;
  }

  // Fetch referrer profile
  const refUserRef = doc(db, 'users', String(refIdNum));
  const refUserSnap = await getDoc(refUserRef);

  if (refUserSnap.exists()) {
    const currentRefData = refUserSnap.data();
    const newSpeed = Number((Number(currentRefData.speed_per_hr || configuredBaseRate) + configuredRefBoost).toFixed(4));
    const newBalance = Number((Number(currentRefData.balance || 0) + configuredRefBonus).toFixed(4));
    const newCount = Number(currentRefData.referral_count || 0) + 1;

    // 1. Credit referrer in Cloud Firestore
    await setDoc(refUserRef, {
      referral_count: newCount,
      speed_per_hr: newSpeed,
      balance: newBalance,
      updated_at: new Date().toISOString()
    }, { merge: true });

    // 2. Add document to referrals collection
    await setDoc(referralRef, {
      id: refDocId,
      referrer_id: refIdNum,
      referred_id: referredIdNum,
      referred_name: referredUser.first_name || 'Miner',
      referred_username: referredUser.username || '',
      photo_url: (referredUser as any).photo_url || '',
      bonus_coins: configuredRefBonus,
      speed_boost: configuredRefBoost,
      created_at: new Date().toISOString()
    });

    // 3. Send Telegram bot notification to referrer
    try {
      const msg = 
        `🎉 <b>New Referral Joined!</b>\n\n` +
        `<b>${referredUser.first_name || 'Miner'}</b> (@${referredUser.username || 'hidden'}) just started mining using your link!\n\n` +
        `⚡ <b>Rewards Unlocked:</b>\n` +
        `• +${configuredRefBoost} E-FORCE/hr Mining Speed Boost\n` +
        `• +${configuredRefBonus} E-FORCE Instant Bonus\n\n` +
        `Keep sharing to accelerate your 24H mining output! 🚀`;

      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: refIdNum,
          text: msg,
          parse_mode: 'HTML'
        })
      }).catch(() => {});
    } catch (_) {}

    return true;
  }
  return false;
}

// 1. Sync / Initialize User in Cloud Firestore with Anti-Cheat Security Audit
export async function syncUserFirestore(
  tgUser: { id: number; username?: string; first_name?: string; last_name?: string },
  referrerId?: number
): Promise<{ user: User; mining: MiningState }> {
  const userIdStr = String(tgUser.id);
  const userRef = doc(db, 'users', userIdStr);
  const userSnap = await getDoc(userRef);
  const settings = await getAppSettings();

  const configuredBaseRate = settings.base_mining_rate || BASE_MINING_RATE;
  const configuredRefBoost = settings.referral_speed_boost || REFERRAL_SPEED_BOOST;
  const configuredRefBonus = settings.referral_coin_bonus || REFERRAL_COIN_BONUS;

  // Anti-Cheat Parameters
  const antiCheatActive = settings.anti_cheat_enabled !== false;
  const autoBanMultiAccount = settings.auto_ban_multi_account !== false;
  const autoBanMultiIp = settings.auto_ban_multi_ip !== false;
  const maxAccountsPerDevice = settings.max_accounts_per_device !== undefined ? Number(settings.max_accounts_per_device) : 1;
  const maxAccountsPerIp = settings.max_accounts_per_ip !== undefined ? Number(settings.max_accounts_per_ip) : 2;
  const maxIpsPerAccount = settings.max_ips_per_account !== undefined ? Number(settings.max_ips_per_account) : 4;

  // Retrieve Client Footprint
  const clientIp = await getClientIp().catch(() => 'unknown');
  const deviceId = getDeviceId();

  let userData: any;

  if (!userSnap.exists()) {
    // ENFORCEMENT: /start na dile user list e bosbe na!
    const hasStarted = await verifyUserBotStarted(tgUser.id);
    if (!hasStarted) {
      const err = new Error('BOT_NOT_STARTED');
      (err as any).code = 'BOT_NOT_STARTED';
      throw err;
    }

    const validRef = (referrerId && Number(referrerId) !== tgUser.id) ? Number(referrerId) : null;
    userData = {
      id: tgUser.id,
      username: tgUser.username || '',
      first_name: tgUser.first_name || 'Miner',
      last_name: tgUser.last_name || '',
      balance: 0.0,
      speed_per_hr: configuredBaseRate,
      referral_count: 0,
      referred_by: validRef,
      is_banned: false,
      ban_reason: '',
      banned_at: '',
      has_started_bot: true,
      has_force_joined: false,
      current_ip: clientIp,
      device_id: deviceId,
      ip_history: clientIp !== 'unknown' ? [clientIp] : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await setDoc(userRef, userData);

    // Process referral reward if joined via valid referrer link
    if (validRef) {
      await processReferralReward(validRef, tgUser, configuredRefBonus, configuredRefBoost, configuredBaseRate);
      try { localStorage.removeItem('eforce_pending_ref'); } catch {}
    }
  } else {
    userData = userSnap.data();

    // Check if user was referred or has pending referral to link
    const effectiveRef = (referrerId && Number(referrerId) !== tgUser.id)
      ? Number(referrerId)
      : (userData.referred_by ? Number(userData.referred_by) : null);

    if (effectiveRef && effectiveRef !== tgUser.id) {
      const wasRewarded = await processReferralReward(effectiveRef, tgUser, configuredRefBonus, configuredRefBoost, configuredBaseRate);
      if (wasRewarded || (!userData.referred_by && effectiveRef)) {
        userData.referred_by = effectiveRef;
        await setDoc(userRef, {
          referred_by: effectiveRef,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
      try { localStorage.removeItem('eforce_pending_ref'); } catch {}
    }

    // Update name/username in case changed
    if (tgUser.username !== userData.username || tgUser.first_name !== userData.first_name) {
      await setDoc(userRef, {
        username: tgUser.username || '',
        first_name: tgUser.first_name || 'Miner',
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    if (!userData.photo_url) {
      getTelegramUserPhoto(tgUser.id).then(async (url) => {
        if (url) {
          await setDoc(userRef, { photo_url: url }, { merge: true });
        }
      }).catch(() => {});
    }
  }

  // ==========================================
  // ANTI-CHEAT MULTI-ACCOUNT & MULTI-IP AUDIT
  // ==========================================
  let isBanned = Boolean(userData.is_banned);
  let banReason = userData.ban_reason || '';
  let bannedAt = userData.banned_at || '';
  const currentHistory: string[] = Array.isArray(userData.ip_history) ? [...userData.ip_history] : [];

  if (clientIp && clientIp !== 'unknown' && !currentHistory.includes(clientIp)) {
    currentHistory.push(clientIp);
  }

  if (!isBanned && antiCheatActive) {
    // 1) DEVICE MULTI-ACCOUNT DETECTION
    if (deviceId && deviceId !== 'dev_unknown') {
      try {
        const deviceRef = doc(db, 'security_devices', deviceId);
        const deviceSnap = await getDoc(deviceRef);
        let linkedUsers: number[] = [];
        if (deviceSnap.exists()) {
          linkedUsers = Array.isArray(deviceSnap.data().user_ids) ? [...deviceSnap.data().user_ids] : [];
        }
        if (!linkedUsers.includes(tgUser.id)) {
          linkedUsers.push(tgUser.id);
        }

        // If multiple distinct accounts use this exact physical device
        if (autoBanMultiAccount && linkedUsers.length > maxAccountsPerDevice) {
          isBanned = true;
          banReason = `Anti-Cheat: Multi-accounting detected. Multiple accounts (${linkedUsers.length}) operating on the same device.`;
          bannedAt = new Date().toISOString();
        }

        await setDoc(deviceRef, {
          device_id: deviceId,
          user_ids: linkedUsers,
          accounts_count: linkedUsers.length,
          last_user_id: tgUser.id,
          last_seen: new Date().toISOString()
        }, { merge: true });
      } catch (devErr) {
        console.warn('Device security audit error:', devErr);
      }
    }

    // 2) IP MULTI-ACCOUNT DETECTION (Farming multiple accounts on same IP)
    if (!isBanned && clientIp && clientIp !== 'unknown') {
      try {
        const sanitizedIp = clientIp.replace(/[:.]/g, '_');
        const ipRef = doc(db, 'security_ips', sanitizedIp);
        const ipSnap = await getDoc(ipRef);
        let ipUsers: number[] = [];
        if (ipSnap.exists()) {
          ipUsers = Array.isArray(ipSnap.data().user_ids) ? [...ipSnap.data().user_ids] : [];
        }
        if (!ipUsers.includes(tgUser.id)) {
          ipUsers.push(tgUser.id);
        }

        if (autoBanMultiAccount && ipUsers.length > maxAccountsPerIp) {
          isBanned = true;
          banReason = `Anti-Cheat: Multi-accounting detected. Too many accounts (${ipUsers.length}) operating from the same IP address (${clientIp}).`;
          bannedAt = new Date().toISOString();
        }

        await setDoc(ipRef, {
          ip: clientIp,
          user_ids: ipUsers,
          accounts_count: ipUsers.length,
          last_user_id: tgUser.id,
          last_seen: new Date().toISOString()
        }, { merge: true });
      } catch (ipErr) {
        console.warn('IP security audit error:', ipErr);
      }
    }

    // 3) MULTIPLE IP HOPPING / VPN PROXY ROTATION DETECTION
    if (!isBanned && autoBanMultiIp && clientIp && clientIp !== 'unknown') {
      if (currentHistory.length > maxIpsPerAccount) {
        isBanned = true;
        banReason = `Anti-Cheat: Multiple IP addresses detected (${currentHistory.length} IPs used). Suspicious VPN/Proxy rotation prohibited.`;
        bannedAt = new Date().toISOString();
      }
    }
  }

  // Update audit trail on user document
  await setDoc(userRef, {
    current_ip: clientIp,
    device_id: deviceId,
    ip_history: currentHistory,
    is_banned: isBanned,
    ban_reason: banReason,
    banned_at: bannedAt,
    updated_at: new Date().toISOString()
  }, { merge: true });

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
      eforce_balance: Number(userData.eforce_balance || 0),
      speed_per_hr: Number(userData.speed_per_hr || BASE_MINING_RATE),
      referral_count: Number(userData.referral_count || 0),
      is_admin: false,
      photo_url: userData.photo_url || undefined,
      is_banned: isBanned,
      ban_reason: banReason,
      banned_at: bannedAt,
      current_ip: clientIp,
      device_id: deviceId,
      ip_history: currentHistory,
      has_started_bot: Boolean(userData.has_started_bot),
      has_force_joined: Boolean(userData.has_force_joined)
    },
    mining: miningState
  };
}

// 2. Start 24H Mining Session in Cloud Firestore
export async function startMiningFirestore(userId: number, currentSpeed: number): Promise<MiningState> {
  const settings = await getAppSettings();
  const sessionHours = settings.session_duration_hours || SESSION_DURATION_HOURS;
  const userIdStr = String(userId);
  const now = new Date();
  const endTime = new Date(now.getTime() + sessionHours * 3600 * 1000);

  const sessionData = {
    user_id: userId,
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    session_hours: sessionHours,
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
        referrals: Number(u.referral_count || 0),
        photo_url: u.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.first_name || u.username || String(u.id))}&backgroundColor=181824`
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
  const userIdNum = Number(userId);

  const [userSnap, numSnap, strSnap, settings] = await Promise.all([
    getDoc(doc(db, 'users', userIdStr)).catch(() => null),
    getDocs(query(collection(db, 'referrals'), where('referrer_id', '==', userIdNum), limit(100))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'referrals'), where('referrer_id', '==', userIdStr), limit(100))).catch(() => ({ docs: [] } as any)),
    getAppSettings().catch(() => ({} as any))
  ]);

  const userData = userSnap && userSnap.exists() ? userSnap.data() : {};
  const refBoost = settings?.referral_speed_boost !== undefined ? Number(settings.referral_speed_boost) : REFERRAL_SPEED_BOOST;
  const refBonus = settings?.referral_coin_bonus !== undefined ? Number(settings.referral_coin_bonus) : REFERRAL_COIN_BONUS;

  // Deduplicate referral docs
  const seenIds = new Set<string>();
  const combinedDocs = [...(numSnap?.docs || []), ...(strSnap?.docs || [])].filter(d => {
    if (seenIds.has(d.id)) return false;
    seenIds.add(d.id);
    return true;
  });

  const friends = await Promise.all(combinedDocs.map(async (d) => {
    const data = d.data();
    let photoUrl = data.photo_url || undefined;
    const referredId = Number(data.referred_id);

    // If photo_url is not saved on the referral record, look up the referred user's doc
    if (!photoUrl && referredId) {
      try {
        const uSnap = await getDoc(doc(db, 'users', String(referredId)));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (uData.photo_url) {
            photoUrl = uData.photo_url;
            setDoc(d.ref, { photo_url: photoUrl }, { merge: true }).catch(() => {});
          }
        }
      } catch (_) {}
    }

    const name = data.referred_name || (data.referred_username ? `@${data.referred_username}` : `Miner #${data.referred_id}`);
    return {
      id: referredId,
      name,
      username: data.referred_username || '',
      photo_url: photoUrl,
      joined_at: data.created_at,
      bonus_coins: Number(data.bonus_coins || refBonus),
      speed_boost: Number(data.speed_boost || refBoost)
    };
  }));

  const totalInvited = Math.max(Number(userData.referral_count || 0), friends.length);
  const totalBoostEarned = Number((totalInvited * refBoost).toFixed(2));
  const referralLink = `https://t.me/Elite_Force_Official_Mining_bot?start=ref_${userId}`;

  return {
    referral_link: referralLink,
    total_invited: totalInvited,
    speed_boost_earned: totalBoostEarned,
    bonus_per_friend: refBonus,
    boost_per_friend: refBoost,
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
        eforce_balance: Number(data.eforce_balance || 0),
        speed_per_hr: Number(data.speed_per_hr || BASE_MINING_RATE),
        referral_count: Number(data.referral_count || 0),
        is_admin: false,
        photo_url: data.photo_url || undefined,
        is_banned: Boolean(data.is_banned),
        ban_reason: data.ban_reason || '',
        banned_at: data.banned_at || '',
        has_started_bot: Boolean(data.has_started_bot),
        has_force_joined: Boolean(data.has_force_joined)
      });
    }
  });
}

// ==========================================
// 9. ADMIN PANEL DIRECT FIRESTORE HELPERS
// ==========================================

// Fetch real Telegram user profile photo via Bot API
export async function getTelegramUserPhoto(userId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const data = await res.json();
    if (data.ok && data.result && data.result.total_count > 0) {
      const photos = data.result.photos[0];
      const photo = photos[photos.length - 1];
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`).then(r => r.json());
      if (fileRes.ok && fileRes.result?.file_path) {
        return `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`;
      }
    }
  } catch (e) {
    console.warn('Could not fetch Telegram photo for user', userId, e);
  }
  return null;
}

// Fetch aggregate statistics from Cloud Firestore
export async function getAdminStatsFirestore() {
  try {
    const [usersSnap, tasksSnap, userTasksSnap, referralsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'tasks')),
      getDocs(collection(db, 'user_tasks')),
      getDocs(collection(db, 'referrals'))
    ]);

    let totalMinedTokens = 0;
    usersSnap.forEach(d => {
      totalMinedTokens += Number(d.data().balance || 0);
    });

    return {
      totalUsers: usersSnap.size,
      totalMinedTokens: Number(totalMinedTokens.toFixed(4)),
      activeTasks: tasksSnap.size,
      completedTasks: userTasksSnap.size,
      totalReferrals: referralsSnap.size
    };
  } catch (err) {
    console.warn('getAdminStatsFirestore error:', err);
    return {
      totalUsers: 0,
      totalMinedTokens: 0,
      activeTasks: 0,
      completedTasks: 0,
      totalReferrals: 0
    };
  }
}

// Fetch all users with search filter
export async function getAdminUsersFirestore(search?: string) {
  try {
    const snap = await getDocs(collection(db, 'users'));
    let users = snap.docs.map(d => d.data());

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      users = users.filter(u => 
        String(u.id).includes(q) || 
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.first_name && u.first_name.toLowerCase().includes(q))
      );
    }

    return users.sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
  } catch (err) {
    console.warn('getAdminUsersFirestore error:', err);
    return [];
  }
}

// Ban or unban user in Firestore
export async function adminBanUserFirestore(userId: number, ban: boolean, reason?: string) {
  const userRef = doc(db, 'users', String(userId));
  await setDoc(userRef, {
    is_banned: ban,
    ban_reason: ban ? (reason || 'Violating platform fair-use policy or terms of service.') : null,
    banned_at: ban ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }, { merge: true });
}

// Boost user speed and add bonus coins
export async function adminBoostUserFirestore(userId: number, addSpeed: number, addCoins: number) {
  const userRef = doc(db, 'users', String(userId));
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User not found');

  const data = snap.data();
  const currentSpeed = Number(data.speed_per_hr || BASE_MINING_RATE);
  const currentBalance = Number(data.balance || 0);

  const newSpeed = Number((currentSpeed + addSpeed).toFixed(4));
  const newBalance = Number((currentBalance + addCoins).toFixed(4));

  await setDoc(userRef, {
    speed_per_hr: newSpeed,
    balance: newBalance,
    updated_at: new Date().toISOString()
  }, { merge: true });

  return { newSpeed, newBalance };
}

// Create a new task in Firestore
export async function adminCreateTaskFirestore(taskData: {
  title: string;
  description: string;
  reward_coins: number;
  speed_boost: number;
  task_type: 'standard' | 'special';
  action_type: 'link' | 'telegram' | 'ad';
  link: string;
  ad_required: boolean;
  wait_time_sec: number;
}) {
  const taskId = String(Date.now());
  const taskRef = doc(db, 'tasks', taskId);
  const newTask = {
    ...taskData,
    id: taskId,
    created_at: new Date().toISOString()
  };
  await setDoc(taskRef, newTask);
  return newTask;
}

// Delete a task in Firestore
export async function adminDeleteTaskFirestore(taskId: string | number) {
  const taskRef = doc(db, 'tasks', String(taskId));
  await deleteDoc(taskRef);
}

// Direct Telegram Bot Broadcast from client via official Telegram Bot API
export async function adminBroadcastFirestore(
  messageText: string,
  photoUrl?: string,
  onProgress?: (sent: number, total: number) => void
) {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => d.data()).filter(u => !u.is_banned);

  const total = users.length;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const u = users[i];
    try {
      if (photoUrl && photoUrl.trim()) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: u.id,
            photo: photoUrl.trim(),
            caption: messageText,
            parse_mode: 'HTML'
          })
        });
      } else {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: u.id,
            text: messageText,
            parse_mode: 'HTML'
          })
        });
      }
      sent++;
    } catch (e) {
      failed++;
    }

    if (onProgress) {
      onProgress(sent, total);
    }

    // Sleep 40ms to stay within Telegram rate limits (~25-30 msgs/sec)
    await new Promise(r => setTimeout(r, 40));
  }

  return { total, sent, failed };
}

export const DEFAULT_FORCE_JOIN_ITEMS: ForceJoinItem[] = [
  {
    id: 'channel_official',
    name: 'Official Announcement Channel',
    type: 'channel',
    username_or_id: '@Elite_Force_Channel',
    invite_link: 'https://t.me/Elite_Force_Channel'
  },
  {
    id: 'group_official',
    name: 'Official Community Group',
    type: 'group',
    username_or_id: '@Elite_Force_Group',
    invite_link: 'https://t.me/Elite_Force_Group'
  }
];

export interface AppSettings {
  monetag_zone_id?: string;
  monetag_enabled?: boolean;
  gigapub_app_id?: string;
  gigapub_enabled?: boolean;
  withdraw_fee_percent?: number;
  min_withdraw_amount?: number;
  withdraw_enabled?: boolean;
  bep20_contract_address?: string;
  blockchain_network?: 'testnet' | 'mainnet';
  auto_approve_enabled?: boolean;
  scan_refer_code_onchain?: boolean;
  payout_private_key?: string;

  // Mining Engine Protocol Settings
  base_mining_rate?: number;
  referral_speed_boost?: number;
  referral_coin_bonus?: number;
  session_duration_hours?: number;

  // Anti-Cheat & Security Firewall Settings
  anti_cheat_enabled?: boolean;
  auto_ban_multi_account?: boolean;
  auto_ban_multi_ip?: boolean;
  max_accounts_per_device?: number;
  max_accounts_per_ip?: number;
  max_ips_per_account?: number;

  // Force Joining System Settings
  force_join_enabled?: boolean;
  force_join_items?: ForceJoinItem[];

  // Token Swapping Protocol Settings
  swap_enabled?: boolean;
  swap_rate?: number;
  min_swap_points?: number;
}

export async function getAppSettings(): Promise<AppSettings> {
  const defaultContract = '0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90';
  try {
    const snap = await getDoc(doc(db, 'settings', 'config'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        monetag_zone_id: data.monetag_zone_id || '11941636',
        monetag_enabled: data.monetag_enabled !== false,
        gigapub_app_id: data.gigapub_app_id || '8451',
        gigapub_enabled: data.gigapub_enabled !== false,
        withdraw_fee_percent: data.withdraw_fee_percent !== undefined ? Number(data.withdraw_fee_percent) : 5,
        min_withdraw_amount: data.min_withdraw_amount !== undefined ? Number(data.min_withdraw_amount) : 50,
        withdraw_enabled: data.withdraw_enabled !== false,
        bep20_contract_address: data.bep20_contract_address || defaultContract,
        blockchain_network: data.blockchain_network || 'testnet',
        auto_approve_enabled: data.auto_approve_enabled !== false,
        scan_refer_code_onchain: data.scan_refer_code_onchain !== false,
        payout_private_key: data.payout_private_key || '',
        base_mining_rate: data.base_mining_rate !== undefined ? Number(data.base_mining_rate) : 0.5,
        referral_speed_boost: data.referral_speed_boost !== undefined ? Number(data.referral_speed_boost) : 0.05,
        referral_coin_bonus: data.referral_coin_bonus !== undefined ? Number(data.referral_coin_bonus) : 10.0,
        session_duration_hours: data.session_duration_hours !== undefined ? Number(data.session_duration_hours) : 24,

        // Anti-Cheat parameters
        anti_cheat_enabled: data.anti_cheat_enabled !== false,
        auto_ban_multi_account: data.auto_ban_multi_account !== false,
        auto_ban_multi_ip: data.auto_ban_multi_ip !== false,
        max_accounts_per_device: data.max_accounts_per_device !== undefined ? Number(data.max_accounts_per_device) : 1,
        max_accounts_per_ip: data.max_accounts_per_ip !== undefined ? Number(data.max_accounts_per_ip) : 2,
        max_ips_per_account: data.max_ips_per_account !== undefined ? Number(data.max_ips_per_account) : 4,

        // Force Join parameters
        force_join_enabled: data.force_join_enabled !== undefined ? Boolean(data.force_join_enabled) : true,
        force_join_items: Array.isArray(data.force_join_items) && data.force_join_items.length > 0 
          ? data.force_join_items 
          : DEFAULT_FORCE_JOIN_ITEMS,

        // Token Swapping Protocol Settings
        swap_enabled: data.swap_enabled !== false,
        swap_rate: data.swap_rate !== undefined ? Number(data.swap_rate) : 1000,
        min_swap_points: data.min_swap_points !== undefined ? Number(data.min_swap_points) : 1000
      };
    }
  } catch (e) {
    console.warn('Failed to load app settings from firestore:', e);
  }

  // Fallback to localStorage or defaults
  const localMonetagZone = localStorage.getItem('eforce_monetag_zone_id') || '11941636';
  const localMonetagEnabled = localStorage.getItem('eforce_monetag_enabled') !== 'false';
  const localAppId = localStorage.getItem('eforce_gigapub_app_id') || '8451';
  const localEnabled = localStorage.getItem('eforce_gigapub_enabled') !== 'false';
  const localFee = localStorage.getItem('eforce_withdraw_fee') ? Number(localStorage.getItem('eforce_withdraw_fee')) : 5;
  const localMin = localStorage.getItem('eforce_min_withdraw') ? Number(localStorage.getItem('eforce_min_withdraw')) : 50;
  const localContract = localStorage.getItem('eforce_bep20_contract') || defaultContract;
  const localNet = (localStorage.getItem('eforce_blockchain_network') as any) || 'testnet';
  const localAutoApprove = localStorage.getItem('eforce_auto_approve') !== 'false';
  const localScanRefer = localStorage.getItem('eforce_scan_refer') !== 'false';
  const localBaseRate = localStorage.getItem('eforce_base_rate') ? Number(localStorage.getItem('eforce_base_rate')) : 0.5;
  const localRefBoost = localStorage.getItem('eforce_ref_boost') ? Number(localStorage.getItem('eforce_ref_boost')) : 0.05;
  const localRefBonus = localStorage.getItem('eforce_ref_bonus') ? Number(localStorage.getItem('eforce_ref_bonus')) : 10.0;
  const localDuration = localStorage.getItem('eforce_session_hours') ? Number(localStorage.getItem('eforce_session_hours')) : 24;

  const localAntiCheat = localStorage.getItem('eforce_anti_cheat') !== 'false';
  const localAutoBanMulti = localStorage.getItem('eforce_auto_ban_multi') !== 'false';
  const localAutoBanIp = localStorage.getItem('eforce_auto_ban_ip') !== 'false';
  const localMaxDev = localStorage.getItem('eforce_max_dev') ? Number(localStorage.getItem('eforce_max_dev')) : 1;
  const localMaxIp = localStorage.getItem('eforce_max_ip') ? Number(localStorage.getItem('eforce_max_ip')) : 2;
  const localMaxIpsAcc = localStorage.getItem('eforce_max_ips_acc') ? Number(localStorage.getItem('eforce_max_ips_acc')) : 4;

  return {
    monetag_zone_id: localMonetagZone,
    monetag_enabled: localMonetagEnabled,
    gigapub_app_id: localAppId,
    gigapub_enabled: localEnabled,
    withdraw_fee_percent: localFee,
    min_withdraw_amount: localMin,
    withdraw_enabled: localStorage.getItem('eforce_withdraw_enabled') !== 'false',
    bep20_contract_address: localContract,
    blockchain_network: localNet,
    auto_approve_enabled: localAutoApprove,
    scan_refer_code_onchain: localScanRefer,
    payout_private_key: '',
    base_mining_rate: localBaseRate,
    referral_speed_boost: localRefBoost,
    referral_coin_bonus: localRefBonus,
    session_duration_hours: localDuration,

    anti_cheat_enabled: localAntiCheat,
    auto_ban_multi_account: localAutoBanMulti,
    auto_ban_multi_ip: localAutoBanIp,
    max_accounts_per_device: localMaxDev,
    max_accounts_per_ip: localMaxIp,
    max_ips_per_account: localMaxIpsAcc,
    force_join_enabled: true,
    force_join_items: DEFAULT_FORCE_JOIN_ITEMS
  };
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    const ref = doc(db, 'settings', 'config');
    await setDoc(ref, settings, { merge: true });

    // Save to localStorage cache as well
    if (settings.base_mining_rate !== undefined) localStorage.setItem('eforce_base_rate', String(settings.base_mining_rate));
    if (settings.referral_speed_boost !== undefined) localStorage.setItem('eforce_ref_boost', String(settings.referral_speed_boost));
    if (settings.referral_coin_bonus !== undefined) localStorage.setItem('eforce_ref_bonus', String(settings.referral_coin_bonus));
    if (settings.session_duration_hours !== undefined) localStorage.setItem('eforce_session_hours', String(settings.session_duration_hours));

    if (settings.anti_cheat_enabled !== undefined) localStorage.setItem('eforce_anti_cheat', String(settings.anti_cheat_enabled));
    if (settings.auto_ban_multi_account !== undefined) localStorage.setItem('eforce_auto_ban_multi', String(settings.auto_ban_multi_account));
    if (settings.auto_ban_multi_ip !== undefined) localStorage.setItem('eforce_auto_ban_ip', String(settings.auto_ban_multi_ip));
    if (settings.max_accounts_per_device !== undefined) localStorage.setItem('eforce_max_dev', String(settings.max_accounts_per_device));
    if (settings.max_accounts_per_ip !== undefined) localStorage.setItem('eforce_max_ip', String(settings.max_accounts_per_ip));
    if (settings.max_ips_per_account !== undefined) localStorage.setItem('eforce_max_ips_acc', String(settings.max_ips_per_account));
  } catch (e) {
    console.warn('Failed to save settings to firestore:', e);
  }

  if (settings.withdraw_enabled !== undefined) {
    localStorage.setItem('eforce_withdraw_enabled', String(settings.withdraw_enabled));
  }
  if (settings.monetag_zone_id !== undefined) {
    localStorage.setItem('eforce_monetag_zone_id', settings.monetag_zone_id);
  }
  if (settings.monetag_enabled !== undefined) {
    localStorage.setItem('eforce_monetag_enabled', String(settings.monetag_enabled));
  }
  if (settings.gigapub_app_id !== undefined) {
    localStorage.setItem('eforce_gigapub_app_id', settings.gigapub_app_id);
  }
  if (settings.gigapub_enabled !== undefined) {
    localStorage.setItem('eforce_gigapub_enabled', String(settings.gigapub_enabled));
  }
  if (settings.withdraw_fee_percent !== undefined) {
    localStorage.setItem('eforce_withdraw_fee', String(settings.withdraw_fee_percent));
  }
  if (settings.min_withdraw_amount !== undefined) {
    localStorage.setItem('eforce_min_withdraw', String(settings.min_withdraw_amount));
  }
  if (settings.bep20_contract_address !== undefined) {
    localStorage.setItem('eforce_bep20_contract', settings.bep20_contract_address);
  }
  if (settings.blockchain_network !== undefined) {
    localStorage.setItem('eforce_blockchain_network', settings.blockchain_network);
  }
  if (settings.auto_approve_enabled !== undefined) {
    localStorage.setItem('eforce_auto_approve', String(settings.auto_approve_enabled));
  }
  if (settings.scan_refer_code_onchain !== undefined) {
    localStorage.setItem('eforce_scan_refer', String(settings.scan_refer_code_onchain));
  }
}

// Real-time listener for app configuration updates
export function subscribeToAppSettingsFirestore(callback: (settings: AppSettings) => void) {
  const ref = doc(db, 'settings', 'config');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const defaultContract = '0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90';
      const settings: AppSettings = {
        monetag_zone_id: data.monetag_zone_id || '11941636',
        monetag_enabled: data.monetag_enabled !== false,
        gigapub_app_id: data.gigapub_app_id || '8451',
        gigapub_enabled: data.gigapub_enabled !== false,
        withdraw_fee_percent: data.withdraw_fee_percent !== undefined ? Number(data.withdraw_fee_percent) : 5,
        min_withdraw_amount: data.min_withdraw_amount !== undefined ? Number(data.min_withdraw_amount) : 50,
        withdraw_enabled: data.withdraw_enabled !== false,
        bep20_contract_address: data.bep20_contract_address || defaultContract,
        blockchain_network: data.blockchain_network || 'testnet',
        auto_approve_enabled: data.auto_approve_enabled !== false,
        scan_refer_code_onchain: data.scan_refer_code_onchain !== false,
        payout_private_key: data.payout_private_key || '',
        base_mining_rate: data.base_mining_rate !== undefined ? Number(data.base_mining_rate) : 0.5,
        referral_speed_boost: data.referral_speed_boost !== undefined ? Number(data.referral_speed_boost) : 0.05,
        referral_coin_bonus: data.referral_coin_bonus !== undefined ? Number(data.referral_coin_bonus) : 10.0,
        session_duration_hours: data.session_duration_hours !== undefined ? Number(data.session_duration_hours) : 24,
        anti_cheat_enabled: data.anti_cheat_enabled !== false,
        auto_ban_multi_account: data.auto_ban_multi_account !== false,
        auto_ban_multi_ip: data.auto_ban_multi_ip !== false,
        max_accounts_per_device: data.max_accounts_per_device !== undefined ? Number(data.max_accounts_per_device) : 1,
        max_accounts_per_ip: data.max_accounts_per_ip !== undefined ? Number(data.max_accounts_per_ip) : 2,
        max_ips_per_account: data.max_ips_per_account !== undefined ? Number(data.max_ips_per_account) : 4,
        force_join_enabled: data.force_join_enabled !== undefined ? Boolean(data.force_join_enabled) : true,
        force_join_items: Array.isArray(data.force_join_items) && data.force_join_items.length > 0 
          ? data.force_join_items 
          : DEFAULT_FORCE_JOIN_ITEMS,
        swap_enabled: data.swap_enabled !== false,
        swap_rate: data.swap_rate !== undefined ? Number(data.swap_rate) : 1000,
        min_swap_points: data.min_swap_points !== undefined ? Number(data.min_swap_points) : 1000
      };
      if (settings.withdraw_enabled !== undefined) {
        localStorage.setItem('eforce_withdraw_enabled', String(settings.withdraw_enabled));
      }
      callback(settings);
    }
  });
}

// ==========================================
// WITHDRAWAL REQUEST MANAGEMENT
// ==========================================

export async function createWithdrawalFirestore(params: {
  userId: number;
  userName: string;
  username: string;
  walletAddress: string;
  referCode: string;
  amount: number;
  feePercent: number;
}): Promise<{ withdrawal: WithdrawalRequest; newBalance: number }> {
  const { userId, userName, username, walletAddress, referCode, amount, feePercent } = params;

  // Validation
  const cleanAddr = walletAddress.trim();
  if (!cleanAddr.startsWith('0x') || cleanAddr.length !== 42) {
    throw new Error('Please enter a valid 42-character BEP20 wallet address (starting with 0x).');
  }

  const cleanCode = referCode.trim();
  if (!cleanCode || cleanCode.length !== 6) {
    throw new Error('Please enter a valid 6-digit Elite Force refer code.');
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Please enter a valid withdrawal amount.');
  }

  // Check admin global withdrawal status
  const settings = await getAppSettings();
  if (settings.withdraw_enabled === false) {
    throw new Error('Withdrawals are temporarily disabled by the administrator. Please try again later.');
  }

  // Check user balance in Firestore
  const userRef = doc(db, 'users', String(userId));
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error('User profile not found.');
  }

  const userData = userSnap.data();
  const currentBalance = Number(userData.eforce_balance !== undefined ? userData.eforce_balance : (userData.balance || 0));

  if (currentBalance < amount) {
    throw new Error(`Insufficient E-FORCE tokens! Your balance is ${currentBalance.toFixed(2)} E-FORCE. Please swap your points to E-FORCE first in the Swap tab.`);
  }

  // Check minimum withdrawal
  const minAmount = settings.min_withdraw_amount || 50;
  if (amount < minAmount) {
    throw new Error(`Minimum withdrawal amount is ${minAmount} E-FORCE.`);
  }

  // Calculate Fee & Net Amount
  const feeRate = feePercent !== undefined ? feePercent : (settings.withdraw_fee_percent || 5);
  const feeAmount = Number(((amount * feeRate) / 100).toFixed(4));
  const netAmount = Number((amount - feeAmount).toFixed(4));

  const docId = `wd_${Date.now()}_${userId}`;
  const now = new Date().toISOString();

  // Blockchain Auto-Verification Check
  let onchainVerified = false;
  let autoApprovedStatus: 'pending' | 'completed' = 'pending';
  let txHash: string | undefined;
  let adminNote: string | undefined;

  try {
    const { verifyWalletAndReferCodeOnChain } = await import('./blockchain');
    const verRes = await verifyWalletAndReferCodeOnChain({
      walletAddress: cleanAddr,
      referCode: cleanCode,
      contractAddress: settings.bep20_contract_address || '0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90',
      network: settings.blockchain_network || 'testnet'
    });

    onchainVerified = verRes.verified;
    adminNote = verRes.details;

    // Check if Auto-Approve & Auto-Payout with Hot Wallet is enabled
    if (settings.auto_approve_enabled && settings.payout_private_key) {
      try {
        const { executeAutoTokenPayout } = await import('./blockchain');
        const payoutRes = await executeAutoTokenPayout({
          privateKey: settings.payout_private_key,
          tokenAddress: settings.bep20_contract_address || '0x292c6f3a5645343cdd26f71a84ee29aa1d6c5a90',
          recipientAddress: cleanAddr,
          amount: netAmount,
          network: settings.blockchain_network || 'testnet'
        });

        if (payoutRes.success) {
          autoApprovedStatus = 'completed';
          txHash = payoutRes.txHash;
          adminNote = `Auto-paid on-chain via Hot Wallet. Tx: ${txHash}`;
        }
      } catch (payoutErr: any) {
        console.warn('Auto-payout execution fallback to manual pending:', payoutErr);
        adminNote = `On-chain verified. Auto-payout pending admin review: ${payoutErr.message}`;
      }
    } else if (settings.auto_approve_enabled && onchainVerified) {
      adminNote = `On-chain BEP20 address & refer code verified on ${settings.blockchain_network || 'testnet'}. Ready for payout.`;
    }
  } catch (verifyErr) {
    console.warn('On-chain verification error:', verifyErr);
  }

  const withdrawal: WithdrawalRequest = {
    id: docId,
    user_id: userId,
    user_name: userName || 'Miner',
    username: username || '',
    wallet_address: cleanAddr,
    refer_code: cleanCode,
    amount: Number(amount),
    fee_percent: Number(feeRate),
    fee_amount: feeAmount,
    net_amount: netAmount,
    status: autoApprovedStatus,
    created_at: now,
    updated_at: now,
    onchain_verified: onchainVerified,
    network: settings.blockchain_network || 'testnet',
    tx_hash: txHash,
    admin_note: adminNote
  };

  // 1. Deduct token balance from user
  const newBalance = Number((currentBalance - amount).toFixed(4));
  const updatePayload: any = { eforce_balance: newBalance, updated_at: now };
  if (userData.eforce_balance === undefined) {
    updatePayload.balance = newBalance;
  }
  await setDoc(userRef, updatePayload, { merge: true });

  // 2. Save withdrawal record
  await setDoc(doc(db, 'withdrawals', docId), withdrawal);

  return { withdrawal, newBalance };
}

export async function getUserWithdrawalsFirestore(userId: number): Promise<WithdrawalRequest[]> {
  try {
    const q = query(collection(db, 'withdrawals'), where('user_id', '==', Number(userId)));
    const snap = await getDocs(q);
    const list: WithdrawalRequest[] = [];
    snap.forEach(d => {
      list.push(d.data() as WithdrawalRequest);
    });
    // Sort client-side by created_at desc
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    console.warn('Error fetching user withdrawals:', e);
    return [];
  }
}

export async function getAllWithdrawalsFirestore(): Promise<WithdrawalRequest[]> {
  try {
    const snap = await getDocs(collection(db, 'withdrawals'));
    const list: WithdrawalRequest[] = [];
    snap.forEach(d => {
      list.push(d.data() as WithdrawalRequest);
    });
    // Sort client-side by created_at desc
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    console.warn('Error fetching all withdrawals for admin:', e);
    return [];
  }
}

export async function adminUpdateWithdrawalStatusFirestore(
  withdrawalId: string,
  newStatus: 'pending' | 'completed' | 'rejected',
  adminNote?: string,
  txHash?: string
): Promise<void> {
  const wdRef = doc(db, 'withdrawals', withdrawalId);
  const wdSnap = await getDoc(wdRef);
  if (!wdSnap.exists()) {
    throw new Error('Withdrawal record not found.');
  }

  const wd = wdSnap.data() as WithdrawalRequest;
  const now = new Date().toISOString();

  // If rejecting a previously pending withdrawal, refund user's balance!
  if (wd.status === 'pending' && newStatus === 'rejected') {
    const userRef = doc(db, 'users', String(wd.user_id));
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const refundedBalance = Number(((uData.balance || 0) + wd.amount).toFixed(4));
      await setDoc(userRef, { balance: refundedBalance, updated_at: now }, { merge: true });
    }
  }

  await setDoc(
    wdRef,
    {
      status: newStatus,
      admin_note: adminNote || '',
      updated_at: now,
      ...(txHash ? { tx_hash: txHash } : {})
    },
    { merge: true }
  );
}

// 12. Wipe/Clear All User Data from Cloud Firestore (Users, Mining Sessions, User Tasks, Referrals, Withdrawals)
export async function clearAllUserDataFirestore(): Promise<{ success: boolean; deletedSummary: Record<string, number> }> {
  const collectionsToWipe = ['users', 'user_tasks', 'mining_sessions', 'referrals', 'withdrawals', 'swaps'];
  const deletedSummary: Record<string, number> = {};

  for (const colName of collectionsToWipe) {
    try {
      const snap = await getDocs(collection(db, colName));
      let count = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const d of snap.docs) {
        batch.delete(d.ref);
        batchCount++;
        count++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      deletedSummary[colName] = count;
    } catch (e: any) {
      console.warn(`Error wiping collection ${colName}:`, e.message);
      deletedSummary[colName] = 0;
    }
  }

  return { success: true, deletedSummary };
}

// ==========================================
// 13. TOKEN SWAPPING PROTOCOL (POINTS -> E-FORCE)
// ==========================================

export async function swapPointsToTokensFirestore(userId: number, pointsToSwap: number): Promise<{
  success: boolean;
  pointsSwapped: number;
  tokensReceived: number;
  newPoints: number;
  newTokens: number;
}> {
  const points = Number(pointsToSwap);
  if (isNaN(points) || points <= 0) {
    throw new Error('Please enter a valid points amount to swap.');
  }

  const settings = await getAppSettings();
  if (settings.swap_enabled === false) {
    throw new Error('Token swapping is currently paused by the administrator.');
  }

  const minPoints = settings.min_swap_points !== undefined ? Number(settings.min_swap_points) : 1000;
  if (points < minPoints) {
    throw new Error(`Minimum points required to swap is ${minPoints.toLocaleString()} Points.`);
  }

  const swapRate = settings.swap_rate !== undefined ? Number(settings.swap_rate) : 1000;
  if (swapRate <= 0) {
    throw new Error('Invalid swap rate configuration.');
  }

  const tokensToReceive = Number((points / swapRate).toFixed(4));
  if (tokensToReceive <= 0) {
    throw new Error('Points amount is too low to produce tokens.');
  }

  const userRef = doc(db, 'users', String(userId));
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error('User profile not found.');
  }

  const userData = userSnap.data();
  const currentPoints = Number(userData.balance || 0);

  if (currentPoints < points) {
    throw new Error(`Insufficient Points! You have ${currentPoints.toLocaleString()} Points, but requested to swap ${points.toLocaleString()} Points.`);
  }

  const newPoints = Number((currentPoints - points).toFixed(4));
  const currentTokens = Number(userData.eforce_balance || 0);
  const newTokens = Number((currentTokens + tokensToReceive).toFixed(4));
  const now = new Date().toISOString();

  // Atomically update user doc
  await updateDoc(userRef, {
    balance: newPoints,
    eforce_balance: newTokens,
    updated_at: now
  });

  // Record transaction in swaps collection
  try {
    await addDoc(collection(db, 'swaps'), {
      user_id: Number(userId),
      user_name: userData.first_name || 'Miner',
      username: userData.username || '',
      points_swapped: points,
      tokens_received: tokensToReceive,
      swap_rate: swapRate,
      created_at: now
    });
  } catch (logErr) {
    console.warn('Failed to record swap transaction log:', logErr);
  }

  return {
    success: true,
    pointsSwapped: points,
    tokensReceived: tokensToReceive,
    newPoints,
    newTokens
  };
}

export async function getUserSwapsFirestore(userId: number): Promise<SwapRecord[]> {
  try {
    const q = query(
      collection(db, 'swaps'),
      where('user_id', '==', Number(userId)),
      limit(25)
    );
    const snap = await getDocs(q);
    const list: SwapRecord[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        user_id: Number(data.user_id),
        points_swapped: Number(data.points_swapped || 0),
        tokens_received: Number(data.tokens_received || 0),
        swap_rate: Number(data.swap_rate || 1000),
        created_at: data.created_at || new Date().toISOString()
      });
    });
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    console.warn('Failed to fetch user swaps:', e);
    return [];
  }
}

export async function getAllSwapsFirestore(): Promise<SwapRecord[]> {
  try {
    const snap = await getDocs(query(collection(db, 'swaps'), limit(100)));
    const list: SwapRecord[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        user_id: Number(data.user_id),
        points_swapped: Number(data.points_swapped || 0),
        tokens_received: Number(data.tokens_received || 0),
        swap_rate: Number(data.swap_rate || 1000),
        created_at: data.created_at || new Date().toISOString()
      });
    });
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    console.warn('Failed to fetch all swaps:', e);
    return [];
  }
}

export async function updateSwapSettingsFirestore(settings: {
  swap_enabled: boolean;
  swap_rate: number;
  min_swap_points: number;
}): Promise<void> {
  await setDoc(doc(db, 'settings', 'config'), {
    swap_enabled: settings.swap_enabled,
    swap_rate: Number(settings.swap_rate),
    min_swap_points: Number(settings.min_swap_points),
    updated_at: new Date().toISOString()
  }, { merge: true });
}

