import { InlineKeyboard } from 'grammy';
import { getBot } from '../bot.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { firestore } from '../firebase.js';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Robust helper to send Telegram HTML messages with optional inline keyboard
 */
export async function sendTelegramMessage(chatId, text, keyboard = null) {
  const bot = getBot();
  if (!bot) {
    console.warn(`[Notification] Bot not initialized. Skipping message to ${chatId}`);
    return false;
  }

  try {
    const options = { parse_mode: 'HTML' };
    if (keyboard) {
      options.reply_markup = keyboard;
    }
    await bot.api.sendMessage(chatId, text, options);
    return true;
  } catch (err) {
    console.warn(`[Notification] Could not send message to chatId ${chatId}:`, err.message);
    return false;
  }
}

/**
 * 1. Mining Finished Notification (Sent automatically when 24h cycle finishes)
 */
export async function sendMiningFinishedNotification(userId, data = {}) {
  const { name = 'Miner', amount = 0, speed = config.BASE_MINING_RATE } = data;
  const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';

  const keyboard = new InlineKeyboard()
    .webApp('⚡ Claim & Restart Mining', webAppUrl);

  const text = 
    `⚡ <b>Mining Cycle Completed!</b> ⚡\n\n` +
    `Hello <b>${name}</b>! Your <b>24-Hour Mining Reactor</b> has successfully completed its run!\n\n` +
    `💎 <b>Mined Yield:</b> <b>+${Number(amount).toFixed(4)} E-FORCE</b>\n` +
    `⚡ <b>Engine Rate:</b> <b>${Number(speed).toFixed(2)} E-FORCE/hr</b>\n\n` +
    `⚠️ <i>Your reactor is now paused. Tap the button below to claim your rewards and kickstart your next 24-hour cycle!</i> 🚀`;

  return await sendTelegramMessage(userId, text, keyboard);
}

/**
 * 2. Mining Claimed Notification (Sent when tokens are claimed)
 */
export async function sendMiningClaimedNotification(userId, data = {}) {
  const { claimedAmount = 0, newBalance = 0 } = data;
  const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';

  const keyboard = new InlineKeyboard()
    .webApp('⚡ Open E-FORCE App', webAppUrl);

  const text = 
    `🎉 <b>Mining Claimed Successfully!</b> 💎\n\n` +
    `You have successfully claimed <b>+${Number(claimedAmount).toFixed(4)} E-FORCE</b> into your account!\n\n` +
    `💰 <b>Total Balance:</b> <b>${Number(newBalance).toFixed(4)} E-FORCE</b>\n` +
    `⚡ <b>Status:</b> 🟢 Active (Fresh 24H cycle is running)\n\n` +
    `Keep climbing the global leaderboard! 🏆`;

  return await sendTelegramMessage(userId, text, keyboard);
}

/**
 * 3. Task Completed Notification (Sent when user finishes a task)
 */
export async function sendTaskCompletedNotification(userId, data = {}) {
  const {
    taskTitle = 'Mission Task',
    rewardCoins = 0,
    speedBoost = 0,
    newBalance = null,
    newSpeed = null
  } = data;
  const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';

  const keyboard = new InlineKeyboard()
    .webApp('⚡ Open E-FORCE App', webAppUrl);

  let text = 
    `🎯 <b>Task Completed!</b> 🎯\n\n` +
    `Awesome job! You have successfully completed:\n` +
    `✨ <b>${taskTitle}</b>\n\n` +
    `🎁 <b>Rewards Unlocked:</b>\n` +
    `• <b>+${Number(rewardCoins).toFixed(2)} E-FORCE</b> bonus coins\n` +
    `• <b>+${Number(speedBoost).toFixed(2)}/hr</b> permanent speed boost\n`;

  if (newBalance !== null) {
    text += `\n💰 <b>New Balance:</b> ${Number(newBalance).toFixed(4)} E-FORCE`;
  }
  if (newSpeed !== null) {
    text += `\n⚡ <b>New Mining Rate:</b> ${Number(newSpeed).toFixed(2)} E-FORCE/hr`;
  }

  text += `\n\nKeep completing tasks & ads to turbocharge your yield! 🚀`;

  return await sendTelegramMessage(userId, text, keyboard);
}

