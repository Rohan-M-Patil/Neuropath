import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.models import (
    LearningPath, ConceptNode, DailyProgress, ProctoringProfile, User,
)
from app.models.schemas import (
    DashboardResponse, CourseSummary, DailyProgressOut, ProctoringProfileOut,
)
from app.services.auth import get_current_user
from app.services.llm_client import call_llm_json

router = APIRouter()

INSIGHT_PROMPT = """You are the AI Proctoring Agent. Given a learner's stats, write ONE
encouraging, specific sentence (max 25 words) summarizing their strengths/weaknesses for
a dashboard widget. Return STRICT JSON: {"insight": "..."}"""


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id

    # ---- Courses ----
    paths = (
        db.query(LearningPath)
        .filter(LearningPath.user_id == user_id)
        .order_by(LearningPath.created_at.desc())
        .all()
    )
    courses = []
    for lp in paths:
        nodes = db.query(ConceptNode).filter(ConceptNode.learning_path_id == lp.id).all()
        mastered = sum(1 for n in nodes if n.status == "mastered")
        current_title = None
        if lp.current_node_id:
            cur = next((n for n in nodes if n.node_key == lp.current_node_id), None)
            current_title = cur.title if cur else None
        elif nodes:
            seq = lp.sequential_order or []
            cur = next((n for n in nodes if n.node_key == (seq[0] if seq else None)), None)
            current_title = cur.title if cur else nodes[0].title

        courses.append(CourseSummary(
            learning_path_id=lp.id, title=lp.title, source_type=lp.source_type,
            progress_percent=lp.progress_percent or 0.0,
            total_nodes=len(nodes), mastered_nodes=mastered,
            current_node_title=current_title,
            difficulty_level=lp.difficulty_level or "adaptive",
            created_at=lp.created_at.isoformat(),
        ))

    # ---- Daily progress (last 30 days) ----
    thirty_days_ago = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
    daily_rows = (
        db.query(DailyProgress)
        .filter(DailyProgress.user_id == user_id, DailyProgress.date >= thirty_days_ago)
        .order_by(DailyProgress.date.asc())
        .all()
    )
    daily_progress = [
        DailyProgressOut(
            date=d.date, concepts_studied=d.concepts_studied or 0,
            quizzes_taken=d.quizzes_taken or 0, quizzes_passed=d.quizzes_passed or 0,
            total_time_sec=d.total_time_sec or 0.0, avg_score=d.avg_score or 0.0,
            xp_earned=d.xp_earned or 0,
        )
        for d in daily_rows
    ]

    # ---- Weekly summary (last 7 days) ----
    seven_days_ago = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    weekly_rows = [d for d in daily_rows if d.date >= seven_days_ago]
    weekly_summary = {
        "total_time_sec": sum(d.total_time_sec or 0 for d in weekly_rows),
        "quizzes_taken": sum(d.quizzes_taken or 0 for d in weekly_rows),
        "quizzes_passed": sum(d.quizzes_passed or 0 for d in weekly_rows),
        "concepts_studied": sum(d.concepts_studied or 0 for d in weekly_rows),
        "avg_score": round(
            sum((d.avg_score or 0) * (d.quizzes_taken or 0) for d in weekly_rows)
            / max(sum(d.quizzes_taken or 0 for d in weekly_rows), 1), 3
        ),
        "xp_earned": sum(d.xp_earned or 0 for d in weekly_rows),
        "active_days": len(weekly_rows),
    }

    # ---- Streak ----
    streak = 0
    day = datetime.date.today()
    dates_with_activity = {d.date for d in daily_rows if (d.total_time_sec or 0) > 0}
    while day.isoformat() in dates_with_activity:
        streak += 1
        day -= datetime.timedelta(days=1)

    # ---- Proctoring profile ----
    profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == user_id).first()
    insight = None
    if profile and (profile.strength_tags or profile.weakness_tags):
        try:
            stats = {
                "correct_rate": profile.correct_rate,
                "strength_tags": (profile.strength_tags or [])[:5],
                "weakness_tags": (profile.weakness_tags or [])[:5],
                "consistency_score": profile.consistency_score,
                "preferred_difficulty": profile.preferred_difficulty,
            }
            res = call_llm_json(INSIGHT_PROMPT, f"Stats: {stats}")
            insight = res.get("insight")
        except Exception:
            insight = None

    proctoring_out = ProctoringProfileOut(
        avg_reading_speed=profile.avg_reading_speed if profile else None,
        avg_quiz_time=profile.avg_quiz_time if profile else None,
        correct_rate=profile.correct_rate if profile else 0.5,
        strength_tags=profile.strength_tags if profile else [],
        weakness_tags=profile.weakness_tags if profile else [],
        preferred_difficulty=profile.preferred_difficulty if profile else "medium",
        consistency_score=profile.consistency_score if profile else 0.5,
        total_study_time_sec=profile.total_study_time_sec if profile else 0.0,
        roadmap_adjustments=profile.roadmap_adjustments if profile else 0,
        insight=insight,
    )

    total_xp = sum(d.xp_earned or 0 for d in daily_rows)

    return DashboardResponse(
        user_id=user_id, full_name=current_user.full_name or current_user.email,
        courses=courses, daily_progress=daily_progress,
        weekly_summary=weekly_summary, proctoring=proctoring_out,
        total_xp=total_xp, streak_days=streak,
    )


