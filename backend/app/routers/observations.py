from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Observation
from ..schemas import ObservationCreate, ObservationOut

router = APIRouter(prefix="/observations", tags=["observations"])


@router.get("/", response_model=list[ObservationOut])
def list_observations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Observation).order_by(Observation.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=ObservationOut, status_code=201)
def create_observation(body: ObservationCreate, db: Session = Depends(get_db)):
    obs = Observation(**body.model_dump())
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs


@router.delete("/{obs_id}", status_code=204)
def delete_observation(obs_id: int, db: Session = Depends(get_db)):
    obs = db.get(Observation, obs_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    db.delete(obs)
    db.commit()
