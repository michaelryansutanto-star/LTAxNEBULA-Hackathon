from datetime import date,datetime
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from commutesure import fares
from commutesure.app import create_app
from commutesure.config import Settings
from commutesure.domain import SGT,Route,Segment,SegmentKind
from commutesure.fixtures import rachel_routes

def at(hour:int,minute:int,day:date=date(2026,9,21))->datetime: return datetime(day.year,day.month,day.day,hour,minute,tzinfo=SGT)
def rail_route(origin:str,distance_km:float)->Route: return Route("r","Rail",True,(Segment("ride",SegmentKind.RIDE,origin,"City",20,2,mode="rail",distance_km=distance_km),))

def test_distance_fare_follows_published_bands_and_express_surcharge():
    assert fares.distance_fare_cents(0)==128 and fares.distance_fare_cents(3.2)==128 and fares.distance_fare_cents(3.3)==138
    assert fares.distance_fare_cents(15.7)==211 and fares.distance_fare_cents(27.2)==243 and fares.distance_fare_cents(28.0)==244
    assert fares.distance_fare_cents(40.2)==256 and fares.distance_fare_cents(55)==257
    assert fares.distance_fare_cents(17.0,express=True)==315
    assert [cents for _,cents in fares.ADULT_CARD_BANDS]==sorted(cents for _,cents in fares.ADULT_CARD_BANDS)
    with pytest.raises(ValueError): fares.distance_fare_cents(-1)

def test_pre_peak_discount_needs_a_weekday_tap_in_before_cutoff():
    assert fares.rail_discount(at(7,44),"Tampines",211)==(50,"pre_peak")
    assert fares.rail_discount(at(7,45),"Tampines",211)==(0,None)
    assert fares.rail_discount(at(7,0),"Tampines",30)==(30,"pre_peak")
    assert fares.rail_discount(at(7,0,date(2026,9,19)),"Tampines",211)==(0,None)
    assert fares.rail_discount(at(7,0,date(2026,8,10)),"Tampines",211)==(0,None)

def test_free_off_peak_ride_is_limited_to_listed_stations_and_windows():
    assert fares.rail_discount(at(7,29),"Sengkang",190)==(190,"free_off_peak")
    assert fares.rail_discount(at(9,30),"Kovan",190)==(190,"free_off_peak")
    assert fares.rail_discount(at(7,35),"Sengkang",190)==(50,"pre_peak")
    assert fares.rail_discount(at(8,30),"Sengkang",190)==(0,None)
    assert fares.rail_discount(at(9,45),"Sengkang",190)==(0,None)
    assert fares.rail_discount(at(7,0,date(2025,12,26)),"Sengkang",190)==(50,"pre_peak")

def test_quote_prices_the_whole_journey_and_discounts_only_rail():
    ewl,dtl,bus=rachel_routes()
    assert fares.quote(ewl,at(7,46)).cents==211 and fares.quote(ewl,at(7,44)).cents==161
    transfer=fares.quote(dtl,at(7,44)); assert transfer.distance_km==15.4 and transfer.base_cents==211 and transfer.scheme=="pre_peak"
    express=fares.quote(bus,at(7,0)); assert express.cents==315 and express.scheme is None
    assert fares.quote(rail_route("Punggol",14.0),at(7,10)).cents==0
    with pytest.raises(ValueError,match="ride"): fares.quote(Route("x","X",True,(Segment("ride",SegmentKind.RIDE,"A","B",5,1),)),at(7,0))
    with pytest.raises(ValueError): Segment("ride",SegmentKind.RIDE,"A","B",5,1,distance_km=-1)

def test_pre_peak_tip_only_helps_before_departure():
    tip=fares.pre_peak_tip(at(7,40),6,departed=False)
    assert tip["leave_by"]==at(7,38).isoformat() and tip["saving"]==0.5 and tip["minutes_earlier"]==2
    assert fares.pre_peak_tip(at(7,30),6,departed=False) is None
    assert fares.pre_peak_tip(at(7,40),6,departed=True) is None
    assert fares.pre_peak_tip(at(7,40,date(2026,9,19)),6,departed=False) is None

