"""
Agent 3: Simulation Agent (v3)
-------------------------------
Every concept node gets a CONCEPT-SPECIFIC 3D simulation config with a
mandatory "learning_focus" caption. Template types:

  - graph_algorithms      (BFS/DFS/Dijkstra on 3D graph)
  - sorting               (3D bar chart sort animation)
  - neural_network        (3D animated neuron layers)
  - math_physics          (vectors, projectile, sine, fourier, gradient descent)
  - data_structures       (stack, queue, tree, linked list, hash table 3D)
  - system_architecture   (3D node cluster: microservices, k8s pods)
  - probability_stats     (3D histogram, normal curve, scatter)
  - comparison_3d         (NEW: side-by-side 3D comparison of 2-4 entities)
  - timeline_3d           (NEW: sequential 3D timeline / process flow)
  - state_machine_3d      (NEW: 3D state diagram with transitions)
  - generic_3d            (concept-specific particle/orbit 3D scene — last resort)

Each generated simulation is validated; any node whose config is empty/trivial
is regenerated individually with a stricter retry prompt before persisting.
"""
from app.agents.utils import log_agent_step
from app.services.llm_client import call_llm_json

SYSTEM_PROMPT = """You are the Simulation Agent in NeuroPath — an expert in instructional
visualization design.

For EACH concept node:
1. First privately reason about WHAT VISUAL METAPHOR best teaches THIS SPECIFIC
   concept (do not output this reasoning — use it only to choose the template
   and fill in realistic, concept-tied values).
2. Pick the template type that best fits (see schemas below).
3. Fill config_json with values that are PEDAGOGICALLY TIED to the concept's
   actual content — not generic placeholders. Numbers, labels, and steps must
   make sense for this specific concept.
4. Always include "learning_focus": one sentence telling the learner exactly
   what to notice or conclude from interacting with this simulation.

Template schemas:

graph_algorithms: {"algorithm":"bfs"|"dfs"|"dijkstra", "graph":{"nodes":[{"id":"A"}], "edges":[{"source":"A","target":"B","weight":1}]}, "start_node":"A", "learning_focus":"..."}
sorting: {"algorithm":"bubble"|"merge"|"quick"|"heap", "array":[list of 8-12 distinct ints 1-99], "learning_focus":"..."}
neural_network: {"layers":[{"name":"Input","neurons":3},{"name":"Hidden","neurons":4},{"name":"Output","neurons":2}], "activation":"relu"|"sigmoid", "animate_forward_pass":true, "learning_focus":"..."}
math_physics: {"scenario":"vectors"|"projectile_motion"|"sine_wave"|"fourier"|"gradient_descent", "params":{...relevant numeric params}, "learning_focus":"..."}
data_structures: {"structure":"stack"|"queue"|"binary_tree"|"linked_list"|"hash_table", "operations":[{"op":"push"|"enqueue"|"insert","value":5},...], "initial_values":[1,2,3], "learning_focus":"..."}
system_architecture: {"type":"microservices"|"kubernetes"|"pipeline"|"distributed", "nodes":[{"id":"svc_a","label":"Auth Service","type":"service"}], "connections":[{"from":"svc_a","to":"svc_b","label":"REST"}], "learning_focus":"..."}
probability_stats: {"scenario":"normal_distribution"|"histogram"|"scatter"|"bayes", "params":{"mean":0,"std":1,"samples":200}, "learning_focus":"..."}
comparison_3d: {"items":[{"label":"CPU","value":85,"color":"#7C9CFF"},{"label":"GPU","value":40,"color":"#FF7A45"}], "metric_label":"Cores", "learning_focus":"..."}
  - 2-4 items. Use this for concepts that contrast two or more things.
timeline_3d: {"steps":[{"label":"Request sent","detail":"Client opens TCP connection"},{"label":"...","detail":"..."}], "loop":true, "learning_focus":"..."}
  - 4-7 steps. Use this for sequential processes/lifecycles.
state_machine_3d: {"states":[{"id":"s1","label":"IDLE"},{"id":"s2","label":"CONNECTING"}], "transitions":[{"from":"s1","to":"s2","label":"connect()"}], "learning_focus":"..."}
  - 3-6 states with at least 2 transitions. Use for concepts defined by states/transitions.
generic_3d: {"scene":"orbit"|"particle_system"|"wave_interference"|"force_field", "params":{"color":"#7C9CFF","intensity":1.0,"count":80}, "learning_focus":"..."}
  - LAST RESORT ONLY — prefer a more specific template above.

Return STRICT JSON:
{
  "simulations": [
    {
      "node_key": "c_01",
      "template_type": "math_physics",
      "title": "Descriptive sim title",
      "description": "1 sentence: what this simulation demonstrates",
      "config_json": { ... includes learning_focus ... }
    }
  ]
}

IMPORTANT: Every node must get a simulation. config_json must NEVER have empty
arrays for the template's primary data field (graph.nodes, array, layers, items,
steps, states, etc.) — always provide real, concept-relevant data.
"""

