from dataclasses import dataclass
from datetime import datetime,timedelta
import numpy as np
from .domain import EvaluationResult,Route,SegmentKind

@dataclass(frozen=True)
class SimulationConfig:
    samples:int=5000; seed:int=42; model_version:str="demo-v1"
    def __post_init__(self):
        if not 100<=self.samples<=100_000: raise ValueError("samples must be between 100 and 100000")

class Simulator:
    def __init__(self,config:SimulationConfig): self.config=config
    def evaluate(self,route:Route,now:datetime,deadline:datetime,input_snapshot_id:str,*,incident_total_minutes:tuple[float,float]|None=None,incident_elapsed_minutes:float=0,quality_reasons:tuple[str,...]=())->EvaluationResult:
        if now.tzinfo is None or deadline.tzinfo is None: raise ValueError("timestamps must be timezone-aware")
        rng=np.random.default_rng(self.config.seed); total=np.zeros(self.config.samples)
        # A fault holds services at the affected stretch until it clears, so the wait is whatever is left of it on reaching that stretch.
        clears_in=np.maximum(rng.uniform(*incident_total_minutes,self.config.samples)-max(incident_elapsed_minutes,0),0) if incident_total_minutes else None
        for segment in route.segments:
            if clears_in is not None and segment.affected_entities: total += np.maximum(clears_in-total,0); clears_in=None
            if segment.kind is SegmentKind.WAIT:
                values=rng.uniform(0,max(segment.mean_minutes*2,.001),self.config.samples)
            elif segment.stddev_minutes==0: values=np.full(self.config.samples,segment.mean_minutes)
            else: values=rng.normal(segment.mean_minutes,segment.stddev_minutes,self.config.samples)
            total += np.maximum(values,0)
        p50=float(np.quantile(total,.5)); p90=float(np.quantile(total,.9)); available=(deadline-now).total_seconds()/60
        quality="good" if not quality_reasons else ("degraded" if len(quality_reasons)<2 else "poor")
        return EvaluationResult(route.id,now+timedelta(minutes=p50),now+timedelta(minutes=p90),round(p50-available,1),self.config.samples,self.config.model_version,self.config.seed,input_snapshot_id,quality,quality_reasons)
