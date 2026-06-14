from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ---------------- /topic ----------------
class TopicRequest(BaseModel):
    topic: str


# ---------------- /upload ----------------
class UploadResponse(BaseModel):
    document_id: str
    filename: str
    file_type: str
    chapters: List[Dict[str, Any]]
    status: str


# ---------------- /generate-roadmap ----------------
class GenerateRoadmapRequest(BaseModel):
    mode: str  # "topic" | "book"
    topic: Optional[str] = None
    document_id: Optional[str] = None


class ConceptNodeOut(BaseModel):
    id: str
    node_key: str
    title: str
    description: Optional[str] = None
    prerequisites: List[str] = []
    sequential_position: int = 0
    difficulty: int = 1
    chapter_reference: Optional[str] = None
    simulation_type: Optional[str] = None
    status: str = "locked"
    mastery_score: float = 0.0
    key_skills: List[str] = []
    estimated_minutes: Optional[int] = None
    content_md: Optional[str] = None


class GenerateRoadmapResponse(BaseModel):
    learning_path_id: str
    session_id: str
    title: str
    nodes: List[ConceptNodeOut]
    edges: List[Dict[str, str]]
    sequential_order: List[str]
    current_step: int
    mind_map: Dict[str, Any]
    simulations: List[Dict[str, Any]]
    agent_logs: List[Dict[str, Any]]


# ---------------- /generate-simulation ----------------
class GenerateSimulationRequest(BaseModel):
    concept_node_id: str


class GenerateSimulationResponse(BaseModel):
    simulation_id: str
    template_type: str
    title: str
    description: Optional[str] = None
    learning_focus: Optional[str] = None
    config_json: Dict[str, Any]


class SimViewedRequest(BaseModel):
    concept_node_id: str
    time_spent_sec: float


class ContentViewedRequest(BaseModel):
    concept_node_id: str
    time_spent_sec: float


# ---------------- /generate-quiz ----------------
class GenerateQuizRequest(BaseModel):
    concept_node_id: str


class GenerateQuizResponse(BaseModel):
    quiz_attempt_id: str
    quiz_json: Dict[str, Any]


# ---------------- /evaluate ----------------
class EvaluateRequest(BaseModel):
    quiz_attempt_id: str
    answers: Dict[str, int]
    time_taken_sec: float
    per_question_time: Optional[Dict[str, float]] = None


class EvaluateResponse(BaseModel):
    score: float
    passed: bool
    section_scores: Dict[str, float] = {}
    weak_areas: List[str] = []
    strong_areas: List[str] = []
    recommended_node_keys: List[str] = []
    remediation_text: Optional[str] = None
    focus_areas: List[str] = []
    difficulty_adjustment: Optional[str] = None
    mastery_score: float
    explanations: Dict[str, str] = {}
    unlocked_node_keys: List[str] = []
    next_node_key: Optional[str] = None


# ---------------- /mindmap ----------------
class MindMapResponse(BaseModel):
    learning_path_id: str
    title: str
    map_json: Dict[str, Any]


# ---------------- /agent-log ----------------
class AgentLogEntry(BaseModel):
    agent_name: str
    action: str
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None
    status: str
    duration_ms: Optional[int] = None
    created_at: str


class AgentLogResponse(BaseModel):
    session_id: str
    logs: List[AgentLogEntry]


# ---------------- /dashboard ----------------
class CourseSummary(BaseModel):
    learning_path_id: str
    title: str
    source_type: str
    progress_percent: float
    total_nodes: int
    mastered_nodes: int
    current_node_title: Optional[str] = None
    difficulty_level: str
    created_at: str


class DailyProgressOut(BaseModel):
    date: str
    concepts_studied: int
    quizzes_taken: int
    quizzes_passed: int
    total_time_sec: float
    avg_score: float
    xp_earned: int


class ProctoringProfileOut(BaseModel):
    avg_reading_speed: Optional[float] = None
    avg_quiz_time: Optional[float] = None
    correct_rate: float
    strength_tags: List[str] = []
    weakness_tags: List[str] = []
    preferred_difficulty: str
    consistency_score: float
    total_study_time_sec: float
    roadmap_adjustments: int
    insight: Optional[str] = None


class DashboardResponse(BaseModel):
    user_id: str
    full_name: str
    courses: List[CourseSummary]
    daily_progress: List[DailyProgressOut]   # last 30 days
    weekly_summary: Dict[str, Any]
    proctoring: ProctoringProfileOut
    total_xp: int
    streak_days: int
