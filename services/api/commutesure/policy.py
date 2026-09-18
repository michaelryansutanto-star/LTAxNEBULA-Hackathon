from dataclasses import dataclass
from datetime import datetime,timedelta
from .domain import Action,EvaluationResult,Recommendation

@dataclass(frozen=True)
class PolicyConfig:
    current_risk_threshold:float=.70; minimum_improvement:float=.15; alternative_floor:float=.75; minimum_action_minutes:float=2; hysteresis_points:float=.05; expiry_minutes:int=15

class RecommendationPolicy:
    def __init__(self,config:PolicyConfig): self.config=config
    def decide(self,current:EvaluationResult,alternatives:list[EvaluationResult],now:datetime,decision_deadline:datetime|None,*,fresh:bool,feasible_route_ids:set[str],selected_route_id:str|None=None)->Recommendation:
        expiry=now+timedelta(minutes=self.config.expiry_minutes)
        if not fresh: return Recommendation(Action.UNCERTAIN,current.route_id,"stale_inputs","Provider evidence is stale. Keep monitoring and verify with official sources.",0,now,expiry,decision_deadline,"stale")
        if decision_deadline is None or (decision_deadline-now).total_seconds()/60<=self.config.minimum_action_minutes:
            return Recommendation(Action.MONITOR,current.route_id,"decision_passed","The useful switching window has passed; monitor conditions.",0,now,expiry,decision_deadline)
        viable=[x for x in alternatives if x.route_id in feasible_route_ids]
        if selected_route_id and current.route_id==selected_route_id and viable:
            best=max(viable,key=lambda x:x.on_time_probability)
            if best.on_time_probability-current.on_time_probability<self.config.hysteresis_points:
                return Recommendation(Action.STAY,current.route_id,"hysteresis_hold","Stay on the selected route; the small change does not justify switching again.",round(best.on_time_probability-current.on_time_probability,4),now,expiry,decision_deadline)
        if not viable: return Recommendation(Action.MONITOR,current.route_id,"no_feasible_alternative","No feasible alternative is currently available. Staying does not guarantee punctuality.",0,now,expiry,decision_deadline)
        best=max(viable,key=lambda x:x.on_time_probability); improvement=round(best.on_time_probability-current.on_time_probability,4)
        gates=current.on_time_probability<self.config.current_risk_threshold and improvement+1e-9>=self.config.minimum_improvement and best.on_time_probability>=self.config.alternative_floor
        if gates:
            points=round(improvement*100); explanation=f"Switch to {best.route_id}; the simulated on-time chance improves by {points} percentage points. Act before {decision_deadline.strftime('%H:%M')}."
            return Recommendation(Action.REROUTE,best.route_id,"material_improvement",explanation,improvement,now,expiry,decision_deadline)
        return Recommendation(Action.STAY,current.route_id,"gates_not_met","Stay on the current route and monitor; no alternative clears all safety thresholds.",improvement,now,expiry,decision_deadline)
