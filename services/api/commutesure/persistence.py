from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime,timezone
import json,sqlite3
from pathlib import Path
from typing import Any,Iterator

SCHEMA="""
CREATE TABLE IF NOT EXISTS commute_plans(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS journeys(id TEXT PRIMARY KEY,scenario_id TEXT NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routes(id TEXT NOT NULL,journey_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(id,journey_id));
CREATE TABLE IF NOT EXISTS alerts(incident_id TEXT NOT NULL,revision_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(incident_id,revision_id));
CREATE TABLE IF NOT EXISTS evaluations(id INTEGER PRIMARY KEY AUTOINCREMENT,journey_id TEXT NOT NULL,sequence INTEGER NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recommendations(journey_id TEXT PRIMARY KEY,sequence INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,journey_id TEXT NOT NULL,semantic_key TEXT NOT NULL UNIQUE,data TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_state(scenario_id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_evaluations_journey ON evaluations(journey_id,sequence DESC);
CREATE INDEX IF NOT EXISTS ix_notifications_journey ON notifications(journey_id,created_at DESC);
"""

class Repository:
    def __init__(self,path:Path): self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True); self.migrate()
    @contextmanager
    def connection(self)->Iterator[sqlite3.Connection]:
        connection=sqlite3.connect(self.path,timeout=10); connection.row_factory=sqlite3.Row
        try:
            connection.execute("PRAGMA foreign_keys=ON"); yield connection; connection.commit()
        except Exception: connection.rollback(); raise
        finally: connection.close()
    def migrate(self):
        with self.connection() as connection: connection.executescript(SCHEMA)
    def put(self,table:str,key_columns:dict[str,Any],data:dict[str,Any],**extra:Any):
        allowed={"commute_plans","journeys","routes","alerts","recommendations","scenario_state"}
        if table not in allowed: raise ValueError("invalid table")
        now=datetime.now(timezone.utc).isoformat(); values={**key_columns,"data":json.dumps(data,separators=(",",":"),sort_keys=True),**extra}
        if table not in {"routes","alerts"}: values.setdefault("updated_at",now)
        columns=list(values); placeholders=",".join("?" for _ in columns); updates=",".join(f"{c}=excluded.{c}" for c in columns if c not in key_columns)
        with self.connection() as connection: connection.execute(f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders}) ON CONFLICT ({','.join(key_columns)}) DO UPDATE SET {updates}",tuple(values[c] for c in columns))
    def get(self,table:str,where:dict[str,Any])->dict[str,Any]|None:
        if table not in {"commute_plans","journeys","routes","alerts","recommendations","scenario_state"}: raise ValueError("invalid table")
        clause=" AND ".join(f"{key}=?" for key in where)
        with self.connection() as connection: row=connection.execute(f"SELECT data FROM {table} WHERE {clause}",tuple(where.values())).fetchone()
        return json.loads(row["data"]) if row else None
    def list_data(self,table:str,where:dict[str,Any]|None=None)->list[dict[str,Any]]:
        if table not in {"routes","alerts","notifications","evaluations"}: raise ValueError("invalid table")
        clause=""; params:tuple[Any,...]=()
        if where: clause=" WHERE "+" AND ".join(f"{k}=?" for k in where); params=tuple(where.values())
        with self.connection() as connection: rows=connection.execute(f"SELECT data FROM {table}{clause} ORDER BY rowid",params).fetchall()
        return [json.loads(row["data"]) for row in rows]
    def add_evaluation(self,journey_id:str,sequence:int,data:dict[str,Any]):
        with self.connection() as connection: connection.execute("INSERT INTO evaluations(journey_id,sequence,data,created_at) VALUES(?,?,?,?)",(journey_id,sequence,json.dumps(data),datetime.now(timezone.utc).isoformat()))
    def notify_once(self,journey_id:str,semantic_key:str,data:dict[str,Any])->bool:
        try:
            with self.connection() as connection: connection.execute("INSERT INTO notifications(journey_id,semantic_key,data,state,created_at) VALUES(?,?,?,?,?)",(journey_id,semantic_key,json.dumps(data),"delivered",datetime.now(timezone.utc).isoformat()))
            return True
        except sqlite3.IntegrityError:return False
    def reset_scenario(self,scenario_id:str):
        with self.connection() as connection:
            ids=[row[0] for row in connection.execute("SELECT id FROM journeys WHERE scenario_id=?",(scenario_id,))]
            for jid in ids:
                for table in ("routes","evaluations","recommendations","notifications"): connection.execute(f"DELETE FROM {table} WHERE journey_id=?",(jid,))
            connection.execute("DELETE FROM journeys WHERE scenario_id=?",(scenario_id,)); connection.execute("DELETE FROM alerts WHERE incident_id LIKE ?",(f"{scenario_id}:%",)); connection.execute("DELETE FROM scenario_state WHERE scenario_id=?",(scenario_id,))
