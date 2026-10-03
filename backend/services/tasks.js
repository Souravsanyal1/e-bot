import { db } from '../db/index.js';
import { cache } from '../redis.js';

export async function getTasksForUser(userId) {
  const allTasks = await db.all('SELECT * FROM tasks WHERE is_active = 1 OR is_active IS TRUE ORDER BY id ASC');
  const userCompletions = await db.all('SELECT task_id, status FROM user_tasks WHERE user_id = $1', [userId]);

  const completedMap = new Set(userCompletions.map(c => Number(c.task_id)));

  const standard = [];
  const special = [];

  for (const task of allTasks) {
    const isCompleted = completedMap.has(Number(task.id));
    const formattedTask = {
      ...task,
      reward_coins: Number(task.reward_coins),
      speed_boost: Number(task.speed_boost),
      ad_required: Boolean(task.ad_required),
      is_completed: isCompleted,
    };

    if (task.task_type === 'special') {
      special.push(formattedTask);
    } else {
      standard.push(formattedTask);
    }
  }

  return { standard, special };
}

export async function completeTask(userId, taskId) {
  const user = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) throw new Error('User not found');
  if (user.is_banned) throw new Error('Account suspended');

  const task = await db.get('SELECT * FROM tasks WHERE id = $1 AND (is_active = 1 OR is_active IS TRUE)', [taskId]);
  if (!task) throw new Error('Task not found or is no longer active');

  // Check if already completed
  const alreadyDone = await db.get('SELECT id FROM user_tasks WHERE user_id = $1 AND task_id = $2', [userId, taskId]);
  if (alreadyDone) {
    throw new Error('You have already completed this task.');
  }

  // Record completion
  await db.run(`
    INSERT INTO user_tasks (user_id, task_id, status, completed_at)
    VALUES ($1, $2, 'completed', CURRENT_TIMESTAMP)
  `, [userId, taskId]);

  // Apply rewards: Balance bonus + permanent mining speed boost
  const rewardCoins = Number(task.reward_coins || 0);
  const speedBoost = Number(task.speed_boost || 0);

  const updatedBalance = Number(user.balance || 0) + rewardCoins;
  const updatedSpeed = Number(user.speed_per_hr || 0.5) + speedBoost;

  await db.run(`
    UPDATE users 
    SET balance = $1, speed_per_hr = $2 
    WHERE id = $3
  `, [updatedBalance, updatedSpeed, userId]);

  // Update Redis cache
  await cache.updateScore('leaderboard:miners', String(userId), updatedBalance);

  // Send Telegram DM notification
  try {
    const { sendTaskCompletedNotification } = await import('./notifications.js');
    await sendTaskCompletedNotification(userId, {
      taskTitle: task.title,
      rewardCoins,
      speedBoost,
      newBalance: updatedBalance,
      newSpeed: updatedSpeed
    });
  } catch (_nErr) {}

  return {
    rewardCoins,
    speedBoost,
    newBalance: updatedBalance,
    newSpeed: updatedSpeed,
    message: `Completed "${task.title}"! Received +${rewardCoins} E-FORCE & +${speedBoost}/hr speed boost!`
  };
}
