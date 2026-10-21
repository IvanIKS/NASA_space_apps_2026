from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import positions, observations

Base.metadata.create_all(bind=engine)

app = FastAPI(title="NASA Space Apps 2026", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(positions.router)
app.include_router(observations.router)


@app.get("/health")
def health():
    return {"status": "ok"}
