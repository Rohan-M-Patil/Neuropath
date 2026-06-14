import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum


def gen_uuid(): return str(uuid.uuid4())


# ── USERS ─────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name     = Column(String(255), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions      = relationship("SessionModel",    back_populates="user", cascade="all, delete-orphan")
    documents     = relationship("UploadedDocument", back_populates="user", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath",   back_populates="user", cascade="all, delete-orphan")
    daily_progress = relationship("DailyProgress",  back_populates="user", cascade="all, delete-orphan")
    proctor_profile = relationship("ProctoringProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


# ── SESSIONS ──────────────────────────────────────────────────────
class SessionStatus(str, enum.Enum):
    active = "active"; completed = "completed"; abandoned = "abandoned"

class SessionModel(Base):
    __tablename__ = "sessions"
    id          = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id     = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mode        = Column(String(20), nullable=False)
    topic       = Column(String(500), nullable=True)
    document_id = Column(UUID(as_uuid=False), ForeignKey("uploaded_documents.id", ondelete="SET NULL"), nullable=True)
    status      = Column(SAEnum(SessionStatus), default=SessionStatus.active)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user         = relationship("User", back_populates="sessions")
    document     = relationship("UploadedDocument", back_populates="sessions")
    learning_paths = relationship("LearningPath", back_populates="session", cascade="all, delete-orphan")
    agent_logs   = relationship("AgentLog", back_populates="session", cascade="all, delete-orphan")


# ── UPLOADED DOCUMENTS ────────────────────────────────────────────
class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"
    id             = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id        = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename       = Column(String(500), nullable=False)
    file_type      = Column(String(10), nullable=False)
    file_path      = Column(String(1000), nullable=False)
    extracted_text = Column(Text, nullable=True)
    chapters_json  = Column(JSON, nullable=True)
    status         = Column(String(20), default="uploaded")
    created_at     = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User", back_populates="documents")
    sessions = relationship("SessionModel", back_populates="document")


# ── LEARNING PATHS ────────────────────────────────────────────────
class LearningPath(Base):
    __tablename__ = "learning_paths"
    id               = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id          = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id       = Column(UUID(as_uuid=False), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    title            = Column(String(500), nullable=False)
    source_type      = Column(String(20), nullable=False)
    dag_json         = Column(JSON, nullable=False)
    sequential_order = Column(JSON, default=list)   # ordered list of node_keys
    current_node_id  = Column(String(100), nullable=True)
    current_step     = Column(Integer, default=0)   # index into sequential_order
    progress_percent = Column(Float, default=0.0)
    difficulty_level = Column(String(20), default="adaptive") # easy|medium|hard|adaptive
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user          = relationship("User", back_populates="learning_paths")
    session       = relationship("SessionModel", back_populates="learning_paths")
    concept_nodes = relationship("ConceptNode", back_populates="learning_path", cascade="all, delete-orphan")
    mind_maps     = relationship("MindMap", back_populates="learning_path", cascade="all, delete-orphan")


# ── CONCEPT NODES ─────────────────────────────────────────────────
class ConceptNode(Base):
    __tablename__ = "concept_nodes"
    id                  = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    learning_path_id    = Column(UUID(as_uuid=False), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False, index=True)
    node_key            = Column(String(100), nullable=False)
    title               = Column(String(500), nullable=False)
    description         = Column(Text, nullable=True)
    prerequisites       = Column(JSON, default=list)
    sequential_position = Column(Integer, default=0)   # position in learning sequence
    difficulty          = Column(Integer, default=1)
    mastery_score       = Column(Float, default=0.0)
    status              = Column(String(20), default="locked")
    chapter_reference   = Column(String(255), nullable=True)
    simulation_type     = Column(String(50), nullable=True)  # ALL nodes get a simulation
    content_md         = Column(Text, nullable=True)  # rich lesson content (markdown)
    avg_time_seconds    = Column(Float, nullable=True)   # AI proctoring: avg time on this node
    created_at          = Column(DateTime, default=datetime.utcnow)

    learning_path    = relationship("LearningPath", back_populates="concept_nodes")
    quiz_attempts    = relationship("QuizAttempt", back_populates="concept_node", cascade="all, delete-orphan")
    simulations      = relationship("Simulation", back_populates="concept_node", cascade="all, delete-orphan")
    feedback_records = relationship("FeedbackRecord", back_populates="concept_node", cascade="all, delete-orphan")
    proctor_events   = relationship("ProctoringEvent", back_populates="concept_node", cascade="all, delete-orphan")


# ── QUIZ ATTEMPTS ─────────────────────────────────────────────────
class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id              = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    concept_node_id = Column(UUID(as_uuid=False), ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_json       = Column(JSON, nullable=False)
    answers_json    = Column(JSON, nullable=True)
    score           = Column(Float, nullable=True)
    passed          = Column(Boolean, nullable=True)
    time_taken_sec  = Column(Float, nullable=True)  # proctoring: total quiz time
    per_question_time = Column(JSON, nullable=True) # {q_id: seconds}
    section_scores    = Column(JSON, nullable=True) # {"easy":1.0,"medium":0.5,"hard":0.0}
    difficulty_level  = Column(String(20), default="medium")
    created_at      = Column(DateTime, default=datetime.utcnow)
    submitted_at    = Column(DateTime, nullable=True)

    concept_node = relationship("ConceptNode", back_populates="quiz_attempts")


# ── AGENT LOGS ────────────────────────────────────────────────────
class AgentLog(Base):
    __tablename__ = "agent_logs"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    session_id    = Column(UUID(as_uuid=False), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name    = Column(String(100), nullable=False)
    action        = Column(String(255), nullable=False)
    input_summary  = Column(Text, nullable=True)
    output_summary = Column(Text, nullable=True)
    status        = Column(String(20), default="success")
    duration_ms   = Column(Integer, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow, index=True)

    session = relationship("SessionModel", back_populates="agent_logs")


# ── MIND MAPS ─────────────────────────────────────────────────────
class MindMap(Base):
    __tablename__ = "mind_maps"
    id               = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    learning_path_id = Column(UUID(as_uuid=False), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False, index=True)
    title            = Column(String(500), nullable=False)
    map_json         = Column(JSON, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow)

    learning_path = relationship("LearningPath", back_populates="mind_maps")


# ── SIMULATIONS ───────────────────────────────────────────────────
class Simulation(Base):
    __tablename__ = "simulations"
    id              = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    concept_node_id = Column(UUID(as_uuid=False), ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    template_type   = Column(String(50), nullable=False)
    title           = Column(String(500), nullable=False)
    config_json     = Column(JSON, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    concept_node = relationship("ConceptNode", back_populates="simulations")


# ── FEEDBACK RECORDS ──────────────────────────────────────────────
class FeedbackRecord(Base):
    __tablename__ = "feedback_records"
    id                    = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    concept_node_id       = Column(UUID(as_uuid=False), ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id               = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_attempt_id       = Column(UUID(as_uuid=False), ForeignKey("quiz_attempts.id", ondelete="SET NULL"), nullable=True)
    weak_areas            = Column(JSON, default=list)
    strong_areas          = Column(JSON, default=list)
    recommended_node_keys = Column(JSON, default=list)
    remediation_text      = Column(Text, nullable=True)
    difficulty_adjustment = Column(String(20), nullable=True)  # increase|decrease|maintain
    created_at            = Column(DateTime, default=datetime.utcnow)

    concept_node = relationship("ConceptNode", back_populates="feedback_records")


# ── DAILY PROGRESS ────────────────────────────────────────────────
class DailyProgress(Base):
    __tablename__ = "daily_progress"
    id               = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id          = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date             = Column(String(10), nullable=False)  # YYYY-MM-DD
    concepts_studied = Column(Integer, default=0)
    quizzes_taken    = Column(Integer, default=0)
    quizzes_passed   = Column(Integer, default=0)
    total_time_sec   = Column(Float, default=0.0)
    avg_score        = Column(Float, default=0.0)
    xp_earned        = Column(Integer, default=0)

    user = relationship("User", back_populates="daily_progress")


# ── AI PROCTORING PROFILE ─────────────────────────────────────────
class ProctoringProfile(Base):
    __tablename__ = "proctoring_profiles"
    id                     = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id                = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    avg_reading_speed      = Column(Float, nullable=True)   # seconds per concept
    avg_quiz_time          = Column(Float, nullable=True)   # seconds per question
    correct_rate           = Column(Float, default=0.5)
    strength_tags          = Column(JSON, default=list)    # concept tags user is strong at
    weakness_tags          = Column(JSON, default=list)    # concept tags user struggles with
    preferred_difficulty   = Column(String(20), default="medium")
    consistency_score      = Column(Float, default=0.5)    # 0-1: how consistent study pattern is
    total_study_time_sec   = Column(Float, default=0.0)
    roadmap_adjustments    = Column(Integer, default=0)    # how many times roadmap was re-routed
    last_updated           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user             = relationship("User", back_populates="proctor_profile")
    proctor_events   = relationship("ProctoringEvent", back_populates="profile", cascade="all, delete-orphan")


# ── PROCTORING EVENTS (raw telemetry) ─────────────────────────────
class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"
    id              = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    profile_id      = Column(UUID(as_uuid=False), ForeignKey("proctoring_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    concept_node_id = Column(UUID(as_uuid=False), ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=True)
    event_type      = Column(String(50), nullable=False)   # sim_viewed|quiz_started|quiz_submitted|node_unlocked
    payload         = Column(JSON, default=dict)           # raw telemetry
    created_at      = Column(DateTime, default=datetime.utcnow, index=True)

    profile      = relationship("ProctoringProfile", back_populates="proctor_events")
    concept_node = relationship("ConceptNode", back_populates="proctor_events")
