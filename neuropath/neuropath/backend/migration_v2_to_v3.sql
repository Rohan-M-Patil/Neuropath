-- =========================================================
-- NeuroPath migration: v2 schema -> v3 schema
-- Adds: concept_nodes.content_md, quiz_attempts.section_scores
-- Safe to run multiple times (uses IF NOT EXISTS).
-- Run with: psql $DATABASE_URL -f migration_v2_to_v3.sql
-- =========================================================

-- ---- concept_nodes: rich lesson content ----
ALTER TABLE concept_nodes
    ADD COLUMN IF NOT EXISTS content_md TEXT;

-- ---- quiz_attempts: per-section (easy/medium/hard) scores ----
ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS section_scores JSONB;

-- Note: Simulation.config_json already stores arbitrary JSON, so the new
-- "learning_focus" field for 3D simulations and the 3 new template types
-- (comparison_3d, timeline_3d, state_machine_3d) require no schema change —
-- they are stored inside the existing config_json JSONB column.
