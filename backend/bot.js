import { Bot, InlineKeyboard } from 'grammy';
import { config, isAdmin } from './config.js';
import { db } from './db/index.js';
import { firestoreDB } from './firebase.js';

let bot = null;

export function initBot() {
  const isValidFormat = config.BOT_TOKEN && /^\d+:[A-Za-z0-9_-]+$/.test(config.BOT_TOKEN);
  if (!isValidFormat) {
    console.warn('⚠️ BOT_TOKEN is empty or placeholder (needs format 123456:ABC...). grammY bot is in standby mode.');
    return null;
  }

  try {
    bot = new Bot(config.BOT_TOKEN);

    // /start command with referral handler
    bot.command('start', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const userId = from.id;
      const username = from.username || '';
      const firstName = from.first_name || '';
      const lastName = from.last_name || '';

      // Check referral payload (e.g. /start ref_123456789)
      const payload = ctx.match ? ctx.match.trim() : '';
      let referrerId = null;
      if (payload.startsWith('ref_')) {
        const parsed = parseInt(payload.replace('ref_', ''), 10);
        if (!isNaN(parsed) && parsed !== userId) {
          referrerId = parsed;
        }
      }

      // Check if user already exists in SQLite and Cloud Firestore
      let existingSqliteUser = null;
      try {
        existingSqliteUser = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
      } catch (_) {}

      let existingFirestoreUser = await firestoreDB.getUser(userId);

      // Determine effective referrer
      const effectiveReferrerId = referrerId || existingFirestoreUser?.referred_by || existingSqliteUser?.referred_by || null;

      // 1. Ensure user is registered in SQLite
      if (!existingSqliteUser) {
        try {
          await db.run(`
            INSERT INTO users (id, username, first_name, last_name, balance, speed_per_hr, referred_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [userId, username, firstName, lastName, 0.0, config.BASE_MINING_RATE, effectiveReferrerId]);
        } catch (_) {}
      }

      // 2. Ensure user is registered/updated in Cloud Firestore
      try {
        await firestoreDB.setUser(userId, {
          username,
          first_name: firstName,
          last_name: lastName,
          has_started_bot: true,
          ...(existingFirestoreUser ? {} : {
            balance: 0.0,
            speed_per_hr: config.BASE_MINING_RATE,
            referral_count: 0
          }),
          ...(effectiveReferrerId ? { referred_by: effectiveReferrerId } : {}),
          is_banned: false
        });
      } catch (fErr) {
        console.warn('Firestore bot sync error:', fErr.message);
      }

      // 3. Process referral reward if effectiveReferrerId is valid
      if (effectiveReferrerId && effectiveReferrerId !== userId) {
        try {
          const alreadyReferred = await firestoreDB.hasReferral(effectiveReferrerId, userId);
          if (!alreadyReferred) {
            // Fetch referrer from Firestore first, then fallback to SQLite
            const referrerFirestore = await firestoreDB.getUser(effectiveReferrerId);
            let referrerSqlite = null;
            try {
              referrerSqlite = await db.get('SELECT * FROM users WHERE id = $1', [effectiveReferrerId]);
            } catch (_) {}

            if (referrerFirestore || referrerSqlite) {
              const currentCount = Number(referrerFirestore?.referral_count || referrerSqlite?.referral_count || 0);
              const currentSpeed = Number(referrerFirestore?.speed_per_hr || referrerSqlite?.speed_per_hr || config.BASE_MINING_RATE);
              const currentBal = Number(referrerFirestore?.balance || referrerSqlite?.balance || 0);

              const newReferralCount = currentCount + 1;
              const newSpeed = Number((currentSpeed + config.REFERRAL_SPEED_BOOST).toFixed(4));
              const newBalance = Number((currentBal + config.REFERRAL_COIN_BONUS).toFixed(4));

              // Update Cloud Firestore
              await firestoreDB.setUser(effectiveReferrerId, {
                referral_count: newReferralCount,
                speed_per_hr: newSpeed,
                balance: newBalance
              });
              await firestoreDB.addReferral(
                effectiveReferrerId, 
                userId, 
                config.REFERRAL_COIN_BONUS, 
                config.REFERRAL_SPEED_BOOST,
                firstName || 'Miner',
                username || ''
              );

              // Update SQLite if available
              try {
                await db.run(`
                  UPDATE users 
                  SET referral_count = $1, speed_per_hr = $2, balance = $3 
                  WHERE id = $4
                `, [newReferralCount, newSpeed, newBalance, effectiveReferrerId]);

                await db.run(`
                  INSERT INTO referrals (referrer_id, referred_id, bonus_coins, speed_boost)
                  VALUES ($1, $2, $3, $4)
                `, [effectiveReferrerId, userId, config.REFERRAL_COIN_BONUS, config.REFERRAL_SPEED_BOOST]);
              } catch (_) {}

              // Send instant DM notification to referrer
              try {
                await bot.api.sendMessage(
                  effectiveReferrerId,
                  `🎉 <b>New Referral Joined!</b>\n\n` +
                  `<b>${firstName || 'Miner'}</b> (@${username || 'hidden'}) just started mining using your link!\n\n` +
                  `⚡ <b>Rewards Unlocked:</b>\n` +
                  `• +${config.REFERRAL_SPEED_BOOST} E-FORCE/hr Mining Speed Boost\n` +
                  `• +${config.REFERRAL_COIN_BONUS} E-FORCE Instant Bonus\n\n` +
                  `Keep sharing to accelerate your 24H mining output! 🚀`,
                  { parse_mode: 'HTML' }
                );
              } catch (err) {
                console.warn(`Could not send referral notification to ${effectiveReferrerId}:`, err.message);
              }
            }
          }
        } catch (rErr) {
          console.warn('Bot referral credit error:', rErr);
        }
      }

      // Dynamic Web App launch button with referral payload attached
      const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';
      const launchUrl = effectiveReferrerId 
        ? `${webAppUrl}?startapp=ref_${effectiveReferrerId}&tgWebAppStartParam=ref_${effectiveReferrerId}`
        : webAppUrl;

      const keyboard = new InlineKeyboard()
        .webApp('⚡ Launch E-FORCE App', launchUrl);

      if (config.CHANNEL_URL || config.COMMUNITY_URL) {
        keyboard.row();
        if (config.CHANNEL_URL) {
          keyboard.url('📢 Official Channel', config.CHANNEL_URL);
        }
        if (config.COMMUNITY_URL) {
          keyboard.url('👥 Community Chat', config.COMMUNITY_URL);
        }
      }

      const welcomeCaption = 
        `⚔️ <b>WELCOME TO E-FORCE MINING</b> ⚔️\n\n` +
        `Empowering decentralized micro-nodes with our <b>24-Hour Limited Mining Program</b>.\n\n` +
        `💎 <b>How it works:</b>\n` +
        `1. Tap <b>Launch E-FORCE App</b> below\n` +
        `2. Activate your <b>24H Energy Reactor</b>\n` +
        `3. Complete Tasks & Ads to supercharge speed\n` +
        `4. Invite friends to multiply your hourly rate\n\n` +
        `🔥 <i>Current Base Speed:</i> <b>${config.BASE_MINING_RATE} E-FORCE/hr</b>\n` +
        `⏱️ <i>Session Duration:</i> <b>24 Hours cycle</b>`;

      await ctx.reply(welcomeCaption, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    });

    // /stats command
    bot.command('stats', async (ctx) => {
      const user = await db.get('SELECT * FROM users WHERE id = $1', [ctx.from.id]);
      if (!user) {
        return ctx.reply('Please tap /start first to initialize your account!');
      }

      ctx.reply(
        `📊 <b>Your Mining Statistics:</b>\n\n` +
        `💰 <b>Balance:</b> ${Number(user.balance).toFixed(4)} E-FORCE\n` +
        `⚡ <b>Mining Rate:</b> ${Number(user.speed_per_hr).toFixed(4)} /hr\n` +
        `👥 <b>Friends Invited:</b> ${user.referral_count || 0}\n` +
        `🛡️ <b>Status:</b> ${user.is_banned ? '⛔ Banned' : '🟢 Active Miner'}`,
        { parse_mode: 'HTML' }
      );
    });

    // /withdraw command with admin turn OFF/ON control
    bot.command('withdraw', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const userIsAdmin = isAdmin(from.id);
      const arg = ctx.match ? ctx.match.trim().toLowerCase() : '';

      if (userIsAdmin && (arg === 'off' || arg === 'pause' || arg === 'disable' || arg === 'false')) {
        await firestoreDB.updateSettings({ withdraw_enabled: false });
        const kb = new InlineKeyboard().text('🟢 Turn ON Withdrawals', 'admin_withdraw_on');
        return ctx.reply(
          `🔴 <b>Withdrawals Disabled / Turned OFF!</b>\n\n` +
          `User withdrawals have been temporarily paused across the platform.\n` +
          `Miners will not be able to submit new withdrawal requests until you re-enable it.`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }

      if (userIsAdmin && (arg === 'on' || arg === 'resume' || arg === 'enable' || arg === 'true')) {
        await firestoreDB.updateSettings({ withdraw_enabled: true });
        const kb = new InlineKeyboard().text('🔴 Turn OFF Withdrawals', 'admin_withdraw_off');
        return ctx.reply(
          `🟢 <b>Withdrawals Enabled / Turned ON!</b>\n\n` +
          `User withdrawals are now active. Miners can submit withdrawal requests to BEP20 addresses.`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }

      // Default info / status
      const settings = await firestoreDB.getSettings();
      const isEnabled = settings.withdraw_enabled !== false;

      if (userIsAdmin) {
        const kb = new InlineKeyboard()
          .text(isEnabled ? '🔴 Turn OFF Withdrawals' : '🟢 Turn ON Withdrawals', isEnabled ? 'admin_withdraw_off' : 'admin_withdraw_on')
          .row()
          .webApp('⚡ Open Admin Panel', config.MINI_APP_URL ? `${config.MINI_APP_URL}?admin=true` : 'https://e-force-bot.web.app?admin=true');

        return ctx.reply(
          `⚙️ <b>Withdrawal Gateway Admin Control:</b>\n\n` +
          `• <b>Current Status:</b> ${isEnabled ? '🟢 ACTIVE / ENABLED' : '🔴 PAUSED / DISABLED'}\n` +
          `• <b>Min Withdrawal:</b> ${settings.min_withdraw_amount || 50} E-FORCE\n` +
          `• <b>Fee Rate:</b> ${settings.withdraw_fee_percent || 5}%\n\n` +
          `Tap the button below or use:\n` +
          `<code>/withdraw off</code> - To pause withdrawals\n` +
          `<code>/withdraw on</code> - To resume withdrawals`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      } else {
        const webAppUrl = config.MINI_APP_URL || 'https://e-force-bot.web.app';
        const kb = new InlineKeyboard().webApp('💳 Open Withdrawal Page', webAppUrl);
        return ctx.reply(
          `💳 <b>E-FORCE Withdrawal Status:</b>\n\n` +
          `• <b>Status:</b> ${isEnabled ? '🟢 Withdrawals Active' : '🔴 Withdrawals Temporarily Paused by Admin'}\n` +
          `• <b>Minimum Payout:</b> ${settings.min_withdraw_amount || 50} E-FORCE\n` +
          `• <b>Network:</b> BSC (BEP20)\n\n` +
          (isEnabled 
            ? `You can request a withdrawal directly inside the Mini App:` 
            : `⚠️ Withdrawals are temporarily paused for maintenance/review. Please check back later.`),
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }
    });

    bot.command('withdraw_off', async (ctx) => {
      if (!ctx.from || !isAdmin(ctx.from.id)) return;
      await firestoreDB.updateSettings({ withdraw_enabled: false });
      const kb = new InlineKeyboard().text('🟢 Turn ON Withdrawals', 'admin_withdraw_on');
      return ctx.reply(
        `🔴 <b>Withdrawals Disabled / Turned OFF!</b>\n\n` +
        `User withdrawals have been paused. Miners cannot submit new withdrawal requests.`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    });

    bot.command('withdraw_on', async (ctx) => {
      if (!ctx.from || !isAdmin(ctx.from.id)) return;
      await firestoreDB.updateSettings({ withdraw_enabled: true });
      const kb = new InlineKeyboard().text('🔴 Turn OFF Withdrawals', 'admin_withdraw_off');
      return ctx.reply(
        `🟢 <b>Withdrawals Enabled / Turned ON!</b>\n\n` +
        `User withdrawals are now live. Miners can submit withdrawal requests.`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    });

    // Callback query handler for admin inline toggle
    bot.callbackQuery(/^admin_withdraw_(on|off)$/, async (ctx) => {
      if (!ctx.from || !isAdmin(ctx.from.id)) {
        return ctx.answerCallbackQuery({ text: 'Access denied: Admin only!', show_alert: true });
      }

      const turnOn = ctx.match[1] === 'on';
      await firestoreDB.updateSettings({ withdraw_enabled: turnOn });

      await ctx.answerCallbackQuery({ 
        text: turnOn ? '🟢 Withdrawals ENABLED!' : '🔴 Withdrawals DISABLED!', 
        show_alert: false 
      });

      const kb = new InlineKeyboard()
        .text(turnOn ? '🔴 Turn OFF Withdrawals' : '🟢 Turn ON Withdrawals', turnOn ? 'admin_withdraw_off' : 'admin_withdraw_on')
        .row()
        .webApp('⚡ Open Admin Panel', config.MINI_APP_URL ? `${config.MINI_APP_URL}?admin=true` : 'https://e-force-bot.web.app?admin=true');

      try {
        await ctx.editMessageText(
          `⚙️ <b>Withdrawal Gateway Admin Control:</b>\n\n` +
          `• <b>Current Status:</b> ${turnOn ? '🟢 ACTIVE / ENABLED' : '🔴 PAUSED / DISABLED'}\n\n` +
          `Status updated live across the platform and Telegram bot.`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      } catch (_) {}
    });

    // Launch bot
    bot.start({
      onStart: (botInfo) => {
        console.log(`grammY Bot @${botInfo.username} started successfully!`);
      }
    }).catch((err) => {
      console.warn('grammY bot polling error:', err.message);
    });

    return bot;
  } catch (error) {
    console.error('Error starting grammY bot:', error.message);
    return null;
  }
}

// Function to broadcast message to all users
export async function broadcastMessage(text, photoUrl = null) {
  if (!bot) {
    throw new Error('Bot is not initialized. Please configure BOT_TOKEN in .env');
  }

  const users = await db.all('SELECT id FROM users WHERE is_banned = 0 OR is_banned IS FALSE');
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      if (photoUrl) {
        await bot.api.sendPhoto(user.id, photoUrl, { caption: text, parse_mode: 'HTML' });
      } else {
        await bot.api.sendMessage(user.id, text, { parse_mode: 'HTML' });
      }
      sent++;
      // Sleep 35ms to respect Telegram 30 msg/sec rate limit
      await new Promise(r => setTimeout(r, 35));
    } catch (e) {
      failed++;
    }
  }

  return { total: users.length, sent, failed };
}

export function getBot() {
  return bot;
}

// Auto-start bot if executed directly (e.g. node backend/bot.js or npm run bot)
import { fileURLToPath } from 'url';
import path from 'path';

if (process.argv[1]) {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    if (path.resolve(process.argv[1]) === path.resolve(currentFile)) {
      initBot();
    }
  } catch (_) {}
}
