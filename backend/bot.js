import { Bot, InlineKeyboard } from 'grammy';
import { config, isAdmin } from './config.js';
import { db } from './db/index.js';

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

      // Check if user already exists
      let existingUser = await db.get('SELECT * FROM users WHERE id = $1', [userId]);

      if (!existingUser) {
        // Register new user
        await db.run(`
          INSERT INTO users (id, username, first_name, last_name, balance, speed_per_hr, referred_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [userId, username, firstName, lastName, 0.0, config.BASE_MINING_RATE, referrerId]);

        // Process referral if applicable
        if (referrerId) {
          const referrer = await db.get('SELECT * FROM users WHERE id = $1', [referrerId]);
          if (referrer) {
            // Give referrer speed boost + bonus coins
            const newReferralCount = (referrer.referral_count || 0) + 1;
            const newSpeed = Number(referrer.speed_per_hr || config.BASE_MINING_RATE) + config.REFERRAL_SPEED_BOOST;
            const newBalance = Number(referrer.balance || 0) + config.REFERRAL_COIN_BONUS;

            await db.run(`
              UPDATE users 
              SET referral_count = $1, speed_per_hr = $2, balance = $3 
              WHERE id = $4
            `, [newReferralCount, newSpeed, newBalance, referrerId]);

            // Record referral log
            await db.run(`
              INSERT INTO referrals (referrer_id, referred_id, bonus_coins, speed_boost)
              VALUES ($1, $2, $3, $4)
            `, [referrerId, userId, config.REFERRAL_COIN_BONUS, config.REFERRAL_SPEED_BOOST]);

            // Send instant DM notification to referrer
            try {
              await bot.api.sendMessage(
                referrerId,
                `🎉 <b>New Referral Joined!</b>\n\n` +
                `<b>${firstName}</b> (@${username || 'hidden'}) just started mining using your link!\n\n` +
                `⚡ <b>Rewards Unlocked:</b>\n` +
                `• +${config.REFERRAL_SPEED_BOOST} E-FORCE/hr Mining Speed Boost\n` +
                `• +${config.REFERRAL_COIN_BONUS} E-FORCE Instant Bonus\n\n` +
                `Keep sharing to accelerate your 24H mining output! 🚀`,
                { parse_mode: 'HTML' }
              );
            } catch (err) {
              console.warn(`Could not send referral notification to ${referrerId}:`, err.message);
            }
          }
        }
      }

      // Dynamic Web App launch button
      const webAppUrl = config.MINI_APP_URL.startsWith('http') 
        ? config.MINI_APP_URL 
        : `https://t.me/eforce_mining_bot/app`;

      const keyboard = new InlineKeyboard()
        .webApp('⚡ Launch E-FORCE App', webAppUrl)
        .row()
        .url('📢 Official Channel', 'https://t.me/telegram')
        .url('👥 Community Chat', 'https://t.me/telegram');

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
