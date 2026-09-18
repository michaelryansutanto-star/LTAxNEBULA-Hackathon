from datetime import datetime
from zoneinfo import ZoneInfo
from .domain import Route,Segment,SegmentKind
SGT=ZoneInfo("Asia/Singapore")
INITIAL_TIME=datetime(2026,9,21,7,40,tzinfo=SGT)
DECISION_DEADLINE=datetime(2026,9,21,8,6,tzinfo=SGT)

def rachel_routes()->tuple[Route,...]:
    return (
      Route("current-ewl","Stay on East-West Line (synthetic)",True,(
        Segment("walk-tampines",SegmentKind.WALK,"Tampines","EW2 platform",6,1,instructions="Walk to the synthetic EWL platform."),
        Segment("wait-ewl",SegmentKind.WAIT,"EW2 platform","EW2 platform",4,1,affected_entities=("EWL",),instructions="Wait for the next eastbound train."),
        Segment("ride-ewl",SegmentKind.RIDE,"EW2 platform","Raffles Place",34,3,affected_entities=("EWL",),instructions="Ride the synthetic EWL itinerary to Raffles Place."),
      ),"Bugis",DECISION_DEADLINE,True,"rachel-v1",450,0),
      Route("bugis-dtl","Switch at Bugis to Downtown Line (synthetic)",True,(
        Segment("ride-bugis",SegmentKind.RIDE,"Tampines","Bugis",25,2,instructions="Continue to the synthetic Bugis decision point."),
        Segment("transfer-dtl",SegmentKind.TRANSFER,"Bugis","Bugis DTL",5,1,instructions="Follow signs for the synthetic DTL transfer."),
        Segment("wait-dtl",SegmentKind.WAIT,"Bugis DTL","Bugis DTL",3,1,instructions="Wait for the next train."),
        Segment("ride-dtl",SegmentKind.RIDE,"Bugis DTL","Downtown",8,1,instructions="Ride to Downtown."),
        Segment("walk-office",SegmentKind.WALK,"Downtown","Raffles Place",5,1,instructions="Walk to destination."),
      ),"Bugis",DECISION_DEADLINE,True,"rachel-v1",850,1),
      Route("bus-connector","MRT and bus connector (synthetic)",True,(
        Segment("walk-bus",SegmentKind.WALK,"Tampines","Synthetic bus stop",8,1,instructions="Walk to the labelled synthetic stop."),
        Segment("wait-bus",SegmentKind.WAIT,"Synthetic bus stop","Synthetic bus stop",8,2,instructions="Wait for the synthetic connector."),
        Segment("ride-bus",SegmentKind.RIDE,"Synthetic bus stop","Raffles Place",39,4,instructions="Ride the synthetic connector."),
      ),"Tampines",datetime(2026,9,21,7,48,tzinfo=SGT),True,"rachel-v1",600,1),
    )

def fault_payload(now:datetime,revision="1",status="active"):
    return {"incident_id":"rachel:ewl-signalling","revision_id":revision,"type":"SIGNALLING_FAULT","severity":"MAJOR","affected_entities":["EWL"],"started_at":datetime(2026,9,21,7,48,tzinfo=SGT).isoformat(),"observed_at":now.isoformat(),"source":"CommuteSure deterministic demo fixture","status":status}
