import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, PlayCircle, Flame, ArrowUpRight, Send, Gem } from 'lucide-react';
import type { Task } from '../types';
import { tg } from '../services/telegram';
import { AdModal } from './AdModal';

declare global {
  interface Window {
    showGiga?: () => Promise<void>;
  }
}

interface TasksTabProps {
  standardTasks: Task[];
  specialTasks: Task[];
  onCompleteTask: (taskId: number) => Promise<void>;
  onRefresh: () => void;
}

// Visual Task Logo/Image Badge
const TaskBadgeIcon: React.FC<{ task: Task }> = ({ task }) => {
  const isTg = task.action_type === 'telegram' || (task.link && task.link.includes('t.me'));
  const isX = task.link && (task.link.includes('x.com') || task.link.includes('twitter.com'));
  const isTon = task.link && task.link.includes('ton.org');
  const isAd = task.ad_required || task.action_type === 'ad';

  if (isAd) {
    return (
      <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
        <img src="/katana_poster.png" alt="Ad Video" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <PlayCircle size={18} className="text-white fill-orange-500/80" />
        </div>
      </div>
    );
  }

  if (isTg) {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#229ED9]/20 border border-[#229ED9]/40 shrink-0 flex items-center justify-center shadow-sm">
        <Send size={18} className="text-[#229ED9] fill-[#229ED9] -translate-x-0.5" />
      </div>
    );
  }

  if (isX) {
    return (
      <div className="w-10 h-10 rounded-xl bg-black border border-white/20 shrink-0 flex items-center justify-center shadow-sm font-black text-white text-base">
        𝕏
      </div>
    );
  }

  if (isTon) {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#0098EA]/20 border border-[#0098EA]/40 shrink-0 flex items-center justify-center shadow-sm">
        <Gem size={18} className="text-[#0098EA]" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-brand-orange border border-orange-500/30 shrink-0 flex items-center justify-center shadow-sm">
      <Zap size={20} />
    </div>
  );
};

