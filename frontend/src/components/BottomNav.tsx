import React from 'react';
import { motion } from 'framer-motion';
import { Pickaxe, CheckSquare, Users, Trophy, ShieldAlert } from 'lucide-react';
import { tg } from '../services/telegram';

export type TabType = 'mining' | 'tasks' | 'friends' | 'leaderboard' | 'admin';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isAdmin: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, isAdmin }) => {
  const tabs = [
    { id: 'mining' as TabType, label: 'Mining', icon: Pickaxe },
    { id: 'tasks' as TabType, label: 'Tasks', icon: CheckSquare },
    { id: 'friends' as TabType, label: 'Friends', icon: Users },
    { id: 'leaderboard' as TabType, label: 'Rank', icon: Trophy },
    ...(isAdmin ? [{ id: 'admin' as TabType, label: 'Admin', icon: ShieldAlert }] : []),
  ];

  const handleTabClick = (tabId: TabType) => {
    tg.haptic.selection();
    onSelectTab(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0C0D14]/95 backdrop-blur-xl border-t border-white/10 px-3 py-2 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="relative flex flex-col items-center justify-center py-1 px-3 min-w-[56px] transition-colors focus:outline-none"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-gradient-to-t from-orange-500/25 to-transparent rounded-xl border-t-2 border-brand-orange"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}

              <div className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  size={20}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-brand-orange drop-shadow-[0_0_8px_rgba(255,102,0,0.6)]' : 'text-gray-400 hover:text-white'
                  }`}
                />
                <span
                  className={`text-[10px] font-semibold tracking-tight transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
