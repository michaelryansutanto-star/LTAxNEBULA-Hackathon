from __future__ import annotations
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time, timedelta
from enum import StrEnum
from zoneinfo import ZoneInfo

SGT = ZoneInfo("Asia/Singapore")

class SegmentKind(StrEnum):
    WALK="walk"; WAIT="wait"; RIDE="ride"; TRANSFER="transfer"
class Action(StrEnum):
    STAY="stay"; REROUTE="reroute"; MONITOR="monitor"; UNCERTAIN="uncertain"

@dataclass(frozen=True)
class CommutePlan:
    id:str; origin:str; destination:str; weekdays:tuple[int,...]; deadline:time; buffer_minutes:int; timezone:str="Asia/Singapore"
    def __post_init__(self):
        if not self.origin.strip() or not self.destination.strip(): raise ValueError("origin and destination are required")
        if not self.weekdays or any(d<0 or d>6 for d in self.weekdays): raise ValueError("weekdays must be between 0 and 6")
        if not 0<=self.buffer_minutes<=120: raise ValueError("buffer must be between 0 and 120 minutes")
    @classmethod
    def rachel(cls): return cls("rachel","Tampines","Raffles Place",(0,1,2,3,4),time(8,45),10)
    def target_arrival(self, journey_time:datetime)->datetime:
        local=journey_time.astimezone(ZoneInfo(self.timezone)); return datetime.combine(local.date(),self.deadline,ZoneInfo(self.timezone))-timedelta(minutes=self.buffer_minutes)

@dataclass(frozen=True)
class Segment:
    id:str; kind:SegmentKind; origin:str; destination:str; mean_minutes:float; stddev_minutes:float; affected_entities:tuple[str,...]=(); instructions:str=""; mode:str|None=None; distance_km:float=0.0
    def __post_init__(self):
        if self.mean_minutes<0 or self.stddev_minutes<0: raise ValueError("segment durations must be nonnegative")
        if self.distance_km<0: raise ValueError("segment distance must be nonnegative")

@dataclass(frozen=True)
class Route:
    id:str; name:str; synthetic:bool; segments:tuple[Segment,...]; decision_point:str|None=None; decision_deadline:datetime|None=None; available:bool=True; version:str="demo-v1"; walking_metres:int=0; transfers:int=0
    def __post_init__(self):
        for previous,current in zip(self.segments,self.segments[1:]):
            if previous.destination != current.origin: raise ValueError(f"route discontinuity: {previous.destination} to {current.origin}")
    def remaining_after(self,location:str)->"Route":
        indices=[i for i,s in enumerate(self.segments) if s.origin==location]
        if not indices: raise ValueError(f"location {location} is not a reachable route decision point")
        return replace(self,segments=self.segments[indices[0]:])

@dataclass(frozen=True)
class EvaluationResult:
    # eta is the typical arrival; conservative_eta is a slow-day arrival; late_minutes is eta against the target (negative means early).
    route_id:str; eta:datetime; conservative_eta:datetime; late_minutes:float; sample_count:int; model_version:str; seed:int; input_snapshot_id:str; quality_label:str; quality_reasons:tuple[str,...]

@dataclass(frozen=True)
class Recommendation:
    action:Action; route_id:str; reason_code:str; explanation:str; minutes_saved:float; generated_at:datetime; expires_at:datetime; decision_deadline:datetime|None; freshness:str="fresh"

@dataclass(frozen=True)
class Journey:
    id:str; plan_id:str; service_date:date; status:str="planned"; selected_route_id:str="current-ewl"; current_location:str="Tampines"; started_at:datetime|None=None; finished_at:datetime|None=None
