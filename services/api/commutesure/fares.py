"""Public transport fares and time-of-day discounts for adult card journeys.

Every number here is copied from a published source, recorded next to it, so the
fare shown beside a route can be traced and updated when the fare review changes.

Documented simplifications:
- Adult stored-value card only; no concession, cash or pass fares.
- Rail and basic bus share one distance fare table. The published LTA table is
  the bus table; PTC states distance fares apply across bus and MRT/LRT.
- A journey with transfers is one through-fare on its total distance.
- The rail share of a mixed journey is the fare for the rail distance alone.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date,datetime,time,timedelta
from typing import Any,Iterable,Sequence
from .domain import Route,SegmentKind

FARE_TABLE_EFFECTIVE=date(2025,12,27)
FARE_TABLE_SOURCE="https://www.lta.gov.sg/content/dam/ltagov/img/map/bus/fare-table.pdf"
DISTANCE_FARE_SOURCE="https://www.ptc.gov.sg/fares/distance-fares-and-transfer-rules/"
PRE_PEAK_SOURCE="https://www.ptc.gov.sg/fares/morning-pre-peak-fares/"
FREE_OFF_PEAK_SOURCE="https://www.lta.gov.sg/content/ltagov/en/newsroom/2025/10/news-releases/free_morning_off-peak_rail_rides.html"
HOLIDAY_SOURCE="https://www.mom.gov.sg/employment-practices/public-holidays"

# (upper distance bound in km, adult card fare in cents) for basic services.
_PUBLISHED_BANDS=((3.2,128),(4.2,138),(5.2,149),(6.2,159),(7.2,168),(8.2,175),(9.2,182),(10.2,186),(11.2,190),(12.2,194),(13.2,198),(14.2,202),(15.2,207),(16.2,211),(17.2,215),(18.2,220),(19.2,224),(20.2,227),(21.2,230),(22.2,233),(23.2,236),(24.2,238),(25.2,240),(26.2,242),(27.2,243))
# From 27.2 km the fare rises one cent per km band up to 40.2 km, then is capped.
ADULT_CARD_BANDS=_PUBLISHED_BANDS+tuple((27.2+step,243+step) for step in range(1,14))
OVER_MAX_DISTANCE_CENTS=257
EXPRESS_SURCHARGE_CENTS=100

PRE_PEAK_CUTOFF=time(7,45)
PRE_PEAK_DISCOUNT_CENTS=50
FREE_OFF_PEAK_START=date(2025,12,27)
FREE_OFF_PEAK_WINDOWS=((time(0,0),time(7,30)),(time(9,0),time(9,45)))
FREE_OFF_PEAK_STATIONS=frozenset({"Punggol Coast","Punggol","Sengkang","Buangkok","Hougang","Kovan"})
# Public holidays, including the Monday observed when a holiday falls on a Sunday.
PUBLIC_HOLIDAYS=frozenset({date(2026,1,1),date(2026,2,17),date(2026,2,18),date(2026,3,21),date(2026,4,3),date(2026,5,1),date(2026,5,27),date(2026,5,31),date(2026,6,1),date(2026,8,9),date(2026,8,10),date(2026,11,8),date(2026,11,9),date(2026,12,25)})

RAIL="rail"; BUS="bus"; EXPRESS="express"
MODES=frozenset({RAIL,BUS,EXPRESS})

@dataclass(frozen=True)
class FareQuote:
    route_id:str; distance_km:float; base_cents:int; discount_cents:int; scheme:str|None
    @property
    def cents(self)->int: return self.base_cents-self.discount_cents

def distance_fare_cents(distance_km:float,express:bool=False)->int:
    if distance_km<0: raise ValueError("distance must be nonnegative")
    base=next((cents for bound,cents in ADULT_CARD_BANDS if distance_km<=bound+1e-9),OVER_MAX_DISTANCE_CENTS)
    return base+(EXPRESS_SURCHARGE_CENTS if express else 0)

def is_discount_day(day:date)->bool:
    return day.weekday()<5 and day not in PUBLIC_HOLIDAYS

def rail_discount(tap_in:datetime,station:str,rail_fare_cents:int)->tuple[int,str|None]:
    """Largest time-of-day discount for the first rail trip of a journey."""
    if not is_discount_day(tap_in.date()): return 0,None
    clock=tap_in.time()
    if station in FREE_OFF_PEAK_STATIONS and tap_in.date()>=FREE_OFF_PEAK_START and any(start<=clock<end for start,end in FREE_OFF_PEAK_WINDOWS):
        return rail_fare_cents,"free_off_peak"
    if clock<PRE_PEAK_CUTOFF: return min(PRE_PEAK_DISCOUNT_CENTS,rail_fare_cents),"pre_peak"
    return 0,None

def quote(route:Route,rail_tap_in:datetime)->FareQuote:
    rides=[segment for segment in route.segments if segment.kind is SegmentKind.RIDE]
    unknown=[segment.id for segment in rides if segment.mode not in MODES or segment.distance_km<=0]
    if unknown: raise ValueError(f"ride segments need a fare mode and distance: {', '.join(unknown)}")
    total=round(sum(segment.distance_km for segment in rides),1)
    base=distance_fare_cents(total,express=any(segment.mode==EXPRESS for segment in rides))
    rail=[segment for segment in rides if segment.mode==RAIL]
    if not rail: return FareQuote(route.id,total,base,0,None)
    rail_fare=min(base,distance_fare_cents(sum(segment.distance_km for segment in rail)))
    discount,scheme=rail_discount(rail_tap_in,rail[0].origin,rail_fare)
    return FareQuote(route.id,total,base,discount,scheme)

def pre_peak_tip(departure:datetime,access_minutes:float,departed:bool)->dict[str,Any]|None:
    """Tell a commuter who has not left yet how to catch the pre-peak discount."""
    if departed or not is_discount_day(departure.date()): return None
    cutoff=datetime.combine(departure.date(),PRE_PEAK_CUTOFF,departure.tzinfo)
    if departure+timedelta(minutes=access_minutes)<cutoff: return None
    # Tapping in must happen strictly before the cutoff, so aim a minute early.
    leave_by=cutoff-timedelta(minutes=access_minutes+1)
    return {"scheme":"pre_peak","leave_by":leave_by.isoformat(),"tap_in_before":cutoff.isoformat(),"saving":PRE_PEAK_DISCOUNT_CENTS/100,"minutes_earlier":round((departure-leave_by).total_seconds()/60)}

def compare(quotes:Sequence[FareQuote],eta_minutes:dict[str,float],on_time:Iterable[str],value_of_time_per_hour:float)->list[dict[str,Any]]:
    """Fare and time side by side, plus one best-value pick.

    Fare divided by minutes would reward slow routes, so value is the generalised
    cost instead: fare plus the traveller's time priced at value_of_time_per_hour.
    The pick is limited to routes expected to arrive by the target when any exist,
    so a cheap route is never promoted over arriving on time.
    """
    if not quotes: return []
    cost={q.route_id:q.cents/100+value_of_time_per_hour*eta_minutes[q.route_id]/60 for q in quotes}
    dependable=set(on_time)&set(cost); eligible=dependable or set(cost)
    best=min(eligible,key=lambda route_id:(cost[route_id],route_id))
    cheapest=min(quotes,key=lambda q:(q.cents,eta_minutes[q.route_id],q.route_id))
    fastest=min(quotes,key=lambda q:(eta_minutes[q.route_id],q.cents,q.route_id))
    rows=[]
    for q in quotes:
        saved=eta_minutes[cheapest.route_id]-eta_minutes[q.route_id]; extra=q.cents-cheapest.cents
        rows.append({"route_id":q.route_id,"currency":"SGD","card":"adult","distance_km":q.distance_km,"amount":q.cents/100,"base_amount":q.base_cents/100,"discount":q.discount_cents/100,"scheme":q.scheme,
            "eta_minutes":round(eta_minutes[q.route_id],1),"generalised_cost":round(cost[q.route_id],2),
            "extra_cost_per_minute_saved":round(extra/100/saved,3) if extra>0 and saved>=1 else None,
            "cheapest":q.route_id==cheapest.route_id,"fastest":q.route_id==fastest.route_id,"best_value":q.route_id==best,"arrives_by_target":q.route_id in dependable})
    return rows

def sources()->dict[str,str]:
    return {"fare_table":FARE_TABLE_SOURCE,"distance_fares":DISTANCE_FARE_SOURCE,"pre_peak":PRE_PEAK_SOURCE,"free_off_peak":FREE_OFF_PEAK_SOURCE,"public_holidays":HOLIDAY_SOURCE}