export const TasksTab: React.FC<TasksTabProps> = ({
  standardTasks,
  specialTasks,
  onCompleteTask,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'standard' | 'special'>('all');
  const [selectedAdTask, setSelectedAdTask] = useState<Task | null>(null);
  const [isAdOpen, setIsAdOpen] = useState<boolean>(false);
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);

  const handleTaskClick = async (task: Task) => {
    // If standard task is completed, return
    if (task.is_completed && !task.ad_required) return;

    tg.haptic.impact('medium');

    // DO task or Watch task: Trigger Monetag Ad first for ALL tasks!
    if (typeof window.show_11941636 === 'function') {
      setLoadingTaskId(task.id);
      try {
        // 1. Trigger official Monetag Rewarded Interstitial
        await window.show_11941636();
        if (task.link) {
          if (task.link.includes('t.me')) tg.openTelegramLink(task.link);
          else tg.openLink(task.link);
        }
        await handleAdFinished(task);
        return;
      } catch (adErr) {
        console.warn("Monetag rewarded interstitial failed, attempting popup:", adErr);
        try {
          // 2. Fallback to Monetag Rewarded Popup
          await window.show_11941636('pop');
          if (task.link) {
            if (task.link.includes('t.me')) tg.openTelegramLink(task.link);
            else tg.openLink(task.link);
          }
          await handleAdFinished(task);
          return;
        } catch (popErr) {
          console.warn("Monetag pop also failed, opening in-app player:", popErr);
        }
      } finally {
        setLoadingTaskId(null);
      }
    }

    // If external link, open it alongside the in-app ad
    if (task.link) {
      if (task.link.includes('t.me')) {
        tg.openTelegramLink(task.link);
      } else {
        tg.openLink(task.link);
      }
    }

    // 3. Fallback native in-app cyber video player modal (ensures ad ALWAYS plays)
    setSelectedAdTask(task);
    setIsAdOpen(true);
  };

  const handleAdFinished = async (task: Task) => {
    setLoadingTaskId(task.id);
    try {
      await onCompleteTask(task.id);
      tg.haptic.notification('success');
    } catch (e) {
      tg.haptic.notification('error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const displayedStandard = activeTab === 'all' || activeTab === 'standard' ? standardTasks : [];
  const displayedSpecial = activeTab === 'all' || activeTab === 'special' ? specialTasks : [];

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-24">
      {/* Header Banner */}
      <div className="glass-panel-orange p-4 rounded-2xl mb-4 border border-orange-500/30">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-brand-orange fill-brand-orange" />
          <h2 className="text-base font-extrabold text-white">Earn Coins & Speed Boosts</h2>
        </div>
        <p className="text-xs text-orange-200/80 leading-relaxed">
          Complete tasks and sponsored video ads to permanently increase your E-FORCE hourly mining yield!
        </p>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10 mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'all' ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          All ({standardTasks.length + specialTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'standard' ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          Standard ({standardTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('special')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'special' ? 'bg-brand-orange text-white shadow-sm' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Flame size={12} className="text-yellow-300" />
          <span>Special ({specialTasks.length})</span>
        </button>
      </div>

      {/* Special Tasks Section */}
      {displayedSpecial.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-2.5 px-1">
            <Flame size={16} className="text-brand-orange fill-brand-orange animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-400">
              High-Yield Special Tasks
            </h3>
          </div>

          <div className="space-y-2.5">
            {displayedSpecial.map((task) => (
              <motion.div
                key={task.id}
                whileTap={task.is_completed && !task.ad_required ? {} : { scale: 0.98 }}
                onClick={() => handleTaskClick(task)}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  task.is_completed && !task.ad_required
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-gradient-to-r from-orange-500/15 via-[#181826] to-[#12131A] border-orange-500/40 shadow-sm hover:border-orange-400'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    <TaskBadgeIcon task={task} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {task.ad_required && (
                      <div className="mb-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                          SPONSORED AD
                        </span>
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-white leading-snug line-clamp-2">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-tight">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        +{task.reward_coins} Coins
                      </span>
                      <span className="text-[11px] font-extrabold text-brand-orange flex items-center gap-0.5 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                        <Zap size={10} className="fill-brand-orange" /> +{task.speed_boost}/hr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status CTA */}
                <div className="shrink-0 self-center">
                  {task.is_completed && !task.ad_required ? (
                    <div className="flex items-center gap-1 text-green-400 font-bold text-xs bg-green-500/10 px-2.5 py-1 rounded-xl border border-green-500/20">
                      <CheckCircle2 size={14} /> Done
                    </div>
                  ) : (
                    <button
                      disabled={loadingTaskId === task.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-black bg-gradient-to-r from-white via-orange-100 to-brand-orange shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      {loadingTaskId === task.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : task.ad_required ? (
                        <>
                          <PlayCircle size={13} />
                          <span>{task.is_completed ? 'Watch Again' : 'Watch'}</span>
                        </>
                      ) : (
                        <>
                          <span>Start</span>
                          <ArrowUpRight size={13} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Standard Tasks Section */}
      {displayedStandard.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5 px-1">
            <CheckCircle2 size={16} className="text-gray-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Standard Community Tasks
            </h3>
          </div>

          <div className="space-y-2.5">
            {displayedStandard.map((task) => (
              <motion.div
                key={task.id}
                whileTap={task.is_completed && !task.ad_required ? {} : { scale: 0.98 }}
                onClick={() => handleTaskClick(task)}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  task.is_completed && !task.ad_required
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-[#12131A] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    <TaskBadgeIcon task={task} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {task.ad_required && (
                      <div className="mb-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          SPONSORED AD
                        </span>
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-white leading-snug line-clamp-2">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-tight">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        +{task.reward_coins} Coins
                      </span>
                      <span className="text-[11px] font-bold text-orange-400 flex items-center gap-0.5 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                        <Zap size={10} className="fill-orange-400" /> +{task.speed_boost}/hr
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-center">
                  {task.is_completed && !task.ad_required ? (
                    <div className="flex items-center gap-1 text-green-400 font-bold text-xs bg-green-500/10 px-2.5 py-1 rounded-xl border border-green-500/20">
                      <CheckCircle2 size={13} /> Done
                    </div>
                  ) : (
                    <button
                      disabled={loadingTaskId === task.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {loadingTaskId === task.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : task.ad_required ? (
                        <>
                          <PlayCircle size={13} className="text-brand-orange" />
                          <span>{task.is_completed ? 'Watch Again' : 'Watch'}</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle size={13} className="text-yellow-300" />
                          <span>Do Task</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Video Ad Player Modal */}
      <AdModal
        task={selectedAdTask}
        isOpen={isAdOpen}
        onClose={() => setIsAdOpen(false)}
        onAdFinished={handleAdFinished}
      />
    </div>
  );
};
