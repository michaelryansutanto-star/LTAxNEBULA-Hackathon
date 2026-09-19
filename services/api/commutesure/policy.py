from dataclasses import dataclass
from datetime import datetime,timedelta
from .domain import Action,EvaluationResult,Recommendation

@dataclass(frozen=True)
class PolicyConfig:
    # Interrupt only when the current route is expected to miss the target and switching saves real time.
    minimum_saving_minutes:float=10; hysteresis_minutes:float=5; minimum_action_minutes:float=2; expiry_minutes:int=15

def minutes_between(earlier:datetime,later:datetime)->float: return (later-earlier).total_seconds()/60

class RecommendationPolicy:
    def __init__(self,config:PolicyConfig): self.config=config
    def decide(self,current:EvaluationResult,alternatives:list[EvaluationResult],now:datetime,decision_deadline:datetime|None,*,fresh:bool,feasible_route_ids:set[str],selected_route_id:str|None=None,route_names:dict[str,str]|None=None)->Recommendation:
        expiry=now+timedelta(minutes=self.config.expiry_minutes)
        if not fresh: return Recommendation(Action.UNCERTAIN,current.route_id,"stale_inputs","Provider evidence is stale. Keep monitoring and verify with official sources.",0,now,expiry,decision_deadline,"stale")
        if decision_deadline is None or minutes_between(now,decision_deadline)<=self.config.minimum_action_minutes:
            return Recommendation(Action.MONITOR,current.route_id,"decision_passed","The useful switching window has passed; monitor conditions.",0,now,expiry,decision_deadline)
        viable=[x for x in alternatives if x.route_id in feasible_route_ids]
        if not viable: return Recommendation(Action.MONITOR,current.route_id,"no_feasible_alternative","No feasible alternative is currently available. Staying does not guarantee punctuality.",0,now,expiry,decision_deadline)
        best=min(viable,key=lambda x:(x.eta,x.route_id)); saving=round(minutes_between(best.eta,current.eta),1)
        if selected_route_id and current.route_id==selected_route_id and saving<self.config.hysteresis_minutes:
            return Recommendation(Action.STAY,current.route_id,"hysteresis_hold","Stay on the selected route; the small change does not justify switching again.",saving,now,expiry,decision_deadline)
        if current.late_minutes>0 and saving>=self.config.minimum_saving_minutes:
            outcome="on time" if best.late_minutes<=0 else f"about {round(best.late_minutes)} min late instead of {round(current.late_minutes)}"
            explanation=f"Change to: {(route_names or {}).get(best.route_id,best.route_id)}. You arrive about {round(saving)} min sooner at {best.eta.strftime('%H:%M')}, {outcome}. Act before {decision_deadline.strftime('%H:%M')}."
            return Recommendation(Action.REROUTE,best.route_id,"material_time_saving",explanation,saving,now,expiry,decision_deadline)
        reason="on_time" if current.late_minutes<=0 else "saving_too_small"
        explanation="Stay on the current route; it is expected to arrive by your target." if current.late_minutes<=0 else "Stay on the current route and monitor; no alternative saves enough time to justify switching."
        return Recommendation(Action.STAY,current.route_id,reason,explanation,saving,now,expiry,decision_deadline)
