from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import (
    profile, financial_context, dashboard, calendar, documents, privacy,
    finances, analysis, simulate, actions, mentor,
)

settings = get_settings()

app = FastAPI(
    title="FinMentor API",
    description="Personal finance assistant: context layer, health & risk engine, "
                "forecast, what-if simulator, action planner and a local-LLM mentor.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(financial_context.router)
app.include_router(dashboard.router)
app.include_router(calendar.router)
app.include_router(documents.router)
app.include_router(privacy.router)
app.include_router(finances.router)
app.include_router(analysis.router)
app.include_router(simulate.router)
app.include_router(actions.router)
app.include_router(mentor.router)


@app.get("/health")
def health():
    return {"status": "ok"}
