"""
AI Proctoring Service
======================
Analyzes user telemetry (time-on-node, wrong answers, quiz speed) to:
  1. Update ProctoringProfile (strength/weakness tags, preferred_difficulty)
  2. Decide if roadmap difficulty should adjust: increase | decrease | maintain
  3. Generate personalized next-step recommendations
  4. Update DailyProgress ledger
"""
from datetime import date, datetime
from sqlalchemy.orm import Session
from app.models.models import (
    ProctoringProfile, ProctoringEvent, QuizAttempt,
    ConceptNode, LearningPath, DailyProgress,
)
from app.services.llm_client import call_llm_json

PROCTOR_SYSTEM = """You are the AI Proctoring Agent for NeuroPath.
Given a learner's behavioral telemetry, return a JSON profile update.

Input keys:
  - recent_scores: list of recent quiz scores [0.0-1.0]
  - avg_quiz_time_sec: average time per quiz question in seconds
  - avg_reading_time_sec: average time viewing a simulation/concept
  - weak_areas: list of concept tags the learner gets wrong
  - strong_areas: list of concept tags the learner gets right
  - current_correct_rate: float 0-1
  - attempts_without_pass: int, consecutive fails

Return STRICT JSON:
{
  "difficulty_adjustment": "increase" | "decrease" | "maintain",
  "preferred_difficulty": "easy" | "medium" | "hard",
  "consistency_score": float 0-1,
  "insight": "1-2 sentence human-readable insight for dashboard",
  "next_focus_tags": ["tag1", "tag2"]
}

Rules:
- If avg_quiz_time_sec < 8 AND correct_rate > 0.8 → increase difficulty
- If attempts_without_pass >= 2 OR correct_rate < 0.4 → decrease difficulty
- consistency_score: high if study is regular and improving, low if erratic
"""


def update_profile_from_quiz(
    db: Session,
    user_id: str,
    concept_node: ConceptNode,
    quiz_attempt: QuizAttempt,
    weak_areas: list,
    strong_areas: list,
):
    """Called after every quiz evaluation. Updates profile + daily progress."""
    profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == user_id).first()
    if not profile:
        from app.models.models import ProctoringProfile as PP
        import uuid
        profile = PP(id=str(uuid.uuid4()), user_id=user_id)
        db.add(profile)
        db.flush()

    # Merge weak/strong tags
    existing_weak = set(profile.weakness_tags or [])
    existing_strong = set(profile.strength_tags or [])

    existing_weak.update(weak_areas)
    existing_strong.update(strong_areas)
    existing_weak -= existing_strong  # remove from weak if now strong

    profile.weakness_tags = list(existing_weak)[:20]
    profile.strength_tags = list(existing_strong)[:20]

    # Rolling correct rate (EMA alpha=0.3)
    alpha = 0.3
    score = quiz_attempt.score or 0.0
    profile.correct_rate = round(alpha * score + (1 - alpha) * (profile.correct_rate or 0.5), 3)

    # Rolling avg quiz time
    if quiz_attempt.time_taken_sec:
        q_count = max(len(quiz_attempt.quiz_json.get("questions", [])), 1)
        per_q = quiz_attempt.time_taken_sec / q_count
        if profile.avg_quiz_time:
            profile.avg_quiz_time = round(alpha * per_q + (1 - alpha) * profile.avg_quiz_time, 2)
        else:
            profile.avg_quiz_time = round(per_q, 2)

    # Update total study time
    profile.total_study_time_sec = (profile.total_study_time_sec or 0) + (quiz_attempt.time_taken_sec or 0)

    # Gather recent attempts for LLM analysis (last 5)
    recent = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.submitted_at.desc())
        .limit(5)
        .all()
    )
    recent_scores = [a.score for a in recent if a.score is not None]
    consecutive_fails = 0
    for a in recent:
        if a.passed is False:
            consecutive_fails += 1
        else:
            break

    # LLM proctoring analysis
    try:
        payload = {
            "recent_scores": recent_scores,
            "avg_quiz_time_sec": profile.avg_quiz_time or 30,
            "avg_reading_time_sec": profile.avg_reading_speed or 60,
            "weak_areas": list(existing_weak)[:10],
            "strong_areas": list(existing_strong)[:10],
            "current_correct_rate": profile.correct_rate,
            "attempts_without_pass": consecutive_fails,
        }
        analysis = call_llm_json(PROCTOR_SYSTEM, f"Telemetry: {payload}")
        profile.preferred_difficulty = analysis.get("preferred_difficulty", profile.preferred_difficulty)
        profile.consistency_score = analysis.get("consistency_score", profile.consistency_score)
        adjustment = analysis.get("difficulty_adjustment", "maintain")
    except Exception:
        adjustment = "maintain"

    # Persist proctoring event
    event = ProctoringEvent(
        profile_id=profile.id,
        concept_node_id=concept_node.id,
        event_type="quiz_submitted",
        payload={
            "score": score,
            "passed": quiz_attempt.passed,
            "time_sec": quiz_attempt.time_taken_sec,
            "weak": weak_areas,
            "strong": strong_areas,
            "adjustment": adjustment,
        },
    )
    db.add(event)

    # Update daily progress
    today = date.today().isoformat()
    dp = db.query(DailyProgress).filter(
        DailyProgress.user_id == user_id,
        DailyProgress.date == today,
    ).first()
    if not dp:
        dp = DailyProgress(user_id=user_id, date=today)
        db.add(dp)
    dp.quizzes_taken = (dp.quizzes_taken or 0) + 1
    if quiz_attempt.passed:
        dp.quizzes_passed = (dp.quizzes_passed or 0) + 1
    dp.total_time_sec = (dp.total_time_sec or 0) + (quiz_attempt.time_taken_sec or 0)
    prev_avg = dp.avg_score or 0.0
    taken = dp.quizzes_taken or 1
    dp.avg_score = round((prev_avg * (taken - 1) + score) / taken, 3)
    xp = int(score * 100) + (50 if quiz_attempt.passed else 0)
    dp.xp_earned = (dp.xp_earned or 0) + xp

    db.commit()
    return adjustment


