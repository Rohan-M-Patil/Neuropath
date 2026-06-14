"""
Agent 5: Mind Map Agent
------------------------
Responsibilities:
  - Transform the concept DAG into a D3-renderable mind map graph
    (hierarchical / radial layout friendly structure).

Output:
  - mind_map: { "nodes": [{"id","label","group"}], "links": [{"source","target"}] }

Note: This agent is largely a transform, no LLM call needed, to keep MVP fast & cheap.
"""

from app.agents.utils import log_agent_step


def run(state: dict) -> dict:
    start = log_agent_step.start()

    dag = state.get("concept_dag", {"nodes": [], "edges": []})

    nodes = [
        {
            "id": n["node_key"],
            "label": n["title"],
            "group": n.get("difficulty", 1),
        }
        for n in dag.get("nodes", [])
    ]
    links = [
        {"source": e["source"], "target": e["target"]}
        for e in dag.get("edges", [])
    ]

    mind_map = {"nodes": nodes, "links": links}

    log = log_agent_step.finish(
        start,
        agent_name="MindMapAgent",
        action="generate_mind_map",
        input_summary=f"dag_nodes={len(nodes)}",
        output_summary=f"mind_map_nodes={len(nodes)}, links={len(links)}",
    )

    return {"mind_map": mind_map, "agent_logs": state.get("agent_logs", []) + [log]}
