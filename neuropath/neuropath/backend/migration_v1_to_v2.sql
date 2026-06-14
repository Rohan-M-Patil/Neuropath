-- =========================================================
-- NeuroPath migration: v1 schema -> v2 schema
-- Safe to run multiple times (uses IF NOT EXISTS / guards).
-- Run with: psql $DATABASE_URL -f migration_v1_to_v2.sql
-- =========================================================

-- ---- learning_paths ----
ALTER TABLE learning_paths
    ADD COLUMN IF NOT EXISTS sequential_order JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20) DEFAULT 'adaptive';

-- ---- concept_nodes ----
ALTER TABLE concept_nodes
    ADD COLUMN IF NOT EXISTS sequential_position INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_time_seconds FLOAT;

-- v1 had `simulation_template`; v2 uses `simulation_type`.
-- Add the new column, backfill from the old one if it exists, then drop the old one.
ALTER TABLE concept_nodes
    ADD COLUMN IF NOT EXISTS simulation_type VARCHAR(50);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'concept_nodes' AND column_name = 'simulation_template'
    ) THEN
        UPDATE concept_nodes
        SET simulation_type = COALESCE(simulation_type, simulation_template, 'generic_3d');

        ALTER TABLE concept_nodes DROP COLUMN simulation_template;
    END IF;
END $$;

-- Backfill simulation_type for any existing rows that are still NULL
UPDATE concept_nodes SET simulation_type = 'generic_3d' WHERE simulation_type IS NULL;

-- Backfill sequential_position from existing prerequisites/order if not yet set
-- (best-effort: orders by created_at within each learning path)
DO $$
DECLARE
    lp RECORD;
    n RECORD;
    pos INTEGER;
BEGIN
    FOR lp IN SELECT id FROM learning_paths LOOP
        pos := 1;
        FOR n IN
            SELECT id FROM concept_nodes
            WHERE learning_path_id = lp.id AND (sequential_position IS NULL OR sequential_position = 0)
            ORDER BY created_at ASC
        LOOP
            UPDATE concept_nodes SET sequential_position = pos WHERE id = n.id;
            pos := pos + 1;
        END LOOP;
    END LOOP;
END $$;

-- Backfill learning_paths.sequential_order from concept_nodes ordering
UPDATE learning_paths lp
SET sequential_order = COALESCE((
    SELECT jsonb_agg(node_key ORDER BY sequential_position ASC)
    FROM concept_nodes
    WHERE learning_path_id = lp.id
), '[]'::jsonb)
WHERE sequential_order = '[]'::jsonb OR sequential_order IS NULL;

-- ---- quiz_attempts ----
ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS time_taken_sec FLOAT,
    ADD COLUMN IF NOT EXISTS per_question_time JSONB,
    ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20) DEFAULT 'medium';

-- ---- feedback_records ----
ALTER TABLE feedback_records
    ADD COLUMN IF NOT EXISTS strong_areas JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS difficulty_adjustment VARCHAR(20);

-- ---- daily_progress (new table) ----
CREATE TABLE IF NOT EXISTS daily_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    concepts_studied INTEGER DEFAULT 0,
    quizzes_taken INTEGER DEFAULT 0,
    quizzes_passed INTEGER DEFAULT 0,
    total_time_sec FLOAT DEFAULT 0,
    avg_score FLOAT DEFAULT 0,
    xp_earned INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);

-- ---- proctoring_profiles (new table) ----
CREATE TABLE IF NOT EXISTS proctoring_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    avg_reading_speed FLOAT,
    avg_quiz_time FLOAT,
    correct_rate FLOAT DEFAULT 0.5,
    strength_tags JSONB DEFAULT '[]',
    weakness_tags JSONB DEFAULT '[]',
    preferred_difficulty VARCHAR(20) DEFAULT 'medium',
    consistency_score FLOAT DEFAULT 0.5,
    total_study_time_sec FLOAT DEFAULT 0,
    roadmap_adjustments INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT now()
);

-- ---- proctoring_events (new table) ----
CREATE TABLE IF NOT EXISTS proctoring_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES proctoring_profiles(id) ON DELETE CASCADE,
    concept_node_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proctor_events_profile ON proctoring_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_proctor_events_created ON proctoring_events(created_at);

-- ---- Backfill: create a proctoring_profiles row for every existing user ----
INSERT INTO proctoring_profiles (id, user_id)
SELECT uuid_generate_v4(), u.id
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM proctoring_profiles p WHERE p.user_id = u.id
);

-- =========================================================
-- Done. Verify with:
--   \d learning_paths
--   \d concept_nodes
--   \d proctoring_profiles
-- =========================================================
