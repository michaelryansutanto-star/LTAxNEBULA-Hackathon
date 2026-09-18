from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings,SettingsConfigDict

class Settings(BaseSettings):
    model_config=SettingsConfigDict(env_prefix="COMMUTESURE_",env_file=".env",extra="ignore")
    database_path:Path=Path("commutesure.db")
    demo_mode:bool=False
    simulation_samples:int=Field(default=5000,ge=100,le=100_000)
    simulation_seed:int=Field(default=42,ge=0,le=2_147_483_647)
    rate_limit_per_minute:int=Field(default=120,ge=1,le=10_000)
    allowed_origins:list[str]=Field(default_factory=lambda:["http://localhost:5173","http://127.0.0.1:5173","http://localhost:4173","http://127.0.0.1:4173"])
