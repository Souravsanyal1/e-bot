-- E-FORCE Telegram Mini App Database Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    balance NUMERIC(18, 6) DEFAULT 0.000000,
    speed_per_hr NUMERIC(10, 4) DEFAULT 0.5000,
    mining_start_time TIMESTAMP WITH TIME ZONE NULL,
    last_claim_time TIMESTAMP WITH TIME ZONE NULL,
    referred_by BIGINT NULL,
    referral_count INT DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reward_coins NUMERIC(18, 4) DEFAULT 10.0,
    speed_boost NUMERIC(10, 4) DEFAULT 0.05,
    task_type VARCHAR(50) DEFAULT 'standard', -- 'standard' or 'special'
    action_type VARCHAR(50) DEFAULT 'link', -- 'link', 'telegram', 'ad', 'daily'
    link VARCHAR(512),
    channel_username VARCHAR(255),
    ad_required BOOLEAN DEFAULT FALSE,
    wait_time_sec INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_tasks (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'completed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_task UNIQUE (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bonus_coins NUMERIC(18, 4) DEFAULT 10.0,
    speed_boost NUMERIC(10, 4) DEFAULT 0.05,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_referral UNIQUE (referred_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed Initial Tasks if empty
INSERT INTO tasks (title, description, reward_coins, speed_boost, task_type, action_type, link, ad_required, wait_time_sec)
VALUES 
('Watch Sponsored E-FORCE Ad', 'Watch a fast sponsor video ad to boost your mining engine rate permanently!', 25.0, 0.10, 'standard', 'ad', '', TRUE, 15),
('Join Official Telegram Channel', 'Subscribe to the official announcement channel for critical airdrop news.', 50.0, 0.15, 'standard', 'telegram', 'https://t.me/Elite_Force_Official_Mining_bot', FALSE, 5),
('Follow E-FORCE on X (Twitter)', 'Follow our official X handle and retweet the pinned 24H mining announcement.', 35.0, 0.08, 'standard', 'link', 'https://x.com', FALSE, 10),
('🔥 SPECIAL: Supercharge Core with Video Partner', 'Watch our special partner video showcase and unlock double speed boost!', 100.0, 0.25, 'special', 'ad', '', TRUE, 20),
('⚡ SPECIAL: Connect TON / Web3 Wallet Preview', 'Bookmark the upcoming Web3 smart contract connection portal.', 75.0, 0.20, 'special', 'link', 'https://ton.org', FALSE, 10)
ON CONFLICT DO NOTHING;
