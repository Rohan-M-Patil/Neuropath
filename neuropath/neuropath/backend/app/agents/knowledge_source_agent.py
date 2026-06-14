"""
Agent 1: Knowledge Source Agent
--------------------------------
Responsibilities:
  - Detect whether input is a topic string or an uploaded document
  - Route to "topic" or "book" mode
  - Normalize input for downstream agents (e.g. truncate huge book text)

Output keys written to state:
  - source_mode: "topic" | "book"
  - topic (if topic mode, unchanged)
  - document_text / chapters (if book mode, passed through, possibly truncated)
"""

from app.agents.utils import log_agent_step

MAX_DOC_CHARS = 12000  # cap text sent downstream to control token usage


def run(state: dict) -> dict:
    start = log_agent_step.start()

    if state.get("mode_input") == "book" and state.get("document_text"):
        source_mode = "book"
        doc_text = state["document_text"]
        if len(doc_text) > MAX_DOC_CHARS:
            doc_text = doc_text[:MAX_DOC_CHARS]
        output = {
            "source_mode": source_mode,
            "document_text": doc_text,
            "chapters": state.get("chapters", []),
            "proctor_profile": state.get("proctor_profile", {}),
        }
    else:
        source_mode = "topic"
        output = {
            "source_mode": source_mode,
            "topic": state.get("topic", "").strip(),
            "proctor_profile": state.get("proctor_profile", {}),
        }

    log = log_agent_step.finish(
        start,
        agent_name="KnowledgeSourceAgent",
        action="detect_source_and_route",
        input_summary=f"mode_input={state.get('mode_input')}",
        output_summary=f"source_mode={source_mode}",
    )

    return {**output, "agent_logs": state.get("agent_logs", []) + [log]}
