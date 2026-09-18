from pathlib import Path
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from commutesure.app import create_app
from commutesure.config import Settings

def client(tmp_path:Path,demo_mode=True): return TestClient(create_app(Settings(database_path=tmp_path/"test.db",demo_mode=demo_mode,simulation_samples=600,rate_limit_per_minute=1000)))

def test_health_and_full_demo_flow(tmp_path):
    with client(tmp_path) as api:
        health=api.get("/health"); assert health.json()["status"]=="ok" and "X-Correlation-ID" in health.headers
        state=api.post("/v1/demo/scenarios/rachel/reset").json()["data"]; journey_id=state["journey"]["id"]
        assert api.post(f"/v1/journeys/{journey_id}/start").json()["data"]["journey"]["status"]=="monitoring"
        baseline=api.post(f"/v1/journeys/{journey_id}/evaluate").json()["data"]
        assert baseline["recommendation"]["action"] in {"stay","monitor"}
        disrupted=api.post("/v1/demo/scenarios/rachel/fault").json()["data"]
        assert disrupted["recommendation"]["action"]=="reroute" and disrupted["recommendation"]["route_id"]!="current-ewl"
        assert len(api.get("/v1/notifications").json()["data"])==1
        api.post("/v1/demo/scenarios/rachel/fault")
        assert len(api.get("/v1/notifications").json()["data"])==1
        accepted=api.post(f"/v1/journeys/{journey_id}/routes/{disrupted['recommendation']['route_id']}/accept").json()["data"]
        assert accepted["journey"]["selected_route_id"]==disrupted["recommendation"]["route_id"] and accepted["contingency"]["route_version"]
        assert api.post(f"/v1/journeys/{journey_id}/finish").json()["data"]["journey"]["status"]=="finished"

def test_plan_validation_persistence_selected_route_and_notification_dedupe_reopen(tmp_path):
    db=tmp_path/"persist.db"; settings=Settings(database_path=db,demo_mode=True,simulation_samples=300,rate_limit_per_minute=1000)
    with TestClient(create_app(settings)) as api:
        assert api.post("/v1/commute-plans",json={"origin":"","destination":"X","weekdays":[8],"deadline":"08:45","buffer_minutes":-2}).status_code==422
        state=api.post("/v1/demo/scenarios/rachel/reset").json()["data"]; jid=state["journey"]["id"]
        api.post(f"/v1/journeys/{jid}/start"); snap=api.post("/v1/demo/scenarios/rachel/fault").json()["data"]; rid=snap["recommendation"]["route_id"]
        api.post(f"/v1/journeys/{jid}/routes/{rid}/accept"); api.patch("/v1/commute-plans/rachel",json={"buffer_minutes":15})
    with TestClient(create_app(settings)) as api:
        assert api.get("/v1/commute-plans/rachel").json()["data"]["buffer_minutes"]==15
        assert api.get(f"/v1/journeys/{jid}/snapshot").json()["data"]["journey"]["selected_route_id"]==rid
        before=len(api.get("/v1/notifications").json()["data"]); api.post("/v1/demo/scenarios/rachel/fault")
        assert len(api.get("/v1/notifications").json()["data"])==before

def test_demo_gating_structured_errors_and_aliases(tmp_path):
    with client(tmp_path,False) as api:
        response=api.post("/v1/demo/scenarios/rachel/reset"); assert response.status_code==403 and response.json()["success"] is False
        missing=api.get("/v1/journeys/nope/recommendation"); assert missing.status_code==404 and missing.json()["error"]["code"]=="not_found"
    with client(tmp_path) as api:
        get_state=api.get("/v1/demo/scenarios/rachel"); assert get_state.status_code==200
        assert api.post("/v1/demo/scenarios/rachel/start").status_code==200
        assert api.post("/v1/demo/scenarios/rachel/pause").status_code==200
        assert api.post("/v1/demo/scenarios/rachel/advance",json={"minutes":5}).status_code==200
        assert api.post("/v1/demo/scenarios/rachel/stale").status_code==200
        assert api.post("/v1/demo/scenarios/rachel/resolve").status_code==200

def test_reset_is_coherent_and_isolated(tmp_path):
    with client(tmp_path) as api:
        initial=api.post("/v1/demo/scenarios/rachel/reset").json()["data"]; jid=initial["journey"]["id"]
        api.post(f"/v1/journeys/{jid}/start"); api.post("/v1/demo/scenarios/rachel/fault"); api.post("/v1/demo/scenarios/rachel/advance",json={"minutes":20})
        reset=api.post("/v1/demo/scenarios/rachel/reset").json()["data"]
        assert reset["clock"]==initial["clock"] and reset["journey"]["selected_route_id"]=="current-ewl" and api.get("/v1/notifications").json()["data"]==[]

def test_bounded_clock_input(tmp_path):
    with client(tmp_path) as api:
        assert api.post("/v1/demo/scenarios/rachel/advance",json={"minutes":10000}).status_code==422

def test_create_dated_journey_and_frontend_commute_aliases(tmp_path):
    with client(tmp_path) as api:
        saved=api.post("/v1/commute-plans",json={"origin":"Tampines","destination":"Raffles Place","weekdays":["Mon","Tue"],"arrival_deadline":"08:50","early_arrival_buffer_minutes":12})
        assert saved.status_code==200 and saved.json()["data"]["deadline"]=="08:50:00"
        created=api.post("/v1/journeys",json={"plan_id":"rachel","service_date":"2026-09-22T00:00:00+08:00"})
        assert created.status_code==200 and created.json()["data"]["journey"]["service_date"]=="2026-09-22"

def test_mutations_reject_untrusted_origin_but_allow_no_origin(tmp_path):
    with client(tmp_path) as api:
        denied=api.post("/v1/demo/scenarios/rachel/reset",headers={"Origin":"https://evil.example"})
        assert denied.status_code==403 and denied.json()["error"]["code"]=="origin_forbidden"
        assert api.post("/v1/demo/scenarios/rachel/reset").status_code==200

def test_request_body_and_identifiers_are_bounded(tmp_path):
    with client(tmp_path) as api:
        oversized='{"origin":"'+('x'*70_000)+'"}'
        response=api.post("/v1/commute-plans",content=oversized,headers={"Content-Type":"application/json"})
        assert response.status_code==413
        assert api.get("/v1/commute-plans/"+("x"*129)).status_code==422
        invalid_journey=api.post("/v1/journeys",json={"plan_id":"x"*129,"service_date":"2026-09-22T00:00:00+08:00"})
        assert invalid_journey.status_code==422

def test_patch_reuses_weekday_and_deadline_validation(tmp_path):
    with client(tmp_path) as api:
        bad_days=api.patch("/v1/commute-plans/rachel",json={"weekdays":["Funday"]})
        bad_deadline=api.patch("/v1/commute-plans/rachel",json={"deadline":"25:70"})
        assert bad_days.status_code==422 and bad_deadline.status_code==422

def test_settings_are_safe_by_default_and_bounded():
    assert Settings().demo_mode is False
    for values in ({"simulation_samples":99},{"simulation_samples":100_001},{"rate_limit_per_minute":0},{"simulation_seed":-1}):
        with pytest.raises(ValidationError): Settings(**values)
