from __future__ import annotations
from collections import defaultdict,deque
from contextlib import asynccontextmanager
from datetime import datetime,timezone
import logging,time,uuid
from typing import Annotated,Any
from fastapi import Body,FastAPI,HTTPException,Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import AliasChoices,BaseModel,ConfigDict,Field,field_validator
from .config import Settings
from .persistence import Repository
from .service import CommuteService

logger=logging.getLogger("commutesure.api")
WEEKDAY_NAMES={"mon":0,"tue":1,"wed":2,"thu":3,"fri":4,"sat":5,"sun":6}
def normalize_weekdays(value:list[int|str])->list[int]:
    normalized=[]
    for day in value:
        parsed=WEEKDAY_NAMES.get(str(day).lower(),day)
        if not isinstance(parsed,int) or parsed<0 or parsed>6: raise ValueError("weekdays must be names or numbers between 0 and 6")
        normalized.append(parsed)
    return normalized
def validate_deadline(value:str)->str:
    from datetime import time as clock_time
    try: clock_time.fromisoformat(value)
    except ValueError as error: raise ValueError("deadline must be HH:MM") from error
    return value
class CommuteCreate(BaseModel):
    model_config=ConfigDict(populate_by_name=True)
    id:str=Field(default="rachel",min_length=1,max_length=128); origin:str=Field(min_length=1,max_length=120); destination:str=Field(min_length=1,max_length=120); weekdays:list[int|str]=Field(min_length=1,max_length=7); deadline:str=Field(validation_alias=AliasChoices("deadline","arrival_deadline")); buffer_minutes:int=Field(ge=0,le=120,validation_alias=AliasChoices("buffer_minutes","early_arrival_buffer_minutes"))
    @field_validator("weekdays")
    @classmethod
    def weekdays_valid(cls,value): return normalize_weekdays(value)
    @field_validator("deadline")
    @classmethod
    def deadline_valid(cls,value): return validate_deadline(value)
class CommuteUpdate(BaseModel):
    origin:str|None=Field(None,min_length=1,max_length=120); destination:str|None=Field(None,min_length=1,max_length=120); weekdays:list[int|str]|None=Field(None,min_length=1,max_length=7); deadline:str|None=None; buffer_minutes:int|None=Field(None,ge=0,le=120)
    @field_validator("weekdays")
    @classmethod
    def weekdays_valid(cls,value): return normalize_weekdays(value) if value is not None else value
    @field_validator("deadline")
    @classmethod
    def deadline_valid(cls,value): return validate_deadline(value) if value is not None else value
class AdvanceRequest(BaseModel): minutes:int=Field(gt=0,le=180)
class JourneyCreate(BaseModel):
    plan_id:str=Field(default="rachel",min_length=1,max_length=128); service_date:datetime

