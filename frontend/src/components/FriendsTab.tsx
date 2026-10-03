import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Copy, Check, Share2, Zap, Gift, Sparkles, UserPlus } from 'lucide-react';
import type { ReferralData, ReferralFriend } from '../types';
import type { AppSettings } from '../services/firestore';
import { getTelegramUserPhoto } from '../services/firestore';
import { tg } from '../services/telegram';

const FriendAvatar: React.FC<{ friend: ReferralFriend }> = ({ friend }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(friend.photo_url || null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (friend.photo_url) {
      setImgSrc(friend.photo_url);
      return;
    }

    if (friend.id) {
      const cached = localStorage.getItem(`tg_photo_${friend.id}`);
      if (cached) {
        setImgSrc(cached);
        return;
      }

      getTelegramUserPhoto(friend.id)
        .then((url) => {
          if (url) {
            localStorage.setItem(`tg_photo_${friend.id}`, url);
            setImgSrc(url);
          }
        })
        .catch(() => {});
    }
  }, [friend.id, friend.photo_url]);

  const fallbackUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(friend.name || String(friend.id || 'friend'))}&backgroundColor=181824`;

  return (
    <div className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-brand-orange via-amber-400 to-orange-500 shrink-0 shadow-[0_0_8px_rgba(255,102,0,0.25)] flex items-center justify-center">
      <img
        src={!imgError && imgSrc ? imgSrc : fallbackUrl}
        alt={friend.name}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover rounded-full select-none bg-[#181824]"
        loading="lazy"
      />
    </div>
  );
};

interface FriendsTabProps {
  referrals: ReferralData | null;
  appSettings?: AppSettings | null;
  onRefresh: () => void;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({ referrals, appSettings }) => {
  const [copied, setCopied] = useState(false);

  const refBoostRate = appSettings?.referral_speed_boost ?? 0.05;
  const refBonusCoins = appSettings?.referral_coin_bonus ?? 10.0;
  const sessionHours = appSettings?.session_duration_hours ?? 24;

  const referralLink = referrals?.referral_link || 'https://t.me/Elite_Force_Official_Mining_bot?start=ref_miner';

  const handleCopy = () => {
    tg.haptic.impact('medium');
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = () => {
    tg.haptic.impact('heavy');
    const shareText = encodeURIComponent(
      `⚔️ Join my squad on E-FORCE!\n` +
      `Start ${sessionHours}-Hour limited mining and get +${refBonusCoins} POINTS + mining speed boost on sign-up! 🚀`
    );
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
    tg.openTelegramLink(tgShareUrl);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-24">
      {/* 3D Visual Hero Card */}
      <div className="relative overflow-hidden rounded-3xl p-5 mb-5 bg-gradient-to-br from-[#161724] to-[#0D0E16] border border-orange-500/30 shadow-orange-glow">
        <div className="flex items-center justify-between">
          <div className="max-w-[65%]">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
              REFERRAL MULTIPLIER
            </span>
            <h2 className="text-xl font-black text-white mt-1.5 leading-tight">
              Invite Friends & Accelerate Speed
            </h2>
            <p className="text-xs text-gray-300 mt-1">
              Every active referral grants you <span className="text-brand-orange font-bold">+{refBoostRate.toFixed(2)} PTS/hr</span> boost!
            </p>
          </div>

          {/* 3D Spinning Logo Video */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden p-[1px] bg-gradient-to-tr from-brand-orange to-white/40 shadow-orange-glow shrink-0">
            <div className="w-full h-full rounded-[15px] overflow-hidden bg-black">
              <video
                src="/Change_video_logo_background_colors_20261002102002.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-brand-orange flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <div className="text-base font-extrabold text-white">
                {referrals?.total_invited || 0}
              </div>
              <div className="text-[10px] text-gray-400">Total Referrals</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-brand-orange flex items-center justify-center shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <div className="text-base font-extrabold text-brand-orange">
                +{referrals?.speed_boost_earned ? referrals.speed_boost_earned.toFixed(2) : '0.00'}/hr
              </div>
              <div className="text-[10px] text-gray-400">Mining Speed Boost</div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Actions */}
      <div className="space-y-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleShare}
          className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-black bg-gradient-to-r from-white via-orange-100 to-brand-orange shadow-orange-glow flex items-center justify-center gap-2"
        >
          <Share2 size={18} />
          <span>INVITE FRIENDS ON TELEGRAM</span>
        </motion.button>

        <div className="flex items-center gap-2">
          <div className="flex-1 px-3.5 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300 truncate">
            {referralLink}
          </div>
          <button
            onClick={handleCopy}
            className={`px-4 py-3 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 ${
              copied
                ? 'bg-green-500/20 border-green-500/40 text-green-300'
                : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tiered Rewards Overview */}
      <div className="glass-panel p-4 rounded-2xl mb-6 border border-white/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-brand-orange" />
          <span>Reward Perks per Friend</span>
        </h3>

        <div className="space-y-2.5">
          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-brand-orange flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={15} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">+{refBoostRate.toFixed(2)} E-FORCE / hr Permanent Boost</div>
              <div className="text-[11px] text-gray-400">
                Directly added to your {sessionHours}H mining reactor engine speed for each referred user.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-white/5">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 mt-0.5">
              <Gift size={15} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">+{refBonusCoins.toFixed(2)} Points Instant Bonus</div>
              <div className="text-[11px] text-gray-400">
                Instantly credited to your balance the moment your friend activates their mini app.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Friends List */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5 px-1 flex items-center justify-between">
          <span>Invited Miners</span>
          <span className="text-orange-400">{referrals?.friends?.length || 0} Friends</span>
        </h3>

        {referrals?.friends && referrals.friends.length > 0 ? (
          <div className="space-y-2">
            {referrals.friends.map((friend, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <FriendAvatar friend={friend} />
                  <div>
                    <div className="text-xs font-bold text-white">{friend.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {friend.username ? `@${friend.username}` : 'Telegram User'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-brand-orange">+{friend.bonus_coins} Points</div>
                  <div className="text-[10px] text-green-400 font-semibold">+{friend.speed_boost} PTS/hr Boost</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center flex flex-col items-center">
            <UserPlus size={32} className="text-gray-500 mb-2" />
            <span className="text-xs font-bold text-gray-300">No Friends Invited Yet</span>
            <span className="text-[11px] text-gray-500 mt-1 max-w-[220px]">
              Share your invite link above to boost your mining speed!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
