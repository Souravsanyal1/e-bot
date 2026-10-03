import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  user: User | null;
  activeSpeed: number;
}

export const Navbar: React.FC<NavbarProps> = ({ user, activeSpeed }) => {
  return (
    <header className="sticky top-0 z-40 w-full px-4 py-3 bg-[#0A0A0F]/85 backdrop-blur-md border-b border-white/10">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand & User Identity */}
        <div className="flex items-center gap-3 select-none flex-1 min-w-0 mr-2">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden p-[1px] bg-gradient-to-tr from-brand-orange to-white/40 shadow-orange-glow shrink-0">
            <div className="w-full h-full bg-[#12131A] rounded-[11px] flex items-center justify-center overflow-hidden">
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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wide text-white">E-FORCE</span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 truncate">
              <span className="truncate max-w-[120px] text-gray-300 font-medium">{user?.first_name || 'Miner'}</span>
              {user?.username && <span className="text-gray-500 shrink-0">@{user.username}</span>}
            </div>
          </div>
        </div>

        {/* Live Mining Speed Chip */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/15 to-orange-400/5 border border-orange-500/30 shadow-sm"
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Zap size={14} className="text-brand-orange fill-brand-orange" />
          </motion.div>
          <span className="text-xs font-bold text-white tracking-tight">
            +{activeSpeed.toFixed(2)}
            <span className="text-[10px] text-orange-300/80 font-normal"> /hr</span>
          </span>
        </motion.div>
      </div>
    </header>
  );
};