def envelope(data:Any): return {"success":True,"data":data,"error":None}
def create_app(settings:Settings|None=None)->FastAPI:
    config=settings or Settings(); repo=Repository(config.database_path); service=CommuteService(repo,config.simulation_samples,config.simulation_seed)
    @asynccontextmanager
    async def lifespan(_:FastAPI): yield
    app=FastAPI(title="CommuteSure SG API",version="0.1.0",lifespan=lifespan); app.state.settings=config; app.state.service=service
    app.add_middleware(CORSMiddleware,allow_origins=config.allowed_origins,allow_credentials=False,allow_methods=["GET","POST","PATCH","OPTIONS"],allow_headers=["Content-Type","X-Correlation-ID"])
    buckets:dict[str,deque[float]]=defaultdict(deque)
    @app.middleware("http")
    async def safeguards(request:Request,call_next):
        correlation=(request.headers.get("X-Correlation-ID") or str(uuid.uuid4()))[:128]; now=time.monotonic(); key=request.client.host if request.client else "local"; bucket=buckets[key]
        origin=request.headers.get("Origin"); content_length=request.headers.get("Content-Length"); unsafe=request.method not in {"GET","HEAD","OPTIONS"}
        if unsafe and origin is not None and origin not in config.allowed_origins: response=JSONResponse({"success":False,"data":None,"error":{"code":"origin_forbidden","message":"Mutation origin is not allowed"}},403)
        elif content_length is not None and (not content_length.isdigit() or int(content_length)>65_536): response=JSONResponse({"success":False,"data":None,"error":{"code":"payload_too_large","message":"Request body exceeds 64 KiB"}},413)
        elif any(len(segment)>128 for segment in request.url.path.split("/")): response=JSONResponse({"success":False,"data":None,"error":{"code":"validation_error","message":"Path identifier exceeds 128 characters"}},422)
        else:
            while bucket and now-bucket[0]>=60: bucket.popleft()
            if len(bucket)>=config.rate_limit_per_minute: response=JSONResponse({"success":False,"data":None,"error":{"code":"rate_limited","message":"Too many requests"}},429)
            else:
                bucket.append(now); response=await call_next(request)
        response.headers["X-Correlation-ID"]=correlation; response.headers["X-RateLimit-Limit"]=str(config.rate_limit_per_minute); response.headers["X-Content-Type-Options"]="nosniff"; return response
    @app.exception_handler(KeyError)
    async def not_found(_:Request,error:KeyError): return JSONResponse({"success":False,"data":None,"error":{"code":"not_found","message":str(error).strip("'")}},404)
    @app.exception_handler(ValueError)
    async def bad_request(_:Request,error:ValueError): return JSONResponse({"success":False,"data":None,"error":{"code":"invalid_request","message":str(error)}},400)
    @app.exception_handler(RequestValidationError)
    async def validation(_:Request,error:RequestValidationError): return JSONResponse(jsonable_encoder({"success":False,"data":None,"error":{"code":"validation_error","message":"Request validation failed","details":error.errors()}}),422)
    def demo_guard():
        if not config.demo_mode: raise HTTPException(403,"Demo endpoints are disabled")
    @app.exception_handler(HTTPException)
    async def http_error(_:Request,error:HTTPException): return JSONResponse({"success":False,"data":None,"error":{"code":"forbidden" if error.status_code==403 else "http_error","message":str(error.detail)}},error.status_code)
    @app.get("/health")
    def health(): return {"status":"ok","mode":"demo" if config.demo_mode else "local","timestamp":datetime.now(timezone.utc).isoformat()}
    @app.post("/v1/commute-plans")
    def create_plan(body:CommuteCreate): return envelope(service.create_plan(body.model_dump()))
    @app.get("/v1/commute-plans/{plan_id}")
    def get_plan(plan_id:str): return envelope(service.plan(plan_id))
    @app.patch("/v1/commute-plans/{plan_id}")
    def update_plan(plan_id:str,body:CommuteUpdate): return envelope(service.update_plan(plan_id,body.model_dump(exclude_none=True)))
    @app.post("/v1/journeys/{journey_id}/start")
    def start_journey(journey_id:str): return envelope(service.start(journey_id))
    @app.post("/v1/journeys")
    def create_journey(body:JourneyCreate): return envelope(service.create_journey(body.plan_id,body.service_date.date()))
    @app.post("/v1/journeys/{journey_id}/finish")
    def finish_journey(journey_id:str): return envelope(service.finish(journey_id))
    @app.post("/v1/journeys/{journey_id}/evaluate")
    def evaluate(journey_id:str): return envelope(service.evaluate(journey_id))
    @app.get("/v1/journeys/{journey_id}/snapshot")
    def snapshot(journey_id:str): return envelope(service.snapshot(journey_id))
    @app.get("/v1/journeys/{journey_id}/recommendation")
    def recommendation(journey_id:str): return envelope(service.snapshot(journey_id)["recommendation"])
    @app.get("/v1/journeys/{journey_id}/routes")
    def routes(journey_id:str): return envelope(service.routes(journey_id))
    @app.post("/v1/journeys/{journey_id}/routes/{route_id}/accept")
    def accept(journey_id:str,route_id:str): return envelope(service.accept(journey_id,route_id))
    @app.get("/v1/notifications")
    def notifications(): return envelope(service.notifications())
    @app.get("/v1/journeys/{journey_id}/notifications")
    def journey_notifications(journey_id:str): service._journey(journey_id); return envelope(repo.list_data("notifications",{"journey_id":journey_id}))
    @app.get("/v1/demo/scenarios/rachel")
    def scenario(): demo_guard(); return envelope(service.snapshot(service._state()["journey_id"]))
    @app.post("/v1/demo/scenarios/rachel/reset")
    def reset(): demo_guard(); return envelope(service.reset())
    @app.post("/v1/demo/scenarios/rachel/start")
    def demo_start(): demo_guard(); return envelope(service.start(service._state()["journey_id"]))
    @app.post("/v1/demo/scenarios/rachel/pause")
    def pause(): demo_guard(); return envelope(service.pause())
    @app.post("/v1/demo/scenarios/rachel/fault")
    def fault(): demo_guard(); return envelope(service.fault())
    @app.post("/v1/demo/scenarios/rachel/resolve")
    def resolve(): demo_guard(); return envelope(service.resolve())
    @app.post("/v1/demo/scenarios/rachel/stale")
    def stale(): demo_guard(); return envelope(service.stale())
    @app.post("/v1/demo/scenarios/rachel/advance")
    def advance(body:AdvanceRequest): demo_guard(); return envelope(service.advance(body.minutes))
    @app.post("/v1/demo/scenarios/rachel/clock/advance")
    def advance_clock(body:AdvanceRequest): demo_guard(); return envelope(service.advance(body.minutes))
    @app.post("/v1/demo/scenarios/rachel/provider/stale")
    def stale_provider(): demo_guard(); return envelope(service.stale())
    @app.post("/v1/demo/scenarios/rachel/events/ewl-fault/trigger")
    def fault_event(): demo_guard(); return envelope(service.fault())
    @app.post("/v1/demo/scenarios/rachel/events/ewl-fault/resolve")
    def resolve_event(): demo_guard(); return envelope(service.resolve())
    return app

app=create_app()
