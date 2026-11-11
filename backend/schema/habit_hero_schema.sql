-- Habit Hero – Phase 8 SQLite schema
-- File: backend/habit_hero.db (created by Alembic / app bootstrap)
-- Compatible with DB Browser for SQLite
-- Enable FKs: PRAGMA foreign_keys = ON;

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY NOT NULL,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL COLLATE NOCASE,
    password_hash   TEXT NOT NULL,
    avatar_path     TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- refresh_tokens (hashed refresh JWTs; never store raw tokens)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id      TEXT NOT NULL,
    token_hash   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    revoked_at   TEXT,
    created_at   TEXT NOT NULL,
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);

-- ---------------------------------------------------------------------------
-- user_settings (1:1 with users)
-- Maps frontend goalTarget / nextGoalTarget streak milestone
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    user_id                     TEXT PRIMARY KEY NOT NULL,
    streak_goal_target          INTEGER NOT NULL DEFAULT 15,
    notifications_enabled       INTEGER NOT NULL DEFAULT 1,
    remind_habits_daily         INTEGER NOT NULL DEFAULT 1,
    remind_habits_weekly        INTEGER NOT NULL DEFAULT 1,
    remind_habits_upcoming      INTEGER NOT NULL DEFAULT 1,
    remind_habits_overdue       INTEGER NOT NULL DEFAULT 1,
    remind_goal_deadlines       INTEGER NOT NULL DEFAULT 1,
    remind_streak_milestones    INTEGER NOT NULL DEFAULT 1,
    remind_weekly_summary       INTEGER NOT NULL DEFAULT 1,
    updated_at                  TEXT NOT NULL,
    CONSTRAINT fk_user_settings_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- habits
