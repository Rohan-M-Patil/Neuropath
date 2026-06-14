from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import intake, roadmap, learning, auth, dashboard

app = FastAPI(title="NeuroPath API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, tags=["auth"])
app.include_router(intake.router, tags=["intake"])
app.include_router(roadmap.router, tags=["roadmap"])
app.include_router(learning.router, tags=["learning"])
app.include_router(dashboard.router, tags=["dashboard"])


@app.get("/")
def root():
    return {"status": "ok", "service": "NeuroPath API"}


@app.get("/health")
def health():
    return {"status": "healthy"}