/**
 * 4. Withdrawal Submitted Notification (Sent to user & admins)
 */
export async function sendWithdrawalSubmittedNotification(data) {
  const {
    userId,
    userName = 'Miner',
    username = '',
    amount = 0,
    feeAmount = 0,
    feePercent = 5,
    netAmount = 0,
    walletAddress = '',
    referCode = ''
  } = data;

  const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';
  const keyboard = new InlineKeyboard().webApp('⚡ View in App', webAppUrl);

  // 1. Notify User
  const userText = 
    `💳 <b>Withdrawal Request Received</b> 💳\n\n` +
    `Hello <b>${userName}</b>, your withdrawal request has been submitted to the admin team:\n\n` +
    `💰 <b>Requested Amount:</b> <b>${Number(amount).toFixed(2)} E-FORCE</b>\n` +
    `📉 <b>Fee (${feePercent}%):</b> ${Number(feeAmount).toFixed(4)} E-FORCE\n` +
    `💵 <b>Net Payout:</b> <b>${Number(netAmount).toFixed(4)} E-FORCE</b>\n` +
    `📍 <b>Destination (BEP20):</b>\n<code>${walletAddress}</code>\n` +
    `🔖 <b>Refer Code:</b> <code>${referCode}</code>\n` +
    `⏳ <b>Status:</b> <b>Pending Admin Review</b>\n\n` +
    `ℹ️ <i>Requests are processed within 1-12 hours. We will notify you here once it is paid!</i> 🚀`;

  await sendTelegramMessage(userId, userText, keyboard);

  // 2. Notify Admin(s)
  if (config.ADMIN_IDS && config.ADMIN_IDS.length > 0) {
    const adminText = 
      `🚨 <b>NEW WITHDRAWAL ALERT!</b> 🚨\n\n` +
      `👤 <b>User:</b> ${userName} (@${username || 'hidden'})\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `💰 <b>Gross Amount:</b> ${Number(amount).toFixed(2)} E-FORCE\n` +
      `💵 <b>Net Payout:</b> <b>${Number(netAmount).toFixed(4)} E-FORCE</b>\n` +
      `📍 <b>BEP20 Address:</b>\n<code>${walletAddress}</code>\n` +
      `🔖 <b>Refer Code:</b> <code>${referCode}</code>\n` +
      `🕒 <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
      `⚡ <i>Open the Admin Panel to review and execute payment.</i>`;

    for (const adminId of config.ADMIN_IDS) {
      if (adminId && adminId !== '999888777') {
        await sendTelegramMessage(adminId, adminText);
      }
    }
  }

  return true;
}

/**
 * 5. Withdrawal Status Changed (Approved / Paid / Rejected)
 */
export async function sendWithdrawalStatusNotification(data) {
  const {
    userId,
    status, // 'completed' | 'rejected'
    amount = 0,
    netAmount = 0,
    walletAddress = '',
    txHash = '',
    adminNote = ''
  } = data;

  const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';
  const keyboard = new InlineKeyboard().webApp('⚡ Open E-FORCE App', webAppUrl);

  if (status === 'completed') {
    let text = 
      `✅ <b>Withdrawal Approved & Sent!</b> 🎉\n\n` +
      `Great news! Your withdrawal has been approved and paid out:\n\n` +
      `💰 <b>Net Payout:</b> <b>${Number(netAmount || amount).toFixed(4)} E-FORCE</b>\n` +
      `📍 <b>Destination Wallet:</b>\n<code>${walletAddress}</code>\n`;

    if (txHash) {
      text += `\n🔗 <b>Transaction Hash:</b>\n<code>${txHash}</code>\n`;
    }
    if (adminNote) {
      text += `\n📝 <b>Note:</b> ${adminNote}\n`;
    }

    text += `\nThank you for mining with E-FORCE! 💎`;
    return await sendTelegramMessage(userId, text, keyboard);
  } else if (status === 'rejected') {
    let text = 
      `❌ <b>Withdrawal Request Rejected</b> ⚠️\n\n` +
      `Your withdrawal request of <b>${Number(amount).toFixed(2)} E-FORCE</b> could not be completed.\n`;

    if (adminNote) {
      text += `\n📝 <b>Reason:</b> ${adminNote}\n`;
    }

    text += 
      `\n💰 <b>Refund:</b> The full amount of <b>${Number(amount).toFixed(2)} E-FORCE</b> has been refunded to your app balance.\n\n` +
      `If you have any questions, please reach out in our official community channel.`;

    return await sendTelegramMessage(userId, text, keyboard);
  }

  return false;
}

