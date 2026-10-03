export interface User {
  id: number;
  username: string;
  first_name: string;
  balance: number;
  speed_per_hr: number;
  referral_count: number;
  is_admin: boolean;
  photo_url?: string;
  is_banned?: boolean;
  ban_reason?: string;
  banned_at?: string;
  current_ip?: string;
  ip_history?: string[];
  device_id?: string;
}

export interface MiningState {
  status: 'idle' | 'mining' | 'claimable';
  is_mining: boolean;
  speed_per_hr: number;
  session_hours: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  progress_percent: number;
  mined_unclaimed: number;
  total_balance: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  reward_coins: number;
  speed_boost: number;
  task_type: 'standard' | 'special';
  action_type: 'link' | 'telegram' | 'ad' | 'daily';
  link: string;
  channel_username?: string;
  ad_required: boolean;
  wait_time_sec: number;
  is_completed?: boolean;
}

export interface ReferralFriend {
  name: string;
  username: string;
  joined_at: string;
  bonus_coins: number;
  speed_boost: number;
}

export interface ReferralData {
  referral_link: string;
  total_invited: number;
  speed_boost_earned: number;
  bonus_per_friend: number;
  boost_per_friend: number;
  friends: ReferralFriend[];
}

export interface LeaderboardUser {
  rank: number;
  id: number;
  name: string;
  balance: number;
  speed: number;
  referrals: number;
  photo_url?: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: number;
  user_name: string;
  username: string;
  wallet_address: string;
  refer_code: string;
  amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  updated_at?: string;
  tx_hash?: string;
  admin_note?: string;
  onchain_verified?: boolean;
  network?: 'testnet' | 'mainnet';
}

export interface AdminStats {
  totalUsers: number;
  totalMinedTokens: number;
  activeTasks: number;
  completedTasks: number;
  totalReferrals: number;
}

export type TabType = 'mining' | 'tasks' | 'withdraw' | 'friends' | 'leaderboard';

declare global {
  interface Window {
    show_11941636?: (param?: any) => Promise<void>;
    showGiga?: () => Promise<void>;
  }
}
