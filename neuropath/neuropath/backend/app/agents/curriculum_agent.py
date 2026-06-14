"""
Agent 2: Curriculum Agent (v3)
-------------------------------
Produces a HIGH-QUALITY sequential concept DAG, then enriches every node with
real lesson content:
  - 8-12 nodes ordered strictly by prerequisite depth
  - Every node gets a simulation_type (ALL nodes get a 3D simulation)
  - Sequential position numbers for locked progression
  - Simulation type assigned intelligently per concept
  - content_md: 150-300 words of topic-relevant Markdown lesson content per node

Two LLM calls are made (DAG structure, then lesson content) to avoid
JSON-truncation risk on a single very large response.
"""
from app.agents.utils import log_agent_step
from app.services.llm_client import call_llm_json

SYSTEM_PROMPT = """You are the Curriculum Agent in NeuroPath — an expert instructional designer and domain expert.

Your task: Given a topic or document text, generate a rigorous, sequenced concept roadmap.

STRICT REQUIREMENTS:
1. Generate 8-12 concept nodes in strict prerequisite order (simplest first, most advanced last).
2. Each concept must be genuinely prerequisite-ordered — no learner should encounter node N without mastering all nodes listed in its prerequisites.
3. Assign sequential_position integers 1,2,3... matching learning order.
4. For simulation_type, assign ONE of: "graph_algorithms" | "sorting" | "neural_network" | "math_physics" | "data_structures" | "system_architecture" | "probability_stats" | "comparison_3d" | "timeline_3d" | "state_machine_3d" | "generic_3d"
   - EVERY node must have a simulation_type (no nulls). Pick the most pedagogically relevant type.
   - Use comparison_3d for concepts that contrast 2-4 things (e.g. TCP vs UDP, supervised vs unsupervised).
   - Use timeline_3d for sequential processes/lifecycles (e.g. HTTP request flow, training loop, CI/CD pipeline).
   - Use state_machine_3d for concepts defined by states and transitions (e.g. TCP connection states, process lifecycle, Git branches).
   - Use generic_3d only as a last resort when nothing else fits.
5. For difficulty: 1=foundations, 2=basic, 3=intermediate, 4=advanced, 5=expert.

Return STRICT JSON:
{
  "nodes": [
    {
      "node_key": "c_01",
      "title": "Short precise concept title",
      "description": "2-3 sentence explanation of what this concept is and why it matters in the learning journey.",
      "prerequisites": [],
      "sequential_position": 1,
      "difficulty": 1,
      "chapter_reference": null,
      "simulation_type": "math_physics",
      "key_skills": ["skill1", "skill2"],
      "estimated_minutes": 20
    }
  ],
  "edges": [
    {"source": "c_01", "target": "c_02"}
  ],
  "sequential_order": ["c_01", "c_02", "c_03"]
}

sequential_order must list ALL node_keys in the exact order they should be studied.
Edges represent prerequisite→dependent (must be consistent with prerequisites arrays).
"""

CONTENT_SYSTEM_PROMPT = """You are the Curriculum Agent's content-writing module for NeuroPath.

For EACH concept node provided, write 150-300 words of Markdown lesson content
that teaches the concept SPECIFICALLY IN THE CONTEXT of the overall course topic
(do not write a generic textbook definition — frame it for THIS course).

Structure for each content_md:
1. A short intro paragraph (2-4 sentences) explaining the concept in the context
   of the overall topic/course.
2. 2-3 bullet points of key takeaways (use Markdown "- " bullets).
3. One closing sentence starting with "**Why this matters:**" connecting this
   concept to the next concept or the overall learning goal.

For BOOK MODE (when source excerpts are provided): ground the explanation in the
provided document excerpt — paraphrase and structure it faithfully, reference the
chapter_reference naturally, and do NOT invent facts not supported by the excerpt.

For TOPIC MODE: use accurate, course-specific framing — the same concept should
read differently depending on the course's overall topic.

Return STRICT JSON:
{
  "contents": [
    {"node_key": "c_01", "content_md": "Intro paragraph...\\n\\n- Key point 1\\n- Key point 2\\n- Key point 3\\n\\n**Why this matters:** ..."}
  ]
}
Include an entry for EVERY node_key provided. No omissions.
"""


