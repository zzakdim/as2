"""Suggest controlled experiment variations from analytics in sqlite.

Reads `metrics/analytics.db` (from tools/analytics_pull.py), computes recent baseline
metrics, and writes a concrete plan to `experiments/next_plan.md`.

Usage:
  python tools/experiment_planner.py
  python tools/experiment_planner.py --window-days 14 --limit-videos 20
  python tools/experiment_planner.py --output experiments/next_plan.md
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

from utils import project_root


def default_db_path() -> Path:
    return project_root() / "metrics" / "analytics.db"


def fetch_summary(connection: sqlite3.Connection, window_days: int, limit_videos: int) -> dict:
    stats = connection.execute(
        """
        SELECT
            COUNT(*) AS row_count,
            ROUND(AVG(views), 2) AS avg_views,
            ROUND(AVG(ctr), 4) AS avg_ctr,
            ROUND(AVG(avg_view_duration_seconds), 2) AS avg_avd,
            ROUND(AVG((likes + comments + shares) * 1.0 / NULLIF(views, 0)), 4) AS avg_engagement_rate
        FROM daily_video_stats
        WHERE date >= date('now', ?)
        """,
        (f"-{window_days} day",),
    ).fetchone()

    low_ctr_videos = connection.execute(
        """
        SELECT video_id, ROUND(AVG(views), 2) AS avg_views, ROUND(AVG(ctr), 4) AS avg_ctr
        FROM daily_video_stats
        WHERE date >= date('now', ?)
        GROUP BY video_id
        HAVING AVG(views) >= 30
        ORDER BY avg_ctr ASC
        LIMIT ?
        """,
        (f"-{window_days} day", limit_videos),
    ).fetchall()

    low_retention_videos = connection.execute(
        """
        SELECT video_id, ROUND(AVG(avg_view_duration_seconds), 2) AS avg_avd
        FROM daily_video_stats
        WHERE date >= date('now', ?)
        GROUP BY video_id
        HAVING AVG(views) >= 30
        ORDER BY avg_avd ASC
        LIMIT ?
        """,
        (f"-{window_days} day", limit_videos),
    ).fetchall()

    return {
        "row_count": stats[0] or 0,
        "avg_views": stats[1] or 0,
        "avg_ctr": stats[2] or 0,
        "avg_avd": stats[3] or 0,
        "avg_engagement_rate": stats[4] or 0,
        "low_ctr_videos": low_ctr_videos,
        "low_retention_videos": low_retention_videos,
    }


def suggest_tests(summary: dict) -> list[dict]:
    tests: list[dict] = []

    tests.append(
        {
            "name": "Thumbnail text contrast A/B",
            "why": f"Average CTR is {summary['avg_ctr']:.4f}; improve click-through while keeping topic constant.",
            "change": "Create two thumbnail variants for the same script: Variant A high-contrast 3-word promise, Variant B curiosity question.",
            "success": "Primary: +15% CTR over 7 days with no drop >5% in avg view duration.",
            "control": "Same title, description, publish time window, and audience targeting.",
            "metric": "ctr",
        }
    )

    tests.append(
        {
            "name": "Hook rewrite (first 8 seconds)",
            "why": f"Average view duration is {summary['avg_avd']:.2f}s; strengthen early retention.",
            "change": "Keep body/CTA unchanged. Test one direct pain hook vs one result-first hook in first scene only.",
            "success": "Primary: +20% avg_view_duration_seconds over 7 days.",
            "control": "Same thumbnail, title, and topic.",
            "metric": "avg_view_duration_seconds",
        }
    )

    tests.append(
        {
            "name": "CTA placement test",
            "why": f"Engagement rate baseline is {summary['avg_engagement_rate']:.4f}; optimize for interactions.",
            "change": "Test CTA at 70% timeline versus final 10 seconds while holding script points constant.",
            "success": "Primary: +10% likes+comments+shares per view and no CTR degradation.",
            "control": "Same thumbnail/title and equivalent publish day/time.",
            "metric": "engagement_rate",
        }
    )

    return tests


def write_plan(path: Path, summary: dict, tests: list[dict], window_days: int) -> None:
    low_ctr = ", ".join(row[0] for row in summary["low_ctr_videos"][:3]) or "n/a"
    low_retention = ", ".join(row[0] for row in summary["low_retention_videos"][:3]) or "n/a"

    lines = [
        "# Next Experiment Plan",
        "",
        f"_Auto-generated from metrics/analytics.db using a {window_days}-day window._",
        "",
        "## Current Baseline",
        f"- Rows analyzed: {summary['row_count']}",
        f"- Views (avg): {summary['avg_views']}",
        f"- CTR (avg): {summary['avg_ctr']}",
        f"- Avg view duration (s): {summary['avg_avd']}",
        f"- Engagement rate (avg): {summary['avg_engagement_rate']}",
        "",
        "## Candidates Requiring Attention",
        f"- Lowest CTR videos: {low_ctr}",
        f"- Lowest retention videos: {low_retention}",
        "",
        "## Next 3 Controlled Tests",
    ]

    for index, test in enumerate(tests, start=1):
        lines.extend(
            [
                f"{index}. **{test['name']}**",
                f"   - Why: {test['why']}",
                f"   - Controlled variation: {test['change']}",
                f"   - Keep constant: {test['control']}",
                f"   - Success criteria: {test['success']}",
                f"   - Primary metric: {test['metric']}",
                "",
            ]
        )

    lines.extend(
        [
            "## Prioritization",
            f"- Highest impact test: {tests[0]['name']}",
            f"- Lowest effort test: {tests[2]['name']}",
        ]
    )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Suggest controlled experiment variations from analytics")
    parser.add_argument("--db", default=str(default_db_path()), help="Path to sqlite db (default metrics/analytics.db)")
    parser.add_argument("--window-days", type=int, default=14, help="Lookback window in days")
    parser.add_argument("--limit-videos", type=int, default=10, help="How many videos to inspect for low-performance lists")
    parser.add_argument("--output", default="experiments/next_plan.md", help="Output markdown path (repo-relative or absolute)")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    db = Path(args.db)
    out = Path(args.output)
    if not out.is_absolute():
        out = project_root() / out

    try:
        if not db.exists():
            raise FileNotFoundError(f"Analytics DB not found: {db}")

        with sqlite3.connect(db) as connection:
            summary = fetch_summary(connection, window_days=args.window_days, limit_videos=args.limit_videos)

        if summary["row_count"] == 0:
            raise ValueError("No rows found in selected window; pull analytics first")

        tests = suggest_tests(summary)
        write_plan(out, summary, tests, window_days=args.window_days)
        print(f"Wrote experiment plan: {out}")
    except Exception as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")


if __name__ == "__main__":
    main()
