from dataclasses import dataclass, replace
from datetime import datetime, timedelta


@dataclass(frozen=True)
class DemoClock:
    _instant: datetime

    def __post_init__(self) -> None:
        if self._instant.tzinfo is None or self._instant.utcoffset() is None:
            raise ValueError("clock instant must be timezone-aware")

    def now(self) -> datetime:
        return self._instant

    def advance(self, amount: timedelta) -> "DemoClock":
        if amount.total_seconds() < 0:
            raise ValueError("clock cannot move backwards")
        return replace(self, _instant=self._instant + amount)