/**
 * 6. Background Scheduler: Automatically checks completed 24H mining sessions
 * and triggers instant Telegram bot notifications to users!
 */
export function startMiningNotificationScheduler() {
  const sessionHours = config.SESSION_DURATION_HOURS || 24;
  const sessionMs = sessionHours * 3600 * 1000;

  console.log(`⏱️ Mining notification monitor started (checking every 30s for completed ${sessionHours}H cycles)...`);

  const checkMiningCycles = async () => {
    try {
      const now = Date.now();

      // A. Check SQLite / PostgreSQL Users
      try {
        const users = await db.all(`
          SELECT id, first_name, username, balance, speed_per_hr, mining_start_time, last_mining_notified_time 
          FROM users 
          WHERE mining_start_time IS NOT NULL
        `);

        for (const user of users) {
          if (!user.mining_start_time) continue;

          const startTime = new Date(user.mining_start_time).getTime();
          const elapsedMs = now - startTime;

          // Check if session duration reached
          if (elapsedMs >= sessionMs) {
            const lastNotified = user.last_mining_notified_time 
              ? new Date(user.last_mining_notified_time).getTime() 
              : 0;

            // Only notify if we haven't notified for this specific cycle yet
            if (lastNotified < startTime) {
              const speed = Number(user.speed_per_hr || config.BASE_MINING_RATE);
              const minedAmount = (sessionHours) * speed;

              console.log(`🔔 Sending mining completed notification to user ${user.id} (${user.first_name || user.username})`);

              await sendMiningFinishedNotification(user.id, {
                name: user.first_name || user.username || 'Miner',
                amount: minedAmount,
                speed: speed
              });

              // Mark as notified in SQLite
              const nowIso = new Date().toISOString();
              await db.run('UPDATE users SET last_mining_notified_time = $1 WHERE id = $2', [nowIso, user.id]);
            }
          }
        }
      } catch (sqlErr) {
        // SQLite query error handling
      }

      // B. Check Firestore Mining Sessions
      try {
        if (firestore) {
          const sessionsRef = collection(firestore, 'mining_sessions');
          const q = query(sessionsRef, where('status', '==', 'active'));
          const snap = await getDocs(q);

          for (const d of snap.docs) {
            const session = d.data();
            if (!session || !session.end_time || session.notified) continue;

            const endTime = new Date(session.end_time).getTime();
            if (now >= endTime) {
              const userId = session.user_id || Number(d.id);
              const speed = Number(session.base_speed || config.BASE_MINING_RATE);
              const minedAmount = sessionHours * speed;

              // Retrieve user name if available
              let userName = 'Miner';
              try {
                const uSnap = await getDoc(doc(firestore, 'users', String(userId)));
                if (uSnap.exists()) {
                  userName = uSnap.data().first_name || uSnap.data().username || 'Miner';
                }
              } catch (_) {}

              console.log(`🔔 [Firestore] Sending mining completed notification to user ${userId}`);

              await sendMiningFinishedNotification(userId, {
                name: userName,
                amount: minedAmount,
                speed: speed
              });

              // Mark session notified in Firestore
              await updateDoc(doc(firestore, 'mining_sessions', d.id), {
                notified: true,
                notified_at: new Date().toISOString()
              });
            }
          }
        }
      } catch (fErr) {
        // Firestore query error handling
      }

    } catch (err) {
      console.warn('Error in mining notification check cycle:', err.message);
    }
  };

  // Run initial check after 5 seconds, then every 30 seconds
  setTimeout(checkMiningCycles, 5000);
  return setInterval(checkMiningCycles, 30000);
}
