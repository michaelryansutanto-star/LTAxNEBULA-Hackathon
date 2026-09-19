from pathlib import Path
from pydantic import Field,field_validator
from pydantic_settings import BaseSettings,SettingsConfigDict

SERVICE_ROOT=Path(__file__).resolve().parents[1]
ENV_FILE=SERVICE_ROOT/".env"

class Settings(BaseSettings):
    model_config=SettingsConfigDict(env_prefix="COMMUTESURE_",env_file=ENV_FILE,extra="ignore")
    database_path:Path=Path("commutesure.db")
    demo_mode:bool=False
    simulation_samples:int=Field(default=5000,ge=100,le=100_000)
    simulation_seed:int=Field(default=42,ge=0,le=2_147_483_647)
    # SGD per hour used to weigh fare against travel time in the best-value comparison; an adjustable assumption, not a measured figure.
    value_of_time_per_hour:float=Field(default=12.0,ge=0,le=200)
    rate_limit_per_minute:int=Field(default=120,ge=1,le=10_000)
    allowed_origins:list[str]=Field(default_factory=lambda:["http://localhost:5173","http://127.0.0.1:5173","http://localhost:4173","http://127.0.0.1:4173"])
    @field_validator("database_path")
    @classmethod
    def anchor_database_path(cls,value:Path)->Path:
        # A relative path is anchored to services/api so the same database is used whatever directory the server starts from.
        return value if value.is_absolute() else SERVICE_ROOT/value
