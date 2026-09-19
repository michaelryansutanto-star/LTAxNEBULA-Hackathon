from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from commutesure.alerts import AlertNormalizer,ExtractionStatus
from commutesure.domain import Action,EvaluationResult
from commutesure.policy import PolicyConfig,RecommendationPolicy
SGT=ZoneInfo("Asia/Singapore"); NOW=datetime(2026,9,19,7,51,tzinfo=SGT); TARGET=NOW+timedelta(minutes=44)
def metric(route_id,late): return EvaluationResult(route_id=route_id,eta=TARGET+timedelta(minutes=late),conservative_eta=TARGET+timedelta(minutes=late+4),late_minutes=late,sample_count=5000,model_version="demo-v1",seed=42,input_snapshot_id="s",quality_label="good",quality_reasons=())
def test_policy_reroutes_for_a_material_saving_and_explains_it_in_minutes():
    policy=RecommendationPolicy(PolicyConfig())
    rec=policy.decide(metric("current",18),[metric("alt",-4)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"alt"})
    assert rec.action is Action.REROUTE and rec.route_id=="alt" and rec.minutes_saved==22 and "22 min sooner" in rec.explanation and "on time" in rec.explanation and "%" not in rec.explanation
    still_late=policy.decide(metric("current",30),[metric("alt",6)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"alt"})
    assert "6 min late instead of 30" in still_late.explanation
def test_each_policy_gate_is_exact():
    policy=RecommendationPolicy(PolicyConfig())
    decide=lambda current,alternative: policy.decide(metric("current",current),[metric("alt",alternative)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"alt"})
    on_time=decide(0,-20); assert on_time.action is Action.STAY and on_time.reason_code=="on_time"
    small=decide(12,2.1); assert small.action is Action.STAY and small.reason_code=="saving_too_small" and small.minutes_saved==9.9
    assert decide(12,2).action is Action.REROUTE
def test_policy_stays_for_stale_missed_or_unavailable_alternative():
    policy=RecommendationPolicy(PolicyConfig())
    for fresh,deadline,feasible in [(False,NOW+timedelta(minutes=10),{"alt"}),(True,NOW+timedelta(seconds=30),{"alt"}),(True,NOW+timedelta(minutes=10),set())]:
        assert policy.decide(metric("current",25),[metric("alt",-5)],NOW,deadline,fresh=fresh,feasible_route_ids=feasible).action in {Action.MONITOR,Action.UNCERTAIN}
def test_hysteresis_holds_existing_route_for_small_reversal():
    rec=RecommendationPolicy(PolicyConfig(hysteresis_minutes=5)).decide(metric("alt",3),[metric("current",-1)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"current"},selected_route_id="alt")
    assert rec.action is Action.STAY and rec.route_id=="alt" and rec.reason_code=="hysteresis_hold"
def test_alert_normalization_duplicate_revision_resolution_and_malformed():
    n=AlertNormalizer(max_age=timedelta(minutes=10)); p={"incident_id":"ewl-1","revision_id":"1","type":"SIGNALLING_FAULT","severity":"MAJOR","affected_entities":["EWL"],"started_at":NOW.isoformat(),"observed_at":NOW.isoformat(),"source":"demo","status":"active"}
    first=n.ingest(p,NOW,{"EWL"}); duplicate=n.ingest(p,NOW,{"EWL"}); update=n.ingest({**p,"revision_id":"2","severity":"CRITICAL"},NOW,{"EWL"}); resolved=n.ingest({**p,"revision_id":"3","status":"resolved"},NOW,{"EWL"}); malformed=n.ingest({"incident_id":"oops"},NOW,{"EWL"})
    assert first.accepted and duplicate.duplicate and update.accepted and resolved.event.resolved and malformed.extraction_status is ExtractionStatus.INVALID
def test_alert_rejects_stale_and_irrelevant():
    n=AlertNormalizer(max_age=timedelta(minutes=5)); p={"incident_id":"x","revision_id":"1","type":"FAULT","severity":"MAJOR","affected_entities":["NSL"],"started_at":(NOW-timedelta(minutes=20)).isoformat(),"observed_at":(NOW-timedelta(minutes=10)).isoformat(),"source":"demo","status":"active"}
    assert n.ingest(p,NOW,{"NSL"}).reason=="stale" and n.ingest({**p,"incident_id":"y","observed_at":NOW.isoformat()},NOW,{"EWL"}).reason=="irrelevant"