RETRY_SYSTEM_PROMPT = """You are the Simulation Agent in NeuroPath.
Your previous attempt to generate a 3D simulation for this concept was rejected
because its config_json was empty or trivial (too few data points, or missing
learning_focus).

Generate a SINGLE simulation for the given concept, choosing the BEST template
from: graph_algorithms, sorting, neural_network, math_physics, data_structures,
system_architecture, probability_stats, comparison_3d, timeline_3d,
state_machine_3d, generic_3d.

Requirements:
- config_json's primary data field MUST have realistic, concept-specific values
  (no empty arrays, no placeholder zeros).
- config_json MUST include a non-empty "learning_focus" string.

Return STRICT JSON:
{
  "node_key": "c_01",
  "template_type": "...",
  "title": "...",
  "description": "...",
  "config_json": { ... }
}
"""

# Minimum size of the template's primary data field for a config to be considered valid
_PRIMARY_FIELD = {
    "graph_algorithms": ("graph", lambda g: len(g.get("nodes", [])) >= 2 and len(g.get("edges", [])) >= 1),
    "sorting": ("array", lambda a: len(a) >= 2),
    "neural_network": ("layers", lambda l: len(l) >= 2),
    "data_structures": ("initial_values", lambda v: len(v) >= 1),
    "system_architecture": ("nodes", lambda n: len(n) >= 2),
    "comparison_3d": ("items", lambda i: len(i) >= 2),
    "timeline_3d": ("steps", lambda s: len(s) >= 2),
    "state_machine_3d": ("states", lambda s: len(s) >= 2),
    "math_physics": ("params", lambda p: isinstance(p, dict) and len(p) >= 1),
    "probability_stats": ("params", lambda p: isinstance(p, dict) and len(p) >= 1),
    "generic_3d": ("params", lambda p: isinstance(p, dict) and len(p) >= 1),
}


def _is_valid(sim: dict) -> bool:
    template = sim.get("template_type")
    cfg = sim.get("config_json", {})
    if not isinstance(cfg, dict):
        return False
    if not cfg.get("learning_focus"):
        return False
    check = _PRIMARY_FIELD.get(template)
    if not check:
        return False
    field, predicate = check
    try:
        return predicate(cfg.get(field))
    except Exception:
        return False


def _retry_single(node: dict) -> dict | None:
    user_prompt = (
        f"Concept: {node['title']}\n"
        f"Description: {node.get('description', '')}\n"
        f"node_key: {node['node_key']}\n"
        f"Originally suggested simulation_type: {node.get('simulation_type', 'generic_3d')}"
    )
    try:
        result = call_llm_json(RETRY_SYSTEM_PROMPT, user_prompt, temperature=0.4)
        result.setdefault("node_key", node["node_key"])
        if _is_valid(result):
            return result
    except Exception:
        pass
    return None


def run(state: dict) -> dict:
    start = log_agent_step.start()
    dag = state.get("concept_dag", {"nodes": []})

    sim_nodes = [
        {
            "node_key": n["node_key"],
            "title": n["title"],
            "description": n.get("description", ""),
            "simulation_type": n.get("simulation_type", "generic_3d"),
            "key_skills": n.get("key_skills", []),
        }
        for n in dag.get("nodes", [])
    ]

    if not sim_nodes:
        log = log_agent_step.finish(start, "SimulationAgent", "generate_simulations",
                                    output_summary="no nodes")
        return {"simulations": [], "agent_logs": state.get("agent_logs", []) + [log]}

    user_prompt = f"Generate 3D simulations for ALL these concept nodes:\n{sim_nodes}"
    result = call_llm_json(SYSTEM_PROMPT, user_prompt, max_tokens=6000)
    simulations = result.get("simulations", [])

    # ---- Validation + per-node retry for empty/trivial configs ----
    sims_by_key = {s.get("node_key"): s for s in simulations}
    retried = 0
    for n in sim_nodes:
        key = n["node_key"]
        sim = sims_by_key.get(key)
        if sim is None or not _is_valid(sim):
            fixed = _retry_single(n)
            if fixed:
                sims_by_key[key] = fixed
                retried += 1
            elif sim is None:
                # absolute fallback so every node still gets *something*
                sims_by_key[key] = {
                    "node_key": key, "template_type": "generic_3d",
                    "title": f"{n['title']} — overview",
                    "description": "An interactive overview of this concept.",
                    "config_json": {
                        "scene": "orbit",
                        "params": {"color": "#7C9CFF", "intensity": 1.0, "count": 40},
                        "learning_focus": f"Observe how the elements relate to {n['title']}.",
                    },
                }

    simulations = [sims_by_key[n["node_key"]] for n in sim_nodes]

    log = log_agent_step.finish(
        start, "SimulationAgent", "generate_3d_simulations",
        input_summary=f"nodes={len(sim_nodes)}",
        output_summary=f"simulations={len(simulations)}, retried={retried}",
    )
    return {"simulations": simulations, "agent_logs": state.get("agent_logs", []) + [log]}
