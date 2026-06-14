"""
Agent 6: Feedback + Roadmap Rewriter Agent (v2)
------------------------------------------------
On quiz failure:
  1. Analyses weak/strong areas + proctoring telemetry
  2. Recommends specific prerequisite nodes to revisit
  3. Decides difficulty adjustment for future quizzes
  4. Writes a personalized, actionable remediation message

On roadmap reroute trigger:
  1. Reorders the sequential_order list based on mastery and weaknesses
"""
from app.agents.utils import log_agent_step
from app.services.llm_client import call_llm_json

FEEDBACK_SYSTEM = """You are the Feedback & Remediation Agent in NeuroPath.
A learner failed a quiz. Analyze their performance and generate a personalized remediation plan.

weak_areas/strong_areas are tagged with the section level they came from, e.g.
"easy: definition of X" or "hard: edge-case handling of null inputs". Pay special
attention to any "easy:" entries in weak_areas — missing fundamentals is the most
important gap to call out, even if the overall score was close to passing.

Return STRICT JSON:
{
  "recommended_node_keys": ["c_01"],
  "difficulty_adjustment": "increase"|"decrease"|"maintain",
  "remediation_text": "Warm, specific 2-3 sentence guidance. Name the exact gaps (call out 'easy' gaps first if present). Suggest concrete action.",
  "focus_areas": ["specific sub-topic to study first", "..."],
  "estimated_retry_minutes": 15
}

Rules:
- recommended_node_keys must be from the provided prerequisites list only.
- If no prerequisites, recommend current node itself.
- Be specific — reference actual weak_areas in the remediation text.
- difficulty_adjustment: decrease if score < 0.4 OR any "easy:" weak area is present,
  maintain if 0.4-0.6, increase if 0.6-0.75 (barely failed on medium/hard only).
"""


def run(state: dict) -> dict:
    start = log_agent_step.start()
    weak_areas = state.get("weak_areas", [])
    strong_areas = state.get("strong_areas", [])
    section_scores = state.get("section_scores", {})
    current_node = state.get("current_node", {})
    prerequisites = current_node.get("prerequisites", [])
    score = state.get("score", 0.0)
    proctor = state.get("proctor_profile", {})

    failed_easy = section_scores.get("easy", 1.0) < 1.0

    user_prompt = (
        f"Concept failed: {current_node.get('title')}\n"
        f"Overall score: {score:.0%}\n"
        f"Section scores: {section_scores}\n"
        f"Failed the easy section: {failed_easy}\n"
        f"Weak sub-areas (level: tag): {weak_areas}\n"
        f"Strong sub-areas (level: tag): {strong_areas}\n"
        f"Available prerequisite node_keys: {prerequisites or [current_node.get('node_key')]}\n"
        f"Learner's overall weak tags (history): {proctor.get('weakness_tags', [])[:5]}\n"
        f"Learner's correct rate: {proctor.get('correct_rate', 0.5):.0%}\n"
    )

    result = call_llm_json(FEEDBACK_SYSTEM, user_prompt)
    result.setdefault("recommended_node_keys", prerequisites[:1] if prerequisites else [current_node.get("node_key")])
    result.setdefault("remediation_text", "Review the prerequisite concepts carefully before retrying.")
    result.setdefault("difficulty_adjustment", "maintain")

    # Hard override: missing "easy" fundamentals always implies a difficulty decrease,
    # regardless of what the LLM returned.
    if failed_easy:
        result["difficulty_adjustment"] = "decrease"

    log = log_agent_step.finish(
        start, "FeedbackAgent", "generate_remediation_plan",
        input_summary=f"score={score:.2f}, weak={weak_areas}",
        output_summary=f"recommended={result['recommended_node_keys']}, adj={result['difficulty_adjustment']}",
    )
    return {
        "recommended_node_keys": result["recommended_node_keys"],
        "remediation_text": result["remediation_text"],
        "difficulty_adjustment": result.get("difficulty_adjustment", "maintain"),
        "focus_areas": result.get("focus_areas", []),
        "agent_logs": state.get("agent_logs", []) + [log],
    }