def record_sim_viewed(db: Session, user_id: str, concept_node_id: str, time_spent_sec: float):
    """Called when user finishes viewing a simulation. Updates reading speed."""
    profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == user_id).first()
    if not profile:
        return
    alpha = 0.3
    if profile.avg_reading_speed:
        profile.avg_reading_speed = round(alpha * time_spent_sec + (1 - alpha) * profile.avg_reading_speed, 2)
    else:
        profile.avg_reading_speed = round(time_spent_sec, 2)
    profile.total_study_time_sec = (profile.total_study_time_sec or 0) + time_spent_sec

    today = date.today().isoformat()
    dp = db.query(DailyProgress).filter(
        DailyProgress.user_id == user_id,
        DailyProgress.date == today,
    ).first()
    if not dp:
        dp = DailyProgress(user_id=user_id, date=today)
        db.add(dp)
    dp.concepts_studied = (dp.concepts_studied or 0) + 1
    dp.total_time_sec = (dp.total_time_sec or 0) + time_spent_sec

    event = ProctoringEvent(
        profile_id=profile.id,
        concept_node_id=concept_node_id,
        event_type="sim_viewed",
        payload={"time_spent_sec": time_spent_sec},
    )
    db.add(event)
    db.commit()


def record_content_viewed(db: Session, user_id: str, concept_node_id: str, time_spent_sec: float):
    """Called when user finishes reading a concept's lesson content (content_md).
    Feeds ProctoringProfile.avg_reading_speed (same EMA as simulation viewing,
    since both represent "time to read and understand material")."""
    profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == user_id).first()
    if not profile:
        return
    alpha = 0.3
    if profile.avg_reading_speed:
        profile.avg_reading_speed = round(alpha * time_spent_sec + (1 - alpha) * profile.avg_reading_speed, 2)
    else:
        profile.avg_reading_speed = round(time_spent_sec, 2)
    profile.total_study_time_sec = (profile.total_study_time_sec or 0) + time_spent_sec

    today = date.today().isoformat()
    dp = db.query(DailyProgress).filter(
        DailyProgress.user_id == user_id,
        DailyProgress.date == today,
    ).first()
    if not dp:
        dp = DailyProgress(user_id=user_id, date=today)
        db.add(dp)
    dp.total_time_sec = (dp.total_time_sec or 0) + time_spent_sec

    event = ProctoringEvent(
        profile_id=profile.id,
        concept_node_id=concept_node_id,
        event_type="content_viewed",
        payload={"time_spent_sec": time_spent_sec},
    )
    db.add(event)
    db.commit()
