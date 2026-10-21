from datetime import datetime
from sqlalchemy import Float, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    utc: Mapped[str] = mapped_column(String(32))
    lat_deg: Mapped[float] = mapped_column(Float)
    lon_deg: Mapped[float] = mapped_column(float)
    alt_km: Mapped[float] = mapped_column(Float, default=0.0)
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)

    earth_az: Mapped[float | None] = mapped_column(Float, nullable=True)
    earth_el: Mapped[float | None] = mapped_column(Float, nullable=True)
    earth_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)

    sun_az: Mapped[float | None] = mapped_column(Float, nullable=True)
    sun_el: Mapped[float | None] = mapped_column(Float, nullable=True)
    sun_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
