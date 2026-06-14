import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import (
    ConceptNode, Simulation, QuizAttempt, MindMap, AgentLog,
    LearningPath, FeedbackRecord, ProctoringProfile, User,
)
from app.models.schemas import (
    GenerateSimulationRequest, GenerateSimulationResponse, SimViewedRequest, ContentViewedRequest,
    GenerateQuizRequest, GenerateQuizResponse,
    EvaluateRequest, EvaluateResponse,
    MindMapResponse, AgentLogResponse, AgentLogEntry,
)
from app.agents import assessment_agent
from app.agents.graph import assessment_graph
from app.services.auth import get_current_user
from app.services import proctoring

router = APIRouter()


def _proctor_dict(db: Session, user_id: str) -> dict:
    profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == user_id).first()
    if not profile:
        return {}
    return {
        "preferred_difficulty": profile.preferred_difficulty,
        "weakness_tags": profile.weakness_tags or [],
        "strength_tags": profile.strength_tags or [],
        "correct_rate": profile.correct_rate,
    }


# ----------------------------------------------------------------
# /generate-simulation
# ----------------------------------------------------------------
@router.post("/generate-simulation", response_model=GenerateSimulationResponse)
def generate_simulation(payload: GenerateSimulationRequest, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    sim = db.query(Simulation).filter(Simulation.concept_node_id == payload.concept_node_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail="No simulation found for this concept node")
    cfg = dict(sim.config_json)
    desc = cfg.pop("_description", None)
    learning_focus = cfg.get("learning_focus")
    return GenerateSimulationResponse(
        simulation_id=sim.id, template_type=sim.template_type,
        title=sim.title, description=desc, learning_focus=learning_focus, config_json=cfg,
    )


# ----------------------------------------------------------------
# /simulation-viewed  (AI proctoring telemetry)
# ----------------------------------------------------------------
@router.post("/simulation-viewed")
def simulation_viewed(payload: SimViewedRequest, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    proctoring.record_sim_viewed(db, current_user.id, payload.concept_node_id, payload.time_spent_sec)
    return {"status": "recorded"}


# ----------------------------------------------------------------
# /content-viewed  (AI proctoring telemetry — lesson content reading time)
# ----------------------------------------------------------------
@router.post("/content-viewed")
def content_viewed(payload: ContentViewedRequest, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    proctoring.record_content_viewed(db, current_user.id, payload.concept_node_id, payload.time_spent_sec)
    return {"status": "recorded"}


# ----------------------------------------------------------------
# /generate-quiz
# ----------------------------------------------------------------
@router.post("/generate-quiz", response_model=GenerateQuizResponse)
def generate_quiz(payload: GenerateQuizRequest, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    node = db.query(ConceptNode).filter(ConceptNode.id == payload.concept_node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="concept node not found")

    learning_path = db.query(LearningPath).filter(LearningPath.id == node.learning_path_id).first()
    if learning_path.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="not your learning path")

    proctor = _proctor_dict(db, current_user.id)
    quiz_json = assessment_agent.generate_quiz(
        {"title": node.title, "description": node.description,
         "difficulty": node.difficulty, "key_skills": []},
        proctor,
    )

    attempt = QuizAttempt(
        concept_node_id=node.id, user_id=learning_path.user_id,
        quiz_json=quiz_json, difficulty_level=quiz_json.get("quiz_difficulty", "medium"),
    )
    db.add(attempt)
    node.status = "in_progress"
    db.commit()
    db.refresh(attempt)

    return GenerateQuizResponse(quiz_attempt_id=attempt.id, quiz_json=quiz_json)


# ----------------------------------------------------------------
# /evaluate
# ----------------------------------------------------------------
@router.post("/evaluate", response_model=EvaluateResponse)
def evaluate(payload: EvaluateRequest, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == payload.quiz_attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="quiz attempt not found")
    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="not your quiz attempt")

    node = db.query(ConceptNode).filter(ConceptNode.id == attempt.concept_node_id).first()
    learning_path = db.query(LearningPath).filter(LearningPath.id == node.learning_path_id).first()
    proctor = _proctor_dict(db, current_user.id)

    init_state = {
        "quiz_json": attempt.quiz_json,
        "answers": payload.answers,
        "per_question_time": payload.per_question_time or {},
        "current_node": {
            "node_key": node.node_key, "title": node.title,
            "prerequisites": node.prerequisites or [],
        },
        "proctor_profile": proctor,
        "agent_logs": [],
    }

    result = assessment_graph.invoke(init_state)

    score = result["score"]
    passed = result["passed"]
    section_scores = result.get("section_scores", {})
    weak_areas = result.get("weak_areas", [])
    strong_areas = result.get("strong_areas", [])
    recommended = result.get("recommended_node_keys", [])
    remediation = result.get("remediation_text")
    focus_areas = result.get("focus_areas", [])
    diff_adjustment = result.get("difficulty_adjustment")

    explanations = {
        q["id"]: q.get("explanation", "")
        for section in attempt.quiz_json.get("sections", [])
        for q in section.get("questions", [])
    }

    # persist attempt
    attempt.answers_json = payload.answers
    attempt.score = score
    attempt.passed = passed
    attempt.time_taken_sec = payload.time_taken_sec
    attempt.per_question_time = payload.per_question_time
    attempt.section_scores = section_scores
    attempt.submitted_at = datetime.datetime.utcnow()
    db.commit()

    # update mastery + SEQUENTIAL progression
    node.mastery_score = score
    unlocked_node_keys = []
    next_node_key = None

    seq_order = learning_path.sequential_order or []
    all_nodes = db.query(ConceptNode).filter(ConceptNode.learning_path_id == node.learning_path_id).all()
    nodes_by_key = {n.node_key: n for n in all_nodes}

    if passed:
        node.status = "mastered"
        # SEQUENTIAL UNLOCK: unlock the next node in sequential_order
        try:
            idx = seq_order.index(node.node_key)
        except ValueError:
            idx = -1
        if 0 <= idx < len(seq_order) - 1:
            next_key = seq_order[idx + 1]
            next_node = nodes_by_key.get(next_key)
            if next_node and next_node.status == "locked":
                next_node.status = "available"
                unlocked_node_keys.append(next_key)
            next_node_key = next_key
            learning_path.current_step = idx + 1
            learning_path.current_node_id = next_key
        else:
            learning_path.current_step = idx
            learning_path.current_node_id = node.node_key
    else:
        node.status = "available"  # allow retry, stays at same sequential step
        next_node_key = node.node_key
        feedback = FeedbackRecord(
            concept_node_id=node.id, user_id=learning_path.user_id,
            quiz_attempt_id=attempt.id,
            weak_areas=weak_areas, strong_areas=strong_areas,
            recommended_node_keys=recommended, remediation_text=remediation,
            difficulty_adjustment=diff_adjustment,
        )
        db.add(feedback)

    # persist agent logs
    for log in result.get("agent_logs", []):
        db.add(AgentLog(
            session_id=learning_path.session_id,
            agent_name=log["agent_name"], action=log["action"],
            input_summary=log.get("input_summary"), output_summary=log.get("output_summary"),
            status=log.get("status", "success"), duration_ms=log.get("duration_ms"),
        ))
    db.commit()

    # recompute progress
    mastered_count = sum(1 for n in all_nodes if n.status == "mastered")
    learning_path.progress_percent = round(100 * mastered_count / max(len(all_nodes), 1), 2)
    db.commit()

    # AI PROCTORING: update profile, daily progress, possibly adjust roadmap
    adjustment = proctoring.update_profile_from_quiz(
        db, current_user.id, node, attempt, weak_areas, strong_areas,
    )
    if adjustment in ("increase", "decrease"):
        profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == current_user.id).first()
        if profile:
            profile.roadmap_adjustments = (profile.roadmap_adjustments or 0) + 1
            learning_path.difficulty_level = profile.preferred_difficulty
            db.commit()

    return EvaluateResponse(
        score=score, passed=passed, section_scores=section_scores,
        weak_areas=weak_areas, strong_areas=strong_areas,
        recommended_node_keys=recommended, remediation_text=remediation,
        focus_areas=focus_areas, difficulty_adjustment=diff_adjustment,
        mastery_score=node.mastery_score, explanations=explanations,
        unlocked_node_keys=unlocked_node_keys, next_node_key=next_node_key,
    )


# ----------------------------------------------------------------
# /mindmap
# ----------------------------------------------------------------
@router.get("/mindmap", response_model=MindMapResponse)
def get_mindmap(learning_path_id: str, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    mind_map = db.query(MindMap).filter(MindMap.learning_path_id == learning_path_id).first()
    if not mind_map:
        raise HTTPException(status_code=404, detail="mind map not found")
    return MindMapResponse(learning_path_id=learning_path_id, title=mind_map.title, map_json=mind_map.map_json)


# ----------------------------------------------------------------
# /agent-log
# ----------------------------------------------------------------
@router.get("/agent-log", response_model=AgentLogResponse)
def get_agent_log(session_id: str, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    logs = (
        db.query(AgentLog).filter(AgentLog.session_id == session_id)
        .order_by(AgentLog.created_at.asc()).all()
    )
    return AgentLogResponse(
        session_id=session_id,
        logs=[
            AgentLogEntry(
                agent_name=l.agent_name, action=l.action,
                input_summary=l.input_summary, output_summary=l.output_summary,
                status=l.status, duration_ms=l.duration_ms,
                created_at=l.created_at.isoformat(),
            ) for l in logs
        ],
    )
