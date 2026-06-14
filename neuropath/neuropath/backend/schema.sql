-- NeuroPath — Full Schema v2 (PostgreSQL / Neon)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE uploaded_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('pdf','docx')),
    file_path VARCHAR(1000) NOT NULL,
    extracted_text TEXT,
    chapters_json JSONB,
    status VARCHAR(20) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_documents_user ON uploaded_documents(user_id);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('topic','book')),
    topic VARCHAR(500),
    document_id UUID REFERENCES uploaded_documents(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE learning_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('topic','book')),
    dag_json JSONB NOT NULL,
    sequential_order JSONB DEFAULT '[]',
    current_node_id VARCHAR(100),
    current_step INTEGER DEFAULT 0,
    progress_percent FLOAT DEFAULT 0,
    difficulty_level VARCHAR(20) DEFAULT 'adaptive',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_learning_paths_user ON learning_paths(user_id);
CREATE INDEX idx_learning_paths_session ON learning_paths(session_id);

CREATE TABLE concept_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    node_key VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    prerequisites JSONB DEFAULT '[]',
    sequential_position INTEGER DEFAULT 0,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    mastery_score FLOAT DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 1),
    status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked','available','in_progress','mastered')),
    chapter_reference VARCHAR(255),
    simulation_type VARCHAR(50),
    avg_time_seconds FLOAT,
    content_md TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(learning_path_id, node_key)
);
CREATE INDEX idx_concept_nodes_path ON concept_nodes(learning_path_id);
CREATE INDEX idx_concept_nodes_status ON concept_nodes(status);

CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_node_id UUID NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_json JSONB NOT NULL,
    answers_json JSONB,
    score FLOAT CHECK (score BETWEEN 0 AND 1),
    passed BOOLEAN,
    time_taken_sec FLOAT,
    per_question_time JSONB,
    section_scores JSONB,
    difficulty_level VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT now(),
    submitted_at TIMESTAMP
);
CREATE INDEX idx_quiz_attempts_node ON quiz_attempts(concept_node_id);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);

CREATE TABLE agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    input_summary TEXT,
    output_summary TEXT,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('running','success','failed')),
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_agent_logs_session ON agent_logs(session_id);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at);

CREATE TABLE mind_maps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    map_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_node_id UUID NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    config_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_simulations_node ON simulations(concept_node_id);

CREATE TABLE feedback_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_node_id UUID NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE SET NULL,
    weak_areas JSONB DEFAULT '[]',
    strong_areas JSONB DEFAULT '[]',
    recommended_node_keys JSONB DEFAULT '[]',
    remediation_text TEXT,
    difficulty_adjustment VARCHAR(20),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE daily_progress (
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
CREATE UNIQUE INDEX idx_daily_progress_user_date ON daily_progress(user_id, date);

CREATE TABLE proctoring_profiles (
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

CREATE TABLE proctoring_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES proctoring_profiles(id) ON DELETE CASCADE,
    concept_node_id UUID REFERENCES concept_nodes(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_proctor_events_profile ON proctoring_events(profile_id);
CREATE INDEX idx_proctor_events_created ON proctoring_events(created_at);
