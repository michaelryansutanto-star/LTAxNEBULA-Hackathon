from dataclasses import dataclass
from datetime import datetime,timedelta
from enum import StrEnum
from typing import Any

class ExtractionStatus(StrEnum): VALID="valid"; INVALID="invalid"
@dataclass(frozen=True)
class Alert:
    incident_id:str; revision_id:str; event_type:str; severity:str; affected_entities:tuple[str,...]; started_at:datetime; observed_at:datetime; source:str; resolved:bool=False
@dataclass(frozen=True)
class IngestionResult:
    accepted:bool; event:Alert|None=None; duplicate:bool=False; reason:str|None=None; extraction_status:ExtractionStatus=ExtractionStatus.VALID
class AlertNormalizer:
    def __init__(self,max_age:timedelta=timedelta(minutes=10)): self.max_age=max_age; self._revisions:set[tuple[str,str]]=set()
    def ingest(self,payload:dict[str,Any],now:datetime,relevant_entities:set[str])->IngestionResult:
        try:
            required=("incident_id","revision_id","type","severity","affected_entities","started_at","observed_at","source","status")
            if any(k not in payload for k in required): raise ValueError
            event=Alert(str(payload["incident_id"]),str(payload["revision_id"]),str(payload["type"]),str(payload["severity"]),tuple(str(x) for x in payload["affected_entities"]),datetime.fromisoformat(str(payload["started_at"])),datetime.fromisoformat(str(payload["observed_at"])),str(payload["source"]),payload["status"]=="resolved")
            if event.observed_at.tzinfo is None: raise ValueError
        except (ValueError,TypeError): return IngestionResult(False,reason="malformed",extraction_status=ExtractionStatus.INVALID)
        key=(event.incident_id,event.revision_id)
        if key in self._revisions:return IngestionResult(False,event,True,"duplicate")
        if now-event.observed_at>self.max_age:return IngestionResult(False,event,reason="stale")
        if not relevant_entities.intersection(event.affected_entities):return IngestionResult(False,event,reason="irrelevant")
        self._revisions.add(key); return IngestionResult(True,event)