def run(state: dict) -> dict:
    start = log_agent_step.start()

    proctor = state.get("proctor_profile", {})
    difficulty_hint = proctor.get("preferred_difficulty", "medium")
    weak_tags = proctor.get("weakness_tags", [])
    strong_tags = proctor.get("strength_tags", [])

    document_excerpt = ""

    if state["source_mode"] == "topic":
        user_prompt = (
            f"Topic: {state['topic']}\n\n"
            f"Learner profile:\n"
            f"  Preferred difficulty: {difficulty_hint}\n"
            f"  Already strong in: {strong_tags[:5]}\n"
            f"  Needs reinforcement in: {weak_tags[:5]}\n\n"
            "Generate a complete concept DAG for mastering this topic from scratch. "
            "If the learner is already strong in some foundational areas, mark those nodes difficulty=1 "
            "but still include them for completeness."
        )
        input_summary = f"topic={state['topic']}, difficulty={difficulty_hint}"
        topic_label = state["topic"]
    else:
        text = state.get("document_text", "")[:10000]
        chapters = state.get("chapters", [])
        chapter_titles = [c.get("title","") for c in chapters[:15]]
        user_prompt = (
            f"Document chapters: {chapter_titles}\n\n"
            f"Document excerpt:\n{text[:6000]}\n\n"
            f"Learner preferred difficulty: {difficulty_hint}\n\n"
            "Generate a concept DAG based on the document's chapters and concepts. "
            "Use chapter titles for chapter_reference where identifiable."
        )
        input_summary = f"chapters={len(chapters)}, text_len={len(text)}"
        topic_label = chapter_titles[0] if chapter_titles else "this document"
        document_excerpt = text[:6000]

    # ---- Call 1: DAG structure ----
    dag = call_llm_json(SYSTEM_PROMPT, user_prompt, max_tokens=4096)
    dag.setdefault("nodes", [])
    dag.setdefault("edges", [])

    if not dag.get("sequential_order"):
        dag["sequential_order"] = [n["node_key"] for n in dag["nodes"]]

    for n in dag["nodes"]:
        if not n.get("simulation_type"):
            n["simulation_type"] = "generic_3d"

    # ---- Call 2: lesson content per node ----
    content_nodes = [
        {
            "node_key": n["node_key"], "title": n["title"],
            "description": n.get("description", ""),
            "chapter_reference": n.get("chapter_reference"),
            "key_skills": n.get("key_skills", []),
        }
        for n in dag["nodes"]
    ]
    content_user_prompt = (
        f"Overall course topic: {topic_label}\n"
        f"Source mode: {state['source_mode']}\n"
        + (f"Document excerpt (ground content in this for book mode):\n{document_excerpt}\n\n" if document_excerpt else "\n")
        + f"Concept nodes (in learning order):\n{content_nodes}\n\n"
        "Write content_md for every node as specified."
    )

    try:
        content_result = call_llm_json(CONTENT_SYSTEM_PROMPT, content_user_prompt, max_tokens=8000)
        content_by_key = {c["node_key"]: c.get("content_md", "") for c in content_result.get("contents", [])}
    except Exception:
        content_by_key = {}

    for n in dag["nodes"]:
        n["content_md"] = content_by_key.get(n["node_key"], "")

    log = log_agent_step.finish(
        start, agent_name="CurriculumAgent", action="generate_sequential_dag_and_content",
        input_summary=input_summary,
        output_summary=f"nodes={len(dag['nodes'])}, edges={len(dag['edges'])}, content_generated={sum(1 for v in content_by_key.values() if v)}",
    )
    return {"concept_dag": dag, "agent_logs": state.get("agent_logs", []) + [log]}
