from datetime import datetime
from zoneinfo import ZoneInfo
from .domain import Route,Segment,SegmentKind
SGT=ZoneInfo("Asia/Singapore")
INITIAL_TIME=datetime(2026,9,21,7,40,tzinfo=SGT)
DECISION_DEADLINE=datetime(2026,9,21,8,6,tzinfo=SGT)
# The bus option is only reachable until Rachel has committed to the station.
BUS_DECISION_DEADLINE=datetime(2026,9,21,7,48,tzinfo=SGT)
# Synthetic fault: services are held west of Bugis for 46 to 54 minutes from 07:48.
FAULT_STARTED_AT=datetime(2026,9,21,7,48,tzinfo=SGT); FAULT_DURATION_MINUTES=(46,54)
# Walk from home to the fare gates; every rail option taps in at the same station.
RAIL_ACCESS_MINUTES=6

# Approximate WGS84 positions (lat, lon) for drawing routes on the map. Stations sit at their real
# locations to roughly 100 m; "Tampines" (home) and the bus stop and corridor are synthetic.
PLACES={"Tampines":(1.3560,103.9428),"EW2 platform":(1.3533,103.9452),"Simei":(1.3432,103.9533),"Tanah Merah":(1.3272,103.9464),"Bedok":(1.3240,103.9300),"Kembangan":(1.3210,103.9129),"Eunos":(1.3197,103.9030),"Paya Lebar":(1.3177,103.8926),"Aljunied":(1.3164,103.8829),"Kallang":(1.3115,103.8714),"Lavender":(1.3072,103.8630),"Bugis":(1.3009,103.8559),"City Hall":(1.2931,103.8520),"Raffles Place":(1.2840,103.8515),
    "Bugis DTL":(1.2997,103.8570),"Promenade":(1.2932,103.8610),"Bayfront":(1.2818,103.8590),"Downtown":(1.2795,103.8528),"Synthetic bus stop":(1.3578,103.9470),"Expressway east":(1.3290,103.9620),"Expressway coast":(1.3040,103.9250),"Expressway city":(1.2960,103.8760)}
_EWL_TO_BUGIS=("Simei","Tanah Merah","Bedok","Kembangan","Eunos","Paya Lebar","Aljunied","Kallang","Lavender")
# Places a segment passes between its origin and destination.
SEGMENT_VIA={"ride-ewl-bugis":_EWL_TO_BUGIS,"ride-ewl-city":("City Hall",),"ride-dtl":("Promenade","Bayfront"),"ride-bus":("Expressway east","Expressway coast","Expressway city")}

def segment_path(segment_id:str,origin:str,destination:str)->list[list[float]]:
    names=(origin,*SEGMENT_VIA.get(segment_id,()),destination)
    return [list(PLACES[name]) for name in names if name in PLACES]

def _rail_access()->tuple[Segment,...]:
    # Both rail options share the walk, the wait and the train as far as Bugis; the synthetic fault sits west of Bugis.
    return (
        Segment("walk-tampines",SegmentKind.WALK,"Tampines","EW2 platform",RAIL_ACCESS_MINUTES,1,instructions="Walk to the synthetic EWL platform."),
        Segment("wait-ewl",SegmentKind.WAIT,"EW2 platform","EW2 platform",4,1,instructions="Wait for the next westbound train."),
        Segment("ride-ewl-bugis",SegmentKind.RIDE,"EW2 platform","Bugis",22,2,instructions="Ride the synthetic EWL itinerary to Bugis.",mode="rail",distance_km=12.4),
    )

def rachel_routes()->tuple[Route,...]:
    return (
      Route("current-ewl","Stay on East-West Line (synthetic)",True,(*_rail_access(),
        Segment("ride-ewl-city",SegmentKind.RIDE,"Bugis","Raffles Place",12,2,affected_entities=("EWL",),instructions="Stay on the train from Bugis to Raffles Place.",mode="rail",distance_km=3.3),
      ),"Bugis",DECISION_DEADLINE,True,"rachel-v1",450,0),
      Route("bugis-dtl","Switch at Bugis to Downtown Line (synthetic)",True,(*_rail_access(),
        Segment("transfer-dtl",SegmentKind.TRANSFER,"Bugis","Bugis DTL",4,1,instructions="Follow signs for the synthetic DTL transfer."),
        Segment("wait-dtl",SegmentKind.WAIT,"Bugis DTL","Bugis DTL",3,1,instructions="Wait for the next train."),
        Segment("ride-dtl",SegmentKind.RIDE,"Bugis DTL","Downtown",7,1,instructions="Ride to Downtown.",mode="rail",distance_km=3.0),
        Segment("walk-office",SegmentKind.WALK,"Downtown","Raffles Place",4,1,instructions="Walk to destination."),
      ),"Bugis",DECISION_DEADLINE,True,"rachel-v1",850,1),
      Route("bus-connector","Express bus connector (synthetic)",True,(
        Segment("walk-bus",SegmentKind.WALK,"Tampines","Synthetic bus stop",8,1,instructions="Walk to the labelled synthetic stop."),
        Segment("wait-bus",SegmentKind.WAIT,"Synthetic bus stop","Synthetic bus stop",8,2,instructions="Wait for the synthetic connector."),
        Segment("ride-bus",SegmentKind.RIDE,"Synthetic bus stop","Raffles Place",39,4,instructions="Ride the synthetic connector.",mode="express",distance_km=17.0),
      ),"Tampines",BUS_DECISION_DEADLINE,True,"rachel-v1",600,1),
    )

def fault_payload(now:datetime,revision="1",status="active"):
    return {"incident_id":"rachel:ewl-signalling","revision_id":revision,"type":"SIGNALLING_FAULT","severity":"MAJOR","affected_entities":["EWL"],"started_at":FAULT_STARTED_AT.isoformat(),"observed_at":now.isoformat(),"source":"CommuteSure deterministic demo fixture","status":status}
