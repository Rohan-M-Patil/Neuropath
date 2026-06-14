import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import UploadedDocument, User
from app.models.schemas import TopicRequest, UploadResponse
from app.services.file_processing import extract
from app.services.auth import get_current_user
from app.config import settings

router = APIRouter()


@router.post("/topic")
def submit_topic(payload: TopicRequest, current_user: User = Depends(get_current_user)):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    return {"mode": "topic", "topic": topic, "next_step": "/generate-roadmap"}


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = file.filename
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    doc_id = str(uuid.uuid4())
    saved_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}.{ext}")

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    try:
        extracted = extract(saved_path, ext)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {e}")

    document = UploadedDocument(
        id=doc_id, user_id=current_user.id, filename=filename, file_type=ext,
        file_path=saved_path, extracted_text=extracted["text"],
        chapters_json=extracted["chapters"], status="parsed",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return UploadResponse(
        document_id=document.id, filename=document.filename, file_type=document.file_type,
        chapters=[{"title": c["title"]} for c in extracted["chapters"]], status=document.status,
    )
