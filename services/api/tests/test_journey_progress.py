from datetime import datetime,timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from commutesure.app import create_app
from commutesure.config import Settings
from commutesure.domain import Route,Segment,SegmentKind
from commutesure.simulation import SimulationConfig,Simulator

SGT=ZoneInfo("Asia/Singapore")
def leg(segment_id:str,origin:str,destination:str,minutes:float,affected:bool=False)->Segment:
    return Segment(id=segment_id,kind=SegmentKind.RIDE,origin=origin,destination=destination,mean_minutes=minutes,stddev_minutes=0,affected_entities=("EWL",) if affected else ())
def eta_minute(snapshot:dict,route_id:str)->datetime:
    return datetime.fromisoformat(next(route for route in snapshot["routes"] if route["id"]==route_id)["eta"])

def test_elapsed_travel_is_removed_and_the_current_segment_is_shortened():
    route=Route(id="r",name="r",synthetic=True,segments=(leg("a","A","B",10),leg("b","B","C",20),leg("c","C","D",5)))
    assert route.remaining_after_elapsed(0)==route and route.remaining_after_elapsed(-3)==route
    partial=route.remaining_after_elapsed(15)
    assert [(s.id,s.mean_minutes) for s in partial.segments]==[("b",15),("c",5)]
    assert [s.id for s in route.remaining_after_elapsed(10).segments]==["b","c"] and route.remaining_after_elapsed(99).segments==()

def test_fault_only_delays_travellers_who_reach_the_affected_stretch_before_it_clears():
    sim=Simulator(SimulationConfig(samples=200,seed=3)); now=datetime(2026,9,21,7,48,tzinfo=SGT)
    route=Route(id="r",name="r",synthetic=True,segments=(leg("clear","A","B",20),leg("held","B","C",10,affected=True)))
    held=sim.evaluate(route,now,now+timedelta(hours=2),"s",incident_total_minutes=(50,50))
    late_arrival=sim.evaluate(route,now,now+timedelta(hours=2),"s",incident_total_minutes=(15,15))
    assert held.eta==now+timedelta(minutes=60) and late_arrival.eta==now+timedelta(minutes=30)

def test_eta_stays_put_while_the_clock_advances_and_the_bus_option_closes(tmp_path:Path):
    settings=Settings(_env_file=None,database_path=tmp_path/"progress.db",demo_mode=True,simulation_samples=600,rate_limit_per_minute=1000)
    with TestClient(create_app(settings)) as api:
        api.post("/v1/demo/scenarios/rachel/reset"); started=api.post("/v1/demo/scenarios/rachel/start").json()["data"]
        assert all(route["available"] for route in started["routes"])
        api.post("/v1/demo/scenarios/rachel/advance",json={"minutes":8}); faulted=api.post("/v1/demo/scenarios/rachel/fault").json()["data"]
        assert {route["id"] for route in faulted["routes"] if not route["available"]}=={"bus-connector"}
        assert {fare["route_id"] for fare in faulted["evaluation"]["fares"]["routes"]}=={"current-ewl","bugis-dtl"}
        assert faulted["recommendation"]["action"]=="reroute" and faulted["recommendation"]["route_id"]=="bugis-dtl"
        later=api.post("/v1/demo/scenarios/rachel/advance",json={"minutes":6}).json()["data"]
        for route_id in ("current-ewl","bugis-dtl"):
            assert abs((eta_minute(later,route_id)-eta_minute(faulted,route_id)).total_seconds())<=90
        assert eta_minute(faulted,"bugis-dtl")<datetime(2026,9,21,8,35,tzinfo=SGT)<eta_minute(faulted,"current-ewl")
