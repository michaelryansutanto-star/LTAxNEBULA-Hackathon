from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from commutesure.clock import DemoClock
from commutesure.domain import CommutePlan, Route, Segment, SegmentKind
from commutesure.simulation import SimulationConfig, Simulator

SGT = ZoneInfo("Asia/Singapore")

def route(route_id: str = "current", extra: float = 0) -> Route:
    return Route(id=route_id, name="Synthetic test route", synthetic=True, decision_point="Bugis", decision_deadline=datetime(2026,9,19,8,6,tzinfo=SGT), segments=(Segment(id="walk",kind=SegmentKind.WALK,origin="A",destination="B",mean_minutes=4,stddev_minutes=.5),Segment(id="wait",kind=SegmentKind.WAIT,origin="B",destination="B",mean_minutes=3,stddev_minutes=1),Segment(id="ride",kind=SegmentKind.RIDE,origin="B",destination="C",mean_minutes=19+extra,stddev_minutes=2,affected_entities=("EWL",))))

def test_plan_target_uses_singapore_deadline_and_buffer():
    assert CommutePlan.rachel().target_arrival(datetime(2026,9,19,7,40,tzinfo=SGT)) == datetime(2026,9,19,8,35,tzinfo=SGT)
    utc=datetime(2026,9,18,23,50,tzinfo=ZoneInfo("UTC"))
    assert CommutePlan.rachel().target_arrival(utc).date().isoformat()=="2026-09-19"

def test_clock_is_timezone_aware_and_immutable():
    clock=DemoClock(datetime(2026,9,19,7,40,tzinfo=SGT)); advanced=clock.advance(timedelta(minutes=5))
    assert clock.now().minute==40 and advanced.now().minute==45
    with pytest.raises(ValueError): DemoClock(datetime(2026,9,19,7,40))

def test_segments_reject_negative_durations_and_route_discontinuity():
    with pytest.raises(ValueError): Segment(id="bad",kind=SegmentKind.WALK,origin="A",destination="B",mean_minutes=-1,stddev_minutes=0)
    with pytest.raises(ValueError): Route(id="bad",name="Bad",synthetic=True,segments=(Segment(id="a",kind=SegmentKind.WALK,origin="A",destination="B",mean_minutes=1,stddev_minutes=0),Segment(id="b",kind=SegmentKind.RIDE,origin="C",destination="D",mean_minutes=1,stddev_minutes=0)))

def test_seed_is_reproducible_and_metrics_are_ordered():
    sim=Simulator(SimulationConfig(samples=1000,seed=17)); now=datetime(2026,9,19,7,50,tzinfo=SGT); deadline=now+timedelta(minutes=30)
    first=sim.evaluate(route(),now,deadline,"snapshot"); second=sim.evaluate(route(),now,deadline,"snapshot")
    assert first==second and 0<=first.on_time_probability<=1 and first.p50_arrival<=first.p90_arrival and first.sample_count==1000

def test_later_deadline_cannot_reduce_probability_and_delay_cannot_increase_it():
    sim=Simulator(SimulationConfig(samples=2000,seed=21)); now=datetime(2026,9,19,7,50,tzinfo=SGT)
    earlier=sim.evaluate(route(),now,now+timedelta(minutes=27),"s"); later=sim.evaluate(route(),now,now+timedelta(minutes=30),"s"); delayed=sim.evaluate(route(extra=8),now,now+timedelta(minutes=27),"s")
    assert later.on_time_probability>=earlier.on_time_probability and delayed.on_time_probability<=earlier.on_time_probability

def test_shared_incident_delay_is_applied_once_and_conditioned_on_elapsed():
    sim=Simulator(SimulationConfig(samples=500,seed=9)); now=datetime(2026,9,19,7,50,tzinfo=SGT)
    r=Route(id="r",name="r",synthetic=True,segments=(Segment(id="a",kind=SegmentKind.RIDE,origin="A",destination="B",mean_minutes=1,stddev_minutes=0,affected_entities=("EWL",)),Segment(id="b",kind=SegmentKind.RIDE,origin="B",destination="C",mean_minutes=1,stddev_minutes=0,affected_entities=("EWL",))))
    assert sim.evaluate(r,now,now+timedelta(hours=1),"s",incident_total_minutes=(20,20),incident_elapsed_minutes=8).p50_arrival==now+timedelta(minutes=14)

def test_remaining_route_does_not_charge_completed_segments():
    assert [s.id for s in route().remaining_after("B").segments]==["wait","ride"]
