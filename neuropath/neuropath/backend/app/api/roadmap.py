from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import (
    UploadedDocument, SessionModel, LearningPath, ConceptNode,
    MindMap, Simulation, AgentLog, ProctoringProfile, User,
)
from app.models.schemas import (
    GenerateRoadmapRequest, GenerateRoadmapResponse, ConceptNodeOut,
)
from app.agents.graph import main_graph
from app.services.auth import get_current_user

router = APIRouter()


@router.post("/generate-roadmap", response_model=GenerateRoadmapResponse)
def generate_roadmap(
    payload: GenerateRoadmapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    # 1. Create session
    session = SessionModel(
        user_id=user_id,
        mode=payload.mode,
        topic=payload.topic,
        document_id=payload.document_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # 2. Load proctoring profile for personalization
    profile = db.query(ProctoringProfile).filter(ProctoringProfile.user_id == user_id).first()
    proctor_dict = {}
    if profile:
        proctor_dict = {
            "preferred_difficulty": profile.preferred_difficulty,
            "weakness_tags": profile.weakness_tags or [],
            "strength_tags": profile.strength_tags or [],
            "correct_rate": profile.correct_rate,
        }

    # 3. Build initial graph state
    if payload.mode == "topic":
        if not payload.topic:
            raise HTTPException(status_code=400, detail="topic is required for topic mode")
        init_state = {
            "mode_input": "topic", "topic": payload.topic,
            "proctor_profile": proctor_dict, "agent_logs": [],
        }
        title = payload.topic
    elif payload.mode == "book":
        if not payload.document_id:
            raise HTTPException(status_code=400, detail="document_id is required for book mode")
        doc = db.query(UploadedDocument).filter(UploadedDocument.id == payload.document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="document not found")
        init_state = {
            "mode_input": "book",
            "document_text": doc.extracted_text or "",
            "chapters": doc.chapters_json or [],
            "proctor_profile": proctor_dict,
            "agent_logs": [],
        }
        title = doc.filename
    else:
        raise HTTPException(status_code=400, detail="mode must be 'topic' or 'book'")

    # 4. Run main LangGraph workflow
    result = main_graph.invoke(init_state)

    dag = result["concept_dag"]
    simulations = result.get("simulations", [])
    mind_map_json = result.get("mind_map", {"nodes": [], "links": []})
    agent_logs = result.get("agent_logs", [])
    sequential_order = dag.get("sequential_order") or [n["node_key"] for n in dag.get("nodes", [])]

    # 5. Persist learning path
    learning_path = LearningPath(
        user_id=user_id,
        session_id=session.id,
        title=title,
        source_type=payload.mode,
        dag_json=dag,
        sequential_order=sequential_order,
        current_step=0,
        difficulty_level=proctor_dict.get("preferred_difficulty", "adaptive"),
    )
    db.add(learning_path)
    db.commit()
    db.refresh(learning_path)

    # 6. Persist concept nodes — SEQUENTIAL LOCKING:
    #    Only the first node in sequential_order is "available"; all others "locked",
    #    regardless of prerequisites list, enforcing strict sequential progression.
    node_objs = {}
    for n in dag.get("nodes", []):
        seq_pos = n.get("sequential_position", 0)
        status = "available" if (sequential_order and n["node_key"] == sequential_order[0]) else "locked"
        cn = ConceptNode(
            learning_path_id=learning_path.id,
            node_key=n["node_key"],
            title=n["title"],
            description=n.get("description"),
            prerequisites=n.get("prerequisites", []),
            sequential_position=seq_pos,
            difficulty=n.get("difficulty", 1),
            chapter_reference=n.get("chapter_reference"),
            simulation_type=n.get("simulation_type", "generic_3d"),
            content_md=n.get("content_md"),
            status=status,
        )
        db.add(cn)
        node_objs[n["node_key"]] = cn
    db.commit()
    for cn in node_objs.values():
        db.refresh(cn)

    # 7. Persist simulations (every node gets one)
    for sim in simulations:
        node_key = sim.get("node_key")
        cn = node_objs.get(node_key)
        if not cn:
            continue
        db.add(Simulation(
            concept_node_id=cn.id,
            template_type=sim["template_type"],
            title=sim["title"],
            config_json={**sim["config_json"], "_description": sim.get("description", "")},
        ))
    db.commit()

    # 8. Persist mind map
    db.add(MindMap(
        learning_path_id=learning_path.id,
        title=f"{title} - Mind Map",
        map_json=mind_map_json,
    ))

    # 9. Persist agent logs
    for log in agent_logs:
        db.add(AgentLog(
            session_id=session.id,
            agent_name=log["agent_name"], action=log["action"],
            input_summary=log.get("input_summary"), output_summary=log.get("output_summary"),
            status=log.get("status", "success"), duration_ms=log.get("duration_ms"),
        ))
    db.commit()

    return GenerateRoadmapResponse(
        learning_path_id=learning_path.id,
        session_id=session.id,
        title=title,
        nodes=[
            ConceptNodeOut(
                id=node_objs[n["node_key"]].id,
                node_key=n["node_key"],
                title=n["title"],
                description=n.get("description"),
                prerequisites=n.get("prerequisites", []),
                sequential_position=n.get("sequential_position", 0),
                difficulty=n.get("difficulty", 1),
                chapter_reference=n.get("chapter_reference"),
                simulation_type=n.get("simulation_type"),
                status=node_objs[n["node_key"]].status,
                mastery_score=0.0,
                key_skills=n.get("key_skills", []),
                estimated_minutes=n.get("estimated_minutes"),
                content_md=n.get("content_md"),
            )
            for n in dag.get("nodes", [])
        ],
        edges=dag.get("edges", []),
        sequential_order=sequential_order,
        current_step=0,
        mind_map=mind_map_json,
        simulations=simulations,
        agent_logs=agent_logs,
    )
