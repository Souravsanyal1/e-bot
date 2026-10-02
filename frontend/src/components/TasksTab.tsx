import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, PlayCircle, ExternalLink, Flame, ArrowUpRight } from 'lucide-react';
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
    if (task.is_completed) return;

    tg.haptic.impact('medium');

    // If task requires watching an Ad (Sponsored Video & Gigapub Engine)
    if (task.ad_required) {
      setSelectedAdTask(task);
      setIsAdOpen(true);
      return;
    }

    // If external link or telegram
    if (task.link) {
      if (task.link.includes('t.me')) {
        tg.openTelegramLink(task.link);
      } else {
        tg.openLink(task.link);
      }
    }

    // Complete task after confirmation
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
                whileTap={task.is_completed ? {} : { scale: 0.98 }}
                onClick={() => handleTaskClick(task)}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  task.is_completed
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-gradient-to-r from-orange-500/15 via-[#181826] to-[#12131A] border-orange-500/40 shadow-sm hover:border-orange-400'
                }`}
              >
                <div className="flex items-center gap-3 pr-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    task.is_completed ? 'bg-white/10 text-gray-400' : 'bg-orange-500/20 text-brand-orange border border-orange-500/30'
                  }`}>
                    {task.ad_required ? <PlayCircle size={20} /> : <Zap size={20} />}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white line-clamp-1">{task.title}</h4>
                      {task.ad_required && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                          AD
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{task.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-white">+{task.reward_coins} Coins</span>
                      <span className="text-[11px] font-extrabold text-brand-orange flex items-center gap-0.5">
                        <Zap size={10} /> +{task.speed_boost}/hr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status CTA */}
                <div className="shrink-0">
                  {task.is_completed ? (
                    <div className="flex items-center gap-1 text-green-400 font-bold text-xs bg-green-500/10 px-2.5 py-1 rounded-xl border border-green-500/20">
                      <CheckCircle2 size={14} /> Done
                    </div>
                  ) : (
                    <button
                      disabled={loadingTaskId === task.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-black bg-gradient-to-r from-white via-orange-100 to-brand-orange shadow-sm flex items-center gap-1"
                    >
                      {loadingTaskId === task.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : task.ad_required ? (
                        <>
                          <PlayCircle size={13} />
                          <span>Watch</span>
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
                whileTap={task.is_completed ? {} : { scale: 0.98 }}
                onClick={() => handleTaskClick(task)}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  task.is_completed
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'bg-[#12131A] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 pr-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    task.is_completed ? 'bg-white/10 text-gray-400' : 'bg-white/5 text-white border border-white/10'
                  }`}>
                    {task.ad_required ? <PlayCircle size={18} /> : <ExternalLink size={18} />}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white line-clamp-1">{task.title}</h4>
                      {task.ad_required && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-orange-500/20 text-orange-400">
                          AD
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-bold text-gray-300">+{task.reward_coins} Coins</span>
                      <span className="text-[11px] font-bold text-orange-400 flex items-center gap-0.5">
                        <Zap size={10} /> +{task.speed_boost}/hr
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {task.is_completed ? (
                    <div className="flex items-center gap-1 text-green-400 font-bold text-xs bg-green-500/10 px-2 py-1 rounded-xl">
                      <CheckCircle2 size={13} /> Done
                    </div>
                  ) : (
                    <button
                      disabled={loadingTaskId === task.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all flex items-center gap-1"
                    >
                      {loadingTaskId === task.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : task.ad_required ? (
                        <span>Watch</span>
                      ) : (
                        <span>Do Task</span>
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
