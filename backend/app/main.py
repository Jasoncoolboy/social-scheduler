import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import create_tables, SessionLocal
from app.services.scheduler_service import start_scheduler, shutdown_scheduler
from app.routers import auth, accounts, posts, dashboard

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting Social Scheduler...")
    create_tables()

    # Validate saved Instagram sessions on startup
    try:
        from app.services.instagram_service import validate_all_sessions
        db = SessionLocal()
        validate_all_sessions(db)
        db.close()
        logger.info("Instagram session validation complete")
    except Exception as e:
        logger.warning(f"Session validation error: {e}")

    start_scheduler()
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down...")
    shutdown_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

media_path = Path(settings.MEDIA_DIR)
media_path.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(posts.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}