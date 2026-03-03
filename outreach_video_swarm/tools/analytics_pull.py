"""Pull/store daily analytics into sqlite metrics/analytics.db.

This tool intentionally keeps the pull step simple and file-driven so it can run
without external dependencies. Provide a JSON payload (e.g. exported from your
analytics source), and it will upsert rows into sqlite.

Expected JSON shape:
{
  "date": "2026-03-01",
  "rows": [
    {
      "video_id": "quick_tips-cold-email-hooks",
      "platform": "youtube",
      "views": 123,
      "watch_time_minutes": 45.2,
      "avg_view_duration_seconds": 21.4,
      "ctr": 0.054,
      "likes": 9,
      "comments": 1,
      "shares": 0,
      "subscribers_gained": 2
    }
  ]
}

Usage:
  python tools/analytics_pull.py --input metrics/daily_stats.json
  python tools/analytics_pull.py --input metrics/daily_stats.json --date 2026-03-01
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date
from pathlib import Path

from utils import project_root


def db_path() -> Path:
    root = project_root()
    metrics_dir = root / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    return metrics_dir / "analytics.db"


def ensure_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_video_stats (
            date TEXT NOT NULL,
            video_id TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'youtube',
            views INTEGER NOT NULL DEFAULT 0,
            watch_time_minutes REAL NOT NULL DEFAULT 0,
            avg_view_duration_seconds REAL NOT NULL DEFAULT 0,
            ctr REAL NOT NULL DEFAULT 0,
            likes INTEGER NOT NULL DEFAULT 0,
            comments INTEGER NOT NULL DEFAULT 0,
            shares INTEGER NOT NULL DEFAULT 0,
            subscribers_gained INTEGER NOT NULL DEFAULT 0,
            pulled_at_utc TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (date, video_id, platform)
        )
        """
    )


def validate_iso_date(value: str) -> str:
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Invalid date '{value}'. Expected YYYY-MM-DD") from exc
    return value


def load_payload(input_path: Path) -> dict:
    if not input_path.exists():
        raise FileNotFoundError(f"Input JSON not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, dict):
        raise ValueError("Input JSON must be an object")

    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise ValueError("Input JSON must include 'rows' as a list")

    return payload


def normalize_row(row: dict, stat_date: str) -> tuple:
    if not isinstance(row, dict):
        raise ValueError(f"Each row must be an object, got: {type(row)}")

    video_id = str(row.get("video_id", "")).strip()
    if not video_id:
        raise ValueError("Row is missing required 'video_id'")

    platform = str(row.get("platform", "youtube")).strip() or "youtube"

    return (
        stat_date,
        video_id,
        platform,
        int(row.get("views", 0)),
        float(row.get("watch_time_minutes", 0)),
        float(row.get("avg_view_duration_seconds", 0)),
        float(row.get("ctr", 0)),
        int(row.get("likes", 0)),
        int(row.get("comments", 0)),
        int(row.get("shares", 0)),
        int(row.get("subscribers_gained", 0)),
    )


def upsert_rows(connection: sqlite3.Connection, rows: list[tuple]) -> int:
    connection.executemany(
        """
        INSERT INTO daily_video_stats (
            date,
            video_id,
            platform,
            views,
            watch_time_minutes,
            avg_view_duration_seconds,
            ctr,
            likes,
            comments,
            shares,
            subscribers_gained
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, video_id, platform) DO UPDATE SET
            views = excluded.views,
            watch_time_minutes = excluded.watch_time_minutes,
            avg_view_duration_seconds = excluded.avg_view_duration_seconds,
            ctr = excluded.ctr,
            likes = excluded.likes,
            comments = excluded.comments,
            shares = excluded.shares,
            subscribers_gained = excluded.subscribers_gained,
            pulled_at_utc = datetime('now')
        """,
        rows,
    )
    return len(rows)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Store daily analytics into metrics/analytics.db")
    parser.add_argument(
        "--input",
        required=True,
        help="Path to JSON input payload containing rows",
    )
    parser.add_argument(
        "--date",
        help="Override stat date YYYY-MM-DD (otherwise uses payload.date or today's UTC date)",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        payload = load_payload(Path(args.input))
        stat_date = args.date or payload.get("date") or date.today().isoformat()
        stat_date = validate_iso_date(stat_date)

        normalized_rows = [normalize_row(row, stat_date) for row in payload["rows"]]

        with sqlite3.connect(db_path()) as connection:
            ensure_schema(connection)
            inserted = upsert_rows(connection, normalized_rows)
            connection.commit()

        print(f"Stored {inserted} rows in {db_path()}")
    except Exception as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")


if __name__ == "__main__":
    main()
