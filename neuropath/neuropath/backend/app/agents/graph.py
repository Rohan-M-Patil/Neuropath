"""
NeuroPath LangGraph Orchestration (v2)
========================================

Main pipeline:
    KnowledgeSourceAgent -> CurriculumAgent -> SimulationAgent -> MindMapAgent

Assessment sub-graph:
    AssessmentAgent --(pass)--> END
                     --(fail)--> FeedbackAgent --> END
"""
from typing import TypedDict, List, Dict, Any, Optional, Literal
from langgraph.graph import StateGraph, END

from app.agents import (
    knowledge_source_agent, curriculum_agent, simulation_agent,
    assessment_agent, mind_map_agent, feedback_agent,
)


class NeuroPathState(TypedDict, total=False):
    mode_input: Literal["topic", "book"]
    topic: Optional[str]
    document_text: Optional[str]
    chapters: Optional[List[Dict[str, Any]]]
    proctor_profile: Dict[str, Any]

    source_mode: Literal["topic", "book"]
    concept_dag: Dict[str, Any]
    simulations: List[Dict[str, Any]]
    mind_map: Dict[str, Any]

    quiz_json: Dict[str, Any]
    answers: Dict[str, Any]
    per_question_time: Dict[str, float]
    current_node: Dict[str, Any]
    score: float
    passed: bool

    weak_areas: List[str]
    strong_areas: List[str]
    section_scores: Dict[str, float]
    recommended_node_keys: List[str]
    remediation_text: str
    difficulty_adjustment: str
    focus_areas: List[str]

    agent_logs: List[Dict[str, Any]]


def build_main_graph():
    g = StateGraph(NeuroPathState)
    g.add_node("knowledge_source_agent", knowledge_source_agent.run)
    g.add_node("curriculum_agent", curriculum_agent.run)
    g.add_node("simulation_agent", simulation_agent.run)
    g.add_node("mind_map_agent", mind_map_agent.run)

    g.set_entry_point("knowledge_source_agent")
    g.add_edge("knowledge_source_agent", "curriculum_agent")
    g.add_edge("curriculum_agent", "simulation_agent")
    g.add_edge("simulation_agent", "mind_map_agent")
    g.add_edge("mind_map_agent", END)
    return g.compile()


def route_after_assessment(state: NeuroPathState) -> str:
    return "feedback_agent" if not state.get("passed") else "end"


def build_assessment_graph():
    g = StateGraph(NeuroPathState)
    g.add_node("assessment_agent", assessment_agent.run)
    g.add_node("feedback_agent", feedback_agent.run)
    g.set_entry_point("assessment_agent")
    g.add_conditional_edges(
        "assessment_agent", route_after_assessment,
        {"feedback_agent": "feedback_agent", "end": END},
    )
    g.add_edge("feedback_agent", END)
    return g.compile()


main_graph = build_main_graph()
assessment_graph = build_assessment_graph()
