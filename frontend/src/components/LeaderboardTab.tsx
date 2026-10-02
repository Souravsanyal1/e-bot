import React from 'react';
import { Trophy, Medal, Zap, Crown } from 'lucide-react';
import type { LeaderboardUser, User } from '../types';

interface LeaderboardTabProps {
  topMiners: LeaderboardUser[];
  currentUser: User | null;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ topMiners, currentUser }) => {
  const top1 = topMiners[0];
  const top2 = topMiners[1];
  const top3 = topMiners[2];
  const rest = topMiners.slice(3);

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-24">
      {/* Header */}
      <div className="text-center my-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold mb-2">
          <Trophy size={14} />
          <span>Hall of Fame</span>
        </div>
        <h2 className="text-xl font-black text-white">Top 24H Miners</h2>
        <p className="text-xs text-gray-400 mt-0.5">Global leaders by total mined E-FORCE tokens</p>
      </div>

      {/* Top 3 Podium */}
      {topMiners.length >= 3 && (
        <div className="flex items-end justify-center gap-2 my-6 pt-6">
          {/* Rank 2 */}
          <div className="flex flex-col items-center w-24">
            <div className="relative mb-2">
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-gray-300 to-gray-600 flex items-center justify-center">
                <div className="w-full h-full bg-[#181824] rounded-full flex items-center justify-center text-sm font-extrabold text-white">
                  {top2.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-400 text-black font-black text-[11px] flex items-center justify-center border-2 border-[#0A0A0F]">
                2
              </div>
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[85px]">{top2.name}</span>
            <span className="text-[11px] font-mono text-orange-400 font-bold">{top2.balance.toFixed(2)}</span>
            <div className="w-full h-20 bg-white/5 border-t border-gray-400/40 rounded-t-xl mt-2 flex items-center justify-center">
              <Medal size={20} className="text-gray-300" />
            </div>
          </div>

          {/* Rank 1 (Center, Tallest) */}
          <div className="flex flex-col items-center w-28 -mt-6">
            <Crown size={22} className="text-yellow-400 mb-1 animate-bounce" />
            <div className="relative mb-2">
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-300 via-amber-400 to-orange-500 shadow-orange-glow flex items-center justify-center">
                <div className="w-full h-full bg-[#181824] rounded-full flex items-center justify-center text-base font-extrabold text-white">
                  {top1.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-yellow-400 text-black font-black text-xs flex items-center justify-center border-2 border-[#0A0A0F]">
                1
              </div>
            </div>
            <span className="text-xs font-extrabold text-white truncate max-w-[100px]">{top1.name}</span>
            <span className="text-xs font-mono text-yellow-300 font-extrabold">{top1.balance.toFixed(2)}</span>
            <div className="w-full h-28 bg-gradient-to-b from-orange-500/20 to-white/5 border-t-2 border-yellow-400 rounded-t-xl mt-2 flex items-center justify-center shadow-orange-glow">
              <Trophy size={24} className="text-yellow-400" />
            </div>
          </div>

          {/* Rank 3 */}
          <div className="flex flex-col items-center w-24">
            <div className="relative mb-2">
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-amber-700 to-yellow-900 flex items-center justify-center">
                <div className="w-full h-full bg-[#181824] rounded-full flex items-center justify-center text-sm font-extrabold text-white">
                  {top3.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-600 text-black font-black text-[11px] flex items-center justify-center border-2 border-[#0A0A0F]">
                3
              </div>
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[85px]">{top3.name}</span>
            <span className="text-[11px] font-mono text-orange-400 font-bold">{top3.balance.toFixed(2)}</span>
            <div className="w-full h-16 bg-white/5 border-t border-amber-600/40 rounded-t-xl mt-2 flex items-center justify-center">
              <Medal size={20} className="text-amber-600" />
            </div>
          </div>
        </div>
      )}

      {/* Ranked List */}
      <div className="space-y-2 mt-2">
        {rest.map((miner) => (
          <div
            key={miner.id}
            className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
              currentUser?.id === miner.id
                ? 'bg-orange-500/20 border-orange-500/40 shadow-sm'
                : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-xs font-mono font-bold text-gray-400">
                #{miner.rank}
              </span>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                {miner.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{miner.name}</div>
                <div className="text-[10px] text-orange-400 flex items-center gap-0.5">
                  <Zap size={10} /> {miner.speed.toFixed(2)}/hr
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono font-extrabold text-white">
                {miner.balance.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 font-semibold uppercase">E-FORCE</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