def test_best_value_never_trades_reliability_for_price():
    quotes=[fares.FareQuote("cheap-slow",15,200,0,None),fares.FareQuote("fast-dear",15,320,0,None),fares.FareQuote("risky",15,150,0,None)]
    eta={"cheap-slow":60,"fast-dear":40,"risky":30}
    rows={row["route_id"]:row for row in fares.compare(quotes,eta,["cheap-slow","fast-dear"],12)}
    assert rows["fast-dear"]["best_value"] and rows["fast-dear"]["generalised_cost"]==11.2
    assert rows["risky"]["cheapest"] and rows["risky"]["fastest"] and not rows["risky"]["best_value"] and not rows["risky"]["arrives_by_target"]
    assert rows["cheap-slow"]["extra_cost_per_minute_saved"] is None
    time_is_free={row["route_id"]:row for row in fares.compare(quotes,eta,["cheap-slow","fast-dear"],0)}
    assert time_is_free["cheap-slow"]["best_value"]
    fallback={row["route_id"]:row for row in fares.compare(quotes,eta,[],12)}
    assert fallback["risky"]["best_value"]
    assert fares.compare([],{},[],12)==[]

def test_extra_cost_per_minute_saved_is_relative_to_the_cheapest_route():
    rows={row["route_id"]:row for row in fares.compare([fares.FareQuote("a",15,200,0,None),fares.FareQuote("b",15,320,0,None)],{"a":60,"b":40},["a","b"],12)}
    assert rows["b"]["extra_cost_per_minute_saved"]==0.06 and rows["a"]["extra_cost_per_minute_saved"] is None

def test_snapshot_draws_every_segment_and_marks_only_disrupted_ones(tmp_path:Path):
    settings=Settings(_env_file=None,database_path=tmp_path/"map.db",demo_mode=True,simulation_samples=300,rate_limit_per_minute=1000)
    with TestClient(create_app(settings)) as api:
        state=api.post("/v1/demo/scenarios/rachel/reset").json()["data"]
        segments=[segment for route in state["routes"] for segment in route["segments"]]
        assert all(len(segment["path"])>=2 and all(1.2<lat<1.5 and 103.6<lon<104.1 for lat,lon in segment["path"]) for segment in segments)
        assert not any(segment["affected"] for segment in segments)
        assert len(next(s for s in segments if s["id"]=="ride-ewl-bugis")["path"])==11
        faulted=api.post("/v1/demo/scenarios/rachel/fault").json()["data"]
        assert {s["id"] for route in faulted["routes"] for s in route["segments"] if s["affected"]}=={"ride-ewl-city"}

def test_snapshot_exposes_fares_tip_and_sources(tmp_path:Path):
    settings=Settings(_env_file=None,database_path=tmp_path/"fares.db",demo_mode=True,simulation_samples=600,rate_limit_per_minute=1000)
    with TestClient(create_app(settings)) as api:
        state=api.post("/v1/demo/scenarios/rachel/reset").json()["data"]; context=state["evaluation"]["fares"]
        by_route={route["id"]:route["fare"] for route in state["routes"]}
        assert by_route["current-ewl"]["amount"]==2.11 and by_route["bus-connector"]["amount"]==3.15
        assert sum(fare["best_value"] for fare in by_route.values())==1
        assert context["tip"]["leave_by"].startswith("2026-09-21T07:38") and context["value_of_time_per_hour"]==12.0 and context["sources"]["pre_peak"].startswith("https://www.ptc.gov.sg")
        started=api.post("/v1/demo/scenarios/rachel/start").json()["data"]
        assert started["evaluation"]["fares"]["tip"] is None
        later=api.post("/v1/demo/scenarios/rachel/advance",json={"minutes":10}).json()["data"]
        assert later["evaluation"]["fares"]["rail_tap_in"]==started["evaluation"]["fares"]["rail_tap_in"]

def test_relative_database_path_is_anchored_to_the_service_directory(tmp_path:Path):
    from commutesure.config import SERVICE_ROOT
    assert Settings(_env_file=None,database_path="demo.db").database_path==SERVICE_ROOT/"demo.db"
    assert Settings(_env_file=None,database_path=tmp_path/"x.db").database_path==tmp_path/"x.db"
