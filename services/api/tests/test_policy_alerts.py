from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from commutesure.alerts import AlertNormalizer,ExtractionStatus
from commutesure.domain import Action,EvaluationResult
from commutesure.policy import PolicyConfig,RecommendationPolicy
SGT=ZoneInfo("Asia/Singapore"); NOW=datetime(2026,9,19,7,51,tzinfo=SGT)
def metric(route_id,p): return EvaluationResult(route_id=route_id,on_time_probability=p,p50_arrival=NOW,p90_arrival=NOW,sample_count=5000,model_version="demo-v1",seed=42,input_snapshot_id="s",quality_label="good",quality_reasons=())
def test_policy_threshold_boundaries_and_explanation():
    rec=RecommendationPolicy(PolicyConfig()).decide(metric("current",.699),[metric("alt",.849)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"alt"})
    assert rec.action is Action.REROUTE and rec.route_id=="alt" and rec.improvement==.15 and "15 percentage points" in rec.explanation
def test_each_policy_gate_is_exact():
    policy=RecommendationPolicy(PolicyConfig())
    decide=lambda current,alternative: policy.decide(metric("current",current),[metric("alt",alternative)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"alt"})
    assert decide(.70,.90).action is Action.STAY
    assert decide(.60,.749).action is Action.STAY
    assert decide(.60,.75).action is Action.REROUTE
    assert decide(.60,.749).improvement==.149
def test_policy_stays_for_stale_missed_or_unavailable_alternative():
    policy=RecommendationPolicy(PolicyConfig())
    for fresh,deadline,feasible in [(False,NOW+timedelta(minutes=10),{"alt"}),(True,NOW+timedelta(seconds=30),{"alt"}),(True,NOW+timedelta(minutes=10),set())]:
        assert policy.decide(metric("current",.5),[metric("alt",.95)],NOW,deadline,fresh=fresh,feasible_route_ids=feasible).action in {Action.MONITOR,Action.UNCERTAIN}
def test_hysteresis_holds_existing_route_for_small_reversal():
    rec=RecommendationPolicy(PolicyConfig(hysteresis_points=.08)).decide(metric("alt",.79),[metric("current",.84)],NOW,NOW+timedelta(minutes=10),fresh=True,feasible_route_ids={"current"},selected_route_id="alt")
    assert rec.action is Action.STAY and rec.route_id=="alt"
def test_alert_normalization_duplicate_revision_resolution_and_malformed():
    n=AlertNormalizer(max_age=timedelta(minutes=10)); p={"incident_id":"ewl-1","revision_id":"1","type":"SIGNALLING_FAULT","severity":"MAJOR","affected_entities":["EWL"],"started_at":NOW.isoformat(),"observed_at":NOW.isoformat(),"source":"demo","status":"active"}
    first=n.ingest(p,NOW,{"EWL"}); duplicate=n.ingest(p,NOW,{"EWL"}); update=n.ingest({**p,"revision_id":"2","severity":"CRITICAL"},NOW,{"EWL"}); resolved=n.ingest({**p,"revision_id":"3","status":"resolved"},NOW,{"EWL"}); malformed=n.ingest({"incident_id":"oops"},NOW,{"EWL"})
    assert first.accepted and duplicate.duplicate and update.accepted and resolved.event.resolved and malformed.extraction_status is ExtractionStatus.INVALID
def test_alert_rejects_stale_and_irrelevant():
    n=AlertNormalizer(max_age=timedelta(minutes=5)); p={"incident_id":"x","revision_id":"1","type":"FAULT","severity":"MAJOR","affected_entities":["NSL"],"started_at":(NOW-timedelta(minutes=20)).isoformat(),"observed_at":(NOW-timedelta(minutes=10)).isoformat(),"source":"demo","status":"active"}
    assert n.ingest(p,NOW,{"NSL"}).reason=="stale" and n.ingest({**p,"incident_id":"y","observed_at":NOW.isoformat()},NOW,{"EWL"}).reason=="irrelevant"