@router.get("/learning-paths/{learning_path_id}", response_model=None)
def get_learning_path(learning_path_id: str, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    """Reload a previously generated roadmap (for resuming a course)."""
    from app.models.schemas import GenerateRoadmapResponse, ConceptNodeOut
    from app.models.models import MindMap, Simulation, AgentLog

    lp = db.query(LearningPath).filter(LearningPath.id == learning_path_id).first()
    if not lp or lp.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="learning path not found")

    nodes = db.query(ConceptNode).filter(ConceptNode.learning_path_id == lp.id).order_by(ConceptNode.sequential_position).all()
    dag = lp.dag_json
    mind_map = db.query(MindMap).filter(MindMap.learning_path_id == lp.id).first()
    simulations = []
    for n in nodes:
        sim = db.query(Simulation).filter(Simulation.concept_node_id == n.id).first()
        if sim:
            cfg = dict(sim.config_json)
            cfg.pop("_description", None)
            simulations.append({
                "node_key": n.node_key, "template_type": sim.template_type,
                "title": sim.title, "config_json": cfg,
            })
    logs = db.query(AgentLog).filter(AgentLog.session_id == lp.session_id).order_by(AgentLog.created_at.asc()).all()

    return GenerateRoadmapResponse(
        learning_path_id=lp.id, session_id=lp.session_id, title=lp.title,
        nodes=[
            ConceptNodeOut(
                id=n.id, node_key=n.node_key, title=n.title, description=n.description,
                prerequisites=n.prerequisites or [], sequential_position=n.sequential_position,
                difficulty=n.difficulty, chapter_reference=n.chapter_reference,
                simulation_type=n.simulation_type, status=n.status, mastery_score=n.mastery_score,
                key_skills=[], estimated_minutes=None, content_md=n.content_md,
            ) for n in nodes
        ],
        edges=dag.get("edges", []),
        sequential_order=lp.sequential_order or [],
        current_step=lp.current_step or 0,
        mind_map=mind_map.map_json if mind_map else {"nodes": [], "links": []},
        simulations=simulations,
        agent_logs=[
            {
                "agent_name": l.agent_name, "action": l.action,
                "input_summary": l.input_summary, "output_summary": l.output_summary,
                "status": l.status, "duration_ms": l.duration_ms,
                "created_at": l.created_at.isoformat(),
            } for l in logs
        ],
    )
