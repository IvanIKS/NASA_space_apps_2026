from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import service.spice_service as spice_service
import service.landscape_service as landscape_service
from .database import engine, Base
from .routers import positions

Base.metadata.create_all(bind=engine)

landscape_service.load_map()
spice_service.load_kernels()



app = FastAPI(title="NASA Space Apps 2026", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(positions.router)



@app.get("/health")
def health():
    return {"status": "ok"}
