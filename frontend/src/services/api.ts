import { tg } from './telegram';
import type { User, MiningState, Task, ReferralData, LeaderboardUser, AdminStats } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const initData = tg.getInitData();
  const user = tg.getUser();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(initData ? { 'x-telegram-init-data': initData } : {}),
    ...(user?.id ? { 'x-dev-user-id': String(user.id) } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }

  return data as T;
}

export const api = {
  // User sync
  async syncUser(referrerId?: number): Promise<{ user: User; mining: MiningState; config: any }> {
    return request('/user/sync', {
      method: 'POST',
      body: JSON.stringify({ referrerId }),
    });
  },

  // Mining
  async startMining(): Promise<{ success: boolean; mining: MiningState }> {
    return request('/mining/start', { method: 'POST' });
  },

  async claimMining(): Promise<{ success: boolean; claimed_amount: number; new_balance: number; mining_state: MiningState }> {
    return request('/mining/claim', { method: 'POST' });
  },

  async getMiningStatus(): Promise<{ mining: MiningState; balance: number }> {
    return request('/mining/status');
  },

  // Tasks
  async getTasks(): Promise<{ standard: Task[]; special: Task[] }> {
    return request('/tasks');
  },

  async completeTask(taskId: number): Promise<{ success: boolean; rewardCoins: number; speedBoost: number; newBalance: number; newSpeed: number; message: string }> {
    return request('/tasks/complete', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  },

  // Referrals
  async getReferrals(): Promise<ReferralData> {
    return request('/referrals');
  },

  // Leaderboard
  async getLeaderboard(): Promise<{ topMiners: LeaderboardUser[] }> {
    return request('/leaderboard');
  },

  // Admin APIs
  admin: {
    async getStats(): Promise<AdminStats> {
      return request('/admin/stats');
    },

    async getTasks(): Promise<Task[]> {
      return request('/admin/tasks');
    },

    async createTask(taskData: Partial<Task>): Promise<{ success: boolean; message: string }> {
      return request('/admin/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    },

    async updateTask(id: number, taskData: Partial<Task>): Promise<{ success: boolean; message: string }> {
      return request(`/admin/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData),
      });
    },

    async deleteTask(id: number): Promise<{ success: boolean; message: string }> {
      return request(`/admin/tasks/${id}`, { method: 'DELETE' });
    },

    async broadcast(message: string, photoUrl?: string): Promise<{ success: boolean; total: number; sent: number; failed: number }> {
      return request('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ message, photoUrl }),
      });
    },

    async getUsers(search?: string): Promise<any[]> {
      return request(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    },

    async banUser(id: number, isBanned: boolean): Promise<{ success: boolean; message: string }> {
      return request(`/admin/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ is_banned: isBanned }),
      });
    },

    async boostUser(id: number, bonusSpeed: number, bonusCoins: number): Promise<{ success: boolean; message: string }> {
      return request(`/admin/users/${id}/boost`, {
        method: 'POST',
        body: JSON.stringify({ bonus_speed: bonusSpeed, bonus_coins: bonusCoins }),
      });
    }
  }
};
