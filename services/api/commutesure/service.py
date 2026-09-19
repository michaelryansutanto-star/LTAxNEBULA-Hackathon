from __future__ import annotations
from dataclasses import asdict,replace
from datetime import date,datetime,time,timedelta,timezone
from typing import Any
from uuid import uuid4
from .alerts import AlertNormalizer
from .clock import DemoClock
from .domain import Action,CommutePlan,Journey,Recommendation,Route
from . import fares
from .fixtures import INITIAL_TIME,RAIL_ACCESS_MINUTES,fault_payload,rachel_routes,segment_path
from .persistence import Repository
from .policy import PolicyConfig,RecommendationPolicy
from .simulation import SimulationConfig,Simulator

def iso(value:Any)->Any:
    if isinstance(value,(datetime,date,time)): return value.isoformat()
    if hasattr(value,"value"): return value.value
    if isinstance(value,tuple): return [iso(v) for v in value]
    if isinstance(value,list): return [iso(v) for v in value]
    if isinstance(value,dict): return {k:iso(v) for k,v in value.items()}
    return value
def dump(value:Any)->dict[str,Any]: return iso(asdict(value))

class CommuteService:
    def __init__(self,repo:Repository,samples:int,seed:int,value_of_time_per_hour:float=12.0):
        self.repo=repo; self.value_of_time_per_hour=value_of_time_per_hour; self.simulator=Simulator(SimulationConfig(samples,seed)); self.policy=RecommendationPolicy(PolicyConfig()); self.normalizer=AlertNormalizer()
        if not self.repo.get("commute_plans",{"id":"rachel"}): self._save_plan(CommutePlan.rachel())
        if not self.repo.get("scenario_state",{"scenario_id":"rachel"}): self.reset()
    def _save_plan(self,plan:CommutePlan): self.repo.put("commute_plans",{"id":plan.id},dump(plan))
    def plan(self,plan_id="rachel"):
        data=self.repo.get("commute_plans",{"id":plan_id})
        if not data: raise KeyError("commute plan not found")
        return data
    def update_plan(self,plan_id:str,changes:dict[str,Any]):
        current=self.plan(plan_id); merged={**current,**changes}
        from datetime import time
        deadline=time.fromisoformat(merged["deadline"])
        plan=CommutePlan(merged["id"],merged["origin"],merged["destination"],tuple(merged["weekdays"]),deadline,int(merged["buffer_minutes"]),merged.get("timezone","Asia/Singapore")); self._save_plan(plan); return dump(plan)
    def create_plan(self,data:dict[str,Any]):
        from datetime import time
        plan=CommutePlan(data.get("id","rachel"),data["origin"],data["destination"],tuple(int(day) for day in data["weekdays"]),time.fromisoformat(data["deadline"]),data["buffer_minutes"]); self._save_plan(plan); return dump(plan)
    def create_journey(self,plan_id:str,service_date:date):
        self.plan(plan_id); journey=Journey(f"journey-{uuid4().hex[:12]}",plan_id,service_date)
        data={**dump(journey),"scenario_id":"local"}; self.repo.put("journeys",{"id":journey.id},data,scenario_id="local")
        for route in rachel_routes(): self.repo.put("routes",{"id":route.id,"journey_id":journey.id},dump(route))
        return self.snapshot(journey.id)
    def _state(self):
        state=self.repo.get("scenario_state",{"scenario_id":"rachel"})
        if not state: raise KeyError("scenario not initialized")
        return state
    def _save_state(self,state): self.repo.put("scenario_state",{"scenario_id":"rachel"},state)
    def _journey(self,jid:str):
        data=self.repo.get("journeys",{"id":jid})
        if not data: raise KeyError("journey not found")
        return data
    def reset(self):
        self.repo.reset_scenario("rachel"); self._save_plan(CommutePlan.rachel())
        journey=Journey("rachel-20260921","rachel",date(2026,9,21)); data=dump(journey)
        self.repo.put("journeys",{"id":journey.id},{**data,"scenario_id":"rachel"},scenario_id="rachel")
        for route in rachel_routes(): self.repo.put("routes",{"id":route.id,"journey_id":journey.id},dump(route))
        state={"clock":INITIAL_TIME.isoformat(),"paused":True,"fault_active":False,"provider_stale":False,"revision":0,"sequence":0,"journey_id":journey.id}; self._save_state(state)
        return self.snapshot(journey.id,evaluate_if_missing=True)
    def routes(self,jid:str):
        self._journey(jid); return self.repo.list_data("routes",{"journey_id":jid})[:3]
    def start(self,jid:str):
        journey=self._journey(jid); now=self._state()["clock"]; updated={**journey,"status":"monitoring","started_at":now}
        self.repo.put("journeys",{"id":jid},updated,scenario_id=journey.get("scenario_id","rachel")); state={**self._state(),"paused":False}; self._save_state(state); return self.evaluate(jid)
    def pause(self): self._save_state({**self._state(),"paused":True}); return self.snapshot(self._state()["journey_id"])
    def finish(self,jid:str):
        journey=self._journey(jid); updated={**journey,"status":"finished","finished_at":self._state()["clock"]}; self.repo.put("journeys",{"id":jid},updated,scenario_id=journey.get("scenario_id","rachel")); return self.snapshot(jid)
    def advance(self,minutes:int):
        state=self._state(); advanced=DemoClock(datetime.fromisoformat(state["clock"])).advance(timedelta(minutes=minutes)); self._save_state({**state,"clock":advanced.now().isoformat()})
        return self.evaluate(state["journey_id"])
    def fault(self):
        state=self._state(); revision=state["revision"]+1; now=datetime.fromisoformat(state["clock"]); payload=fault_payload(now,str(revision)); result=self.normalizer.ingest(payload,now,{"EWL"})
        if result.accepted: self.repo.put("alerts",{"incident_id":payload["incident_id"],"revision_id":payload["revision_id"]},payload)
        self._save_state({**state,"fault_active":True,"provider_stale":False,"revision":revision}); return self.evaluate(state["journey_id"])
    def resolve(self):
        state=self._state(); revision=state["revision"]+1; payload=fault_payload(datetime.fromisoformat(state["clock"]),str(revision),"resolved"); self.repo.put("alerts",{"incident_id":payload["incident_id"],"revision_id":payload["revision_id"]},payload)
        self._save_state({**state,"fault_active":False,"provider_stale":False,"revision":revision}); return self.evaluate(state["journey_id"])
    def stale(self):
        state={**self._state(),"provider_stale":True}; self._save_state(state); return self.evaluate(state["journey_id"])
    def accept(self,jid:str,route_id:str):
        route=self.repo.get("routes",{"id":route_id,"journey_id":jid})
        if not route or not route.get("available",True): raise ValueError("route is unavailable")
        journey=self._journey(jid); self.repo.put("journeys",{"id":jid},{**journey,"selected_route_id":route_id},scenario_id=journey.get("scenario_id","rachel")); return self.evaluate(jid)
    def _route_models(self)->tuple[Route,...]: return rachel_routes()
    def evaluate(self,jid:str):
        journey=self._journey(jid); state=self._state(); now=datetime.fromisoformat(state["clock"]); plan=self.plan(journey["plan_id"])
        from datetime import time
        plan_model=CommutePlan(plan["id"],plan["origin"],plan["destination"],tuple(plan["weekdays"]),time.fromisoformat(plan["deadline"]),plan["buffer_minutes"],plan["timezone"]); target=plan_model.target_arrival(now)
        models=self._route_models(); selected=journey["selected_route_id"]; current=next(r for r in models if r.id==selected)
        qualities=("Provider observation is stale",) if state["provider_stale"] else ()
        incident=(26,34) if state["fault_active"] and any("EWL" in s.affected_entities for s in current.segments) else None
        elapsed=max(0,(now-datetime(2026,9,21,7,48,tzinfo=now.tzinfo)).total_seconds()/60) if incident else 0
        current_result=self.simulator.evaluate(current,now,target,f"rachel-{state['revision']}-{state['sequence']}",incident_total_minutes=incident,incident_elapsed_minutes=elapsed,quality_reasons=qualities)
        alternatives=[self.simulator.evaluate(route,now,target,f"rachel-{state['revision']}-{state['sequence']}",quality_reasons=qualities) for route in models if route.id!=selected]
        rec=self.policy.decide(current_result,alternatives,now,current.decision_deadline,fresh=not state["provider_stale"],feasible_route_ids={r.id for r in models if r.available},selected_route_id=selected if selected!="current-ewl" else None,route_names={r.id:r.name for r in models})
        sequence=state["sequence"]+1; metrics=[dump(current_result),*[dump(x) for x in alternatives]]
        evaluation={"id":f"evaluation-{sequence}","sequence":sequence,"target_arrival":target.isoformat(),"routes":metrics,"fares":self._fares(journey,now,models,[current_result,*alternatives]),"model_label":"Estimated arrival times from synthetic segment durations; not calibrated against real commuter outcomes"}
        self.repo.add_evaluation(jid,sequence,evaluation); self.repo.put("recommendations",{"journey_id":jid},dump(rec),sequence=sequence)
        self._save_state({**state,"sequence":sequence})
        if rec.action is Action.REROUTE:
            notification={"id":f"notify-{jid}-{rec.route_id}","journey_id":jid,"title":"Useful route change available","body":rec.explanation,"action":rec.action.value,"route_id":rec.route_id,"state":"delivered","created_at":now.isoformat()}
            self.repo.notify_once(jid,f"{jid}:reroute:{rec.route_id}",notification)
        return self.snapshot(jid)
    def _fares(self,journey:dict[str,Any],now:datetime,models:tuple[Route,...],results:list[Any])->dict[str,Any]:
        # The fare gates are passed once, shortly after leaving home, so the tap-in time is fixed by the departure.
        departed=journey.get("started_at") is not None; departure=datetime.fromisoformat(journey["started_at"]) if departed else now
        tap_in=departure+timedelta(minutes=RAIL_ACCESS_MINUTES); by_route={result.route_id:result for result in results}
        available=[route for route in models if route.available and route.id in by_route]
        eta={route.id:max(0.0,(by_route[route.id].eta-now).total_seconds()/60) for route in available}
        on_time=[route.id for route in available if by_route[route.id].late_minutes<=0]
        return {"routes":fares.compare([fares.quote(route,tap_in) for route in available],eta,on_time,self.value_of_time_per_hour),"rail_tap_in":tap_in.isoformat(),"tip":fares.pre_peak_tip(departure,RAIL_ACCESS_MINUTES,departed),
            "value_of_time_per_hour":self.value_of_time_per_hour,"table_effective":fares.FARE_TABLE_EFFECTIVE.isoformat(),"sources":fares.sources(),
            "label":"Adult card fares from the published distance fare table, applied to synthetic route distances"}
    def snapshot(self,jid:str,evaluate_if_missing=False):
        journey=self._journey(jid); state=self._state(); recommendation=self.repo.get("recommendations",{"journey_id":jid})
        if recommendation is None and evaluate_if_missing:return self.evaluate(jid)
        evaluations=self.repo.list_data("evaluations",{"journey_id":jid}); evaluation=evaluations[-1] if evaluations else None
        routes=self.routes(jid)
        if evaluation:
            metrics={metric["route_id"]:metric for metric in evaluation["routes"]}
            route_fares={fare["route_id"]:fare for fare in evaluation.get("fares",{}).get("routes",[])}
            routes=[{**route,**metrics.get(route["id"],{}),"fare":route_fares.get(route["id"])} for route in routes]
        routes=[{**route,"selected":route["id"]==journey["selected_route_id"],"walking_minutes":round(sum(segment["mean_minutes"] for segment in route["segments"] if segment["kind"]=="walk"),1),"segments":[{**segment,"path":segment_path(segment["id"],segment["origin"],segment["destination"]),"affected":state["fault_active"] and bool(segment.get("affected_entities")),"type":segment["kind"],"instruction":segment.get("instructions", ""),"expected_minutes":segment["mean_minutes"]} for segment in route["segments"]]} for route in routes]
        contingency=None
        if recommendation:
            route=self.repo.get("routes",{"id":recommendation["route_id"],"journey_id":jid})
            contingency={"journey_id":jid,"generated_at":recommendation["generated_at"],"expires_at":recommendation["expires_at"],"route_version":route["version"] if route else "unknown","trigger_condition":"If the current recommendation remains actionable before the decision deadline","decision_deadline":recommendation["decision_deadline"],"primary_action":recommendation["explanation"],"instructions":route["segments"] if route else [],"freshness":recommendation["freshness"]}
        plan=self.plan(journey["plan_id"]); local_day=datetime.fromisoformat(state["clock"]).date(); event_deadline=datetime.combine(local_day,time.fromisoformat(plan["deadline"]),datetime.fromisoformat(state["clock"]).tzinfo).isoformat()
        if recommendation: recommendation={**recommendation,"headline":next((route["name"] for route in routes if route["id"]==recommendation["route_id"]),"Keep monitoring") if recommendation["action"] in ("stay","reroute") else "Keep monitoring","action_code":recommendation["action"],"reason":recommendation["explanation"],"route_version":next((route["version"] for route in routes if route["id"]==recommendation["route_id"]),"unknown")}
        return {"scenario_id":journey.get("scenario_id","local"),"demo_label":"Synthetic deterministic data - not live travel advice","clock":state["clock"],"paused":state["paused"],"fault_active":state["fault_active"],"provider_stale":state["provider_stale"],"journey":journey,"plan":plan,"origin":plan["origin"],"destination":plan["destination"],"event_deadline":event_deadline,"buffer_minutes":plan["buffer_minutes"],"routes":routes,"evaluation":evaluation,"sequence":evaluation["sequence"] if evaluation else 0,"target_arrival":evaluation["target_arrival"] if evaluation else None,"input_snapshot_id":evaluation["routes"][0]["input_snapshot_id"] if evaluation else "","seed":self.simulator.config.seed,"model_version":self.simulator.config.model_version,"sample_count":self.simulator.config.samples,"freshness":"stale" if state["provider_stale"] else "fresh","recommendation":recommendation,"contingency":contingency,"notifications":self.repo.list_data("notifications",{"journey_id":jid})}
    def notifications(self): return self.repo.list_data("notifications")
