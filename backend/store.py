"""Immutable snapshots and transactional local SQLite metadata."""

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


class Store:
    def __init__(self, root=None):
        self.root = Path(root or os.getenv("EV_DATA_DIR", "data/local"))
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "snapshots").mkdir(exist_ok=True)
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS active (key TEXT PRIMARY KEY, value TEXT)")
            db.execute(
                "CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, name TEXT, settings TEXT, snapshot_id TEXT, created_at TEXT)"
            )

    def connect(self):
        return sqlite3.connect(self.root / "metadata.sqlite3")

    def save(self, dataset, content):
        sid = uuid.uuid4().hex
        dataset["metadata"]["snapshot_id"] = sid
        target = self.root / "snapshots" / sid
        target.mkdir()
        with (target / "dataset.json").open("x") as output:
            json.dump(dataset, output, ensure_ascii=False, allow_nan=False)
        with (target / "source.raw").open("xb") as output:
            output.write(content)
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO active VALUES ('snapshot', ?)", (sid,))
        return dataset

    def load(self):
        with self.connect() as db:
            row = db.execute("SELECT value FROM active WHERE key='snapshot'").fetchone()
        if not row:
            return None
        return json.loads((self.root / "snapshots" / row[0] / "dataset.json").read_text())

    def reset(self):
        with self.connect() as db:
            db.execute("DELETE FROM active")

    def activate(self, sid):
        if not (self.root / "snapshots" / sid / "dataset.json").is_file():
            raise ValueError("Saved snapshot is unavailable.")
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO active VALUES ('snapshot', ?)", (sid,))

    def scenarios(self):
        with self.connect() as db:
            rows = db.execute(
                "SELECT id,name,settings,snapshot_id,created_at FROM scenarios ORDER BY created_at DESC"
            ).fetchall()
        return [
            dict(id=r[0], name=r[1], settings=json.loads(r[2]), snapshot_id=r[3], created_at=r[4])
            for r in rows
        ]

    def save_scenario(self, name, settings):
        dataset = self.load()
        sid = uuid.uuid4().hex
        with self.connect() as db:
            db.execute(
                "INSERT INTO scenarios VALUES (?,?,?,?,?)",
                (
                    sid,
                    name,
                    json.dumps(settings, allow_nan=False),
                    dataset["metadata"]["snapshot_id"] if dataset else None,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        return next(s for s in self.scenarios() if s["id"] == sid)

    def delete_scenario(self, sid):
        with self.connect() as db:
            db.execute("DELETE FROM scenarios WHERE id=?", (sid,))
