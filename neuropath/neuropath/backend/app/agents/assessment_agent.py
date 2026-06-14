"""
Agent 4: Assessment Agent (v3)
-------------------------------
Generates TIERED adaptive quizzes split into 3 sections — easy / medium / hard
(2 questions each, 6 total) — that adjust based on:
  - proctoring profile (difficulty, weak areas)
  - node difficulty level
  - past performance on this concept

Scoring:
  - Overall score = total correct / 6
  - Per-section scores: {"easy": x, "medium": y, "hard": z} each in [0, 1]
  - PASS requires: overall >= 0.75 AND easy section == 1.0
    (a learner who misses "easy" questions hasn't mastered fundamentals,
    regardless of overall %)
"""
from app.agents.utils import log_agent_step
from app.services.llm_client import call_llm_json

QUIZ_SYSTEM_PROMPT = """You are the Assessment Agent in NeuroPath — an expert educator and psychometrician.

Generate an adaptive multiple-choice quiz for the given concept, split into
THREE SECTIONS with exactly 2 questions each:

- "easy" section: recall/definition level — straightforward, tests basic understanding.
- "medium" section: application/comparison level — apply the concept to a scenario,
  or compare it with a related idea.
- "hard" section: scenario/synthesis/edge-case level — multi-step reasoning,
  edge cases, or "which of the following is FALSE/NOT true" style questions.

QUALITY RULES:
1. Questions must test UNDERSTANDING, not memorization.
2. Wrong options (distractors) must be plausible — not obviously wrong.
3. Each question tests a distinct sub-skill (no repetition across the whole quiz).
4. Adapt to the learner's profile:
   - If preferred_difficulty == "easy": make the easy section extra scaffolded
     (clear, unambiguous wording) and slightly soften the hard section.
   - If preferred_difficulty == "hard": in the medium/hard sections, include at
     least one multi-step or "which of the following is FALSE" style question.
   - If the learner has weak sub-areas listed, target at least one medium/hard
     question at one of those areas.
5. concept_tag must be a 2-4 word specific sub-skill label.

Return STRICT JSON:
{
  "sections": [
    {
      "level": "easy",
      "questions": [
        {
          "id": "q1",
          "question": "Full question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_index": 0,
          "explanation": "Why this answer is correct (shown after submission)",
          "concept_tag": "sub-skill tag"
        },
        { "id": "q2", ... }
      ]
    },
    { "level": "medium", "questions": [ {"id": "q3", ...}, {"id": "q4", ...} ] },
    { "level": "hard", "questions": [ {"id": "q5", ...}, {"id": "q6", ...} ] }
  ],
  "quiz_difficulty": "medium",
  "estimated_minutes": 10
}

Exactly 4 options per question, exactly 2 questions per section, 6 total.
Question ids must be q1..q6 in section order (easy=q1,q2; medium=q3,q4; hard=q5,q6).
Correct_index is 0-based.
"""

PASS_THRESHOLD = 0.75
EASY_PASS_THRESHOLD = 1.0


def generate_quiz(node: dict, proctor: dict = None) -> dict:
    proctor = proctor or {}
    weak_tags = proctor.get("weakness_tags", [])
    difficulty = proctor.get("preferred_difficulty", "medium")
    node_diff = node.get("difficulty", 3)

    user_prompt = (
        f"Concept: {node['title']}\n"
        f"Description: {node.get('description', '')}\n"
        f"Node difficulty level: {node_diff}/5\n"
        f"Learner's preferred_difficulty: {difficulty}\n"
        f"Learner's weak sub-areas to probe: {weak_tags[:5]}\n"
        f"Key skills: {node.get('key_skills', [])}\n\n"
        "Generate a rigorous tiered (easy/medium/hard) 6-question adaptive quiz."
    )
    result = call_llm_json(QUIZ_SYSTEM_PROMPT, user_prompt, max_tokens=4096)
    result.setdefault("sections", [])
    return result


def _all_questions(quiz: dict) -> list[dict]:
    """Flatten sectioned quiz into a single list, each annotated with its level."""
    questions = []
    for section in quiz.get("sections", []):
        level = section.get("level", "medium")
        for q in section.get("questions", []):
            q = dict(q)
            q["_level"] = level
            questions.append(q)
    return questions


def run(state: dict) -> dict:
    """Assessment sub-graph node — evaluates submitted answers."""
    start = log_agent_step.start()
    quiz = state["quiz_json"]
    answers = state.get("answers", {})

    questions = _all_questions(quiz)
    total = len(questions) or 1
    correct = 0
    weak_areas = []
    strong_areas = []

    section_correct: dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}
    section_total: dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}

    for q in questions:
        qid = q["id"]
        level = q.get("_level", "medium")
        section_total[level] = section_total.get(level, 0) + 1
        user_ans = answers.get(qid)
        is_correct = (user_ans == q["correct_index"])
        tag = q.get("concept_tag", "")
        labeled_tag = f"{level}: {tag}" if tag else level
        if is_correct:
            correct += 1
            section_correct[level] = section_correct.get(level, 0) + 1
            strong_areas.append(labeled_tag)
        else:
            weak_areas.append(labeled_tag)

    score = correct / total
    section_scores = {
        level: (section_correct[level] / section_total[level]) if section_total.get(level) else 1.0
        for level in ("easy", "medium", "hard")
    }

    easy_score = section_scores.get("easy", 1.0)
    passed = (score >= PASS_THRESHOLD) and (easy_score >= EASY_PASS_THRESHOLD)

    log = log_agent_step.finish(
        start, "AssessmentAgent", "evaluate_answers",
        input_summary=f"questions={total}",
        output_summary=f"score={score:.2f}, sections={section_scores}, passed={passed}",
    )
    return {
        "score": score, "passed": passed,
        "section_scores": section_scores,
        "weak_areas": weak_areas, "strong_areas": strong_areas,
        "agent_logs": state.get("agent_logs", []) + [log],
    }