-- Maps normalizeHabit()
-- frequency: 'Daily' | 'Weekly'
-- week_day: 0=Sun .. 6=Sat (date-fns getDay); NULL when Daily
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habits (
    id              TEXT PRIMARY KEY NOT NULL,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    icon            TEXT NOT NULL DEFAULT 'sparkles',
    category        TEXT NOT NULL DEFAULT 'Health',
    frequency       TEXT NOT NULL DEFAULT 'Daily'
                    CHECK (frequency IN ('Daily', 'Weekly')),
    start_date      TEXT NOT NULL,              -- yyyy-MM-dd
    created_at      TEXT NOT NULL,              -- yyyy-MM-dd (frontend) or ISO
    archived        INTEGER NOT NULL DEFAULT 0
                    CHECK (archived IN (0, 1)),
    week_day        INTEGER
                    CHECK (week_day IS NULL OR (week_day >= 0 AND week_day <= 6)),
    updated_at      TEXT NOT NULL,
    CONSTRAINT fk_habits_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_habits_user_id ON habits (user_id);
CREATE INDEX IF NOT EXISTS ix_habits_user_archived ON habits (user_id, archived);

-- ---------------------------------------------------------------------------
-- habit_checkins
-- Maps habit.checkins[yyyy-MM-dd] = { completed, notes }
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habit_checkins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id        TEXT NOT NULL,
    date            TEXT NOT NULL,              -- yyyy-MM-dd
    completed       INTEGER NOT NULL DEFAULT 0
                    CHECK (completed IN (0, 1)),
    notes           TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL,
    CONSTRAINT uq_habit_checkins_habit_date UNIQUE (habit_id, date),
    CONSTRAINT fk_habit_checkins_habit
        FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_habit_checkins_habit_id ON habit_checkins (habit_id);
CREATE INDEX IF NOT EXISTS ix_habit_checkins_date ON habit_checkins (date);

-- ---------------------------------------------------------------------------
-- goals
-- Maps normalizeGoal()
-- target_type: completion_count | consecutive_days | days_completed | completion_percentage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
    id                  TEXT PRIMARY KEY NOT NULL,
    user_id             TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    category            TEXT NOT NULL DEFAULT 'Health',
    icon                TEXT NOT NULL DEFAULT '',
    linked_habit_id     TEXT,
    target_type         TEXT NOT NULL DEFAULT 'completion_count'
                        CHECK (target_type IN (
                            'completion_count',
                            'consecutive_days',
                            'days_completed',
                            'completion_percentage'
                        )),
    target_value        INTEGER NOT NULL DEFAULT 1
                        CHECK (target_value >= 1),
    start_date          TEXT NOT NULL,          -- yyyy-MM-dd
    end_date            TEXT NOT NULL,          -- yyyy-MM-dd
    created_at          TEXT NOT NULL,
    notes               TEXT NOT NULL DEFAULT '',
    archived            INTEGER NOT NULL DEFAULT 0
                        CHECK (archived IN (0, 1)),
    completed_at        TEXT,                   -- yyyy-MM-dd or NULL
    updated_at          TEXT NOT NULL,
    CONSTRAINT fk_goals_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_goals_linked_habit
        FOREIGN KEY (linked_habit_id) REFERENCES habits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_goals_user_id ON goals (user_id);
CREATE INDEX IF NOT EXISTS ix_goals_linked_habit_id ON goals (linked_habit_id);

-- ---------------------------------------------------------------------------
-- day_notes
-- Maps dayNotes[yyyy-MM-dd] = string (Calendar daily notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS day_notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL,
    date            TEXT NOT NULL,              -- yyyy-MM-dd
    notes           TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL,
    CONSTRAINT uq_day_notes_user_date UNIQUE (user_id, date),
    CONSTRAINT fk_day_notes_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_day_notes_user_id ON day_notes (user_id);

-- ---------------------------------------------------------------------------
-- journal_entries
-- Maps normalizeJournalEntry()
-- mood: happy|productive|motivated|neutral|tired|stressed|sad
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id              TEXT PRIMARY KEY NOT NULL,
    user_id         TEXT NOT NULL,
    date            TEXT NOT NULL,              -- yyyy-MM-dd
    habit_id        TEXT,                       -- NULL = general entry
    title           TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    mood            TEXT NOT NULL DEFAULT 'neutral'
                    CHECK (mood IN (
                        'happy', 'productive', 'motivated', 'neutral',
                        'tired', 'stressed', 'sad'
                    )),
    created_at      TEXT NOT NULL,              -- ISO datetime
    updated_at      TEXT NOT NULL,
    CONSTRAINT fk_journal_entries_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_journal_entries_habit
        FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_journal_entries_user_id ON journal_entries (user_id);
CREATE INDEX IF NOT EXISTS ix_journal_entries_user_date ON journal_entries (user_id, date);
CREATE INDEX IF NOT EXISTS ix_journal_entries_habit_id ON journal_entries (habit_id);

-- ---------------------------------------------------------------------------
-- journal_entry_tags
-- Maps journal entry tags[] (normalized)
-- Allowed app tags: Productivity, Health, Learning, Personal Growth,
--                   Motivation, Reflection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entry_tags (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id    TEXT NOT NULL,
    tag                 TEXT NOT NULL,
    CONSTRAINT uq_journal_entry_tags UNIQUE (journal_entry_id, tag),
    CONSTRAINT fk_journal_entry_tags_entry
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_journal_entry_tags_entry
    ON journal_entry_tags (journal_entry_id);

-- ---------------------------------------------------------------------------
-- user_achievements
-- Maps unlockedAchievements[]
-- achievement_id examples: first_goal_completed, streak_7, streak_12, ...
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             TEXT NOT NULL,
    achievement_id      TEXT NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    icon                TEXT NOT NULL DEFAULT 'trophy',
    unlocked_at         TEXT NOT NULL,          -- yyyy-MM-dd
    CONSTRAINT uq_user_achievements UNIQUE (user_id, achievement_id),
    CONSTRAINT fk_user_achievements_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_user_achievements_user_id
    ON user_achievements (user_id);

-- ---------------------------------------------------------------------------
-- notifications (in-app inbox; unique dedupe per user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              TEXT PRIMARY KEY NOT NULL,
    user_id         TEXT NOT NULL,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    resource_type   TEXT,
    resource_id     TEXT,
    dedupe_key      TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    read_at         TEXT,
    CONSTRAINT uq_notifications_user_dedupe UNIQUE (user_id, dedupe_key),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_created
    ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS ix_notifications_user_read
    ON notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- Reference: category / enum values used by the frontend (not DB tables)
-- HABIT categories: Health, Work, Learning, Productivity, Mental Health
-- GOAL categories:  + Personal Development
-- Icons: dumbbell, book, droplets, code, moon, brain, clipboard, shield,
--        pen, activity, sparkles, target
-- ---------------------------------------------------------------------------
