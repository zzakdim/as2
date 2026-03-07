"""Local-first evolving video swarm orchestrator.

Turns analytics into the next video concept/script package with a required human review
gate before upload.

Commands:
- iterate: generate next package from analytics + memory
- review: record approved/rejected decision for a video
- status: inspect swarm memory (recent iterations + approvals)
- learn: update style genome from review outcomes and analytics
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sqlite3
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error, request

from run import TEMPLATE_FILES
from utils import project_root
from analytics_pull import ensure_schema, upsert_rows

REQUIRED_PLAN_KEYS = {
    "video_slug",
    "working_title",
    "hook",
    "goal",
    "core_message",
    "key_points",
    "style_mutation",
    "script_scenes",
    "cta",
    "analytics_rationale",
}


@dataclass
class AnalyticsSummary:
    rows: int
    avg_views: float
    avg_ctr: float
    avg_avd: float
    top_videos: list[str]
    weak_videos: list[str]


@dataclass
class SwarmPaths:
    state_dir: Path
    iterations_jsonl: Path
    style_genome_json: Path


def utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def default_db_path() -> Path:
    return project_root() / "metrics" / "analytics.db"


def get_swarm_paths() -> SwarmPaths:
    state = project_root() / "swarm_state"
    state.mkdir(parents=True, exist_ok=True)
    return SwarmPaths(
        state_dir=state,
        iterations_jsonl=state / "iterations.jsonl",
        style_genome_json=state / "style_genome.json",
    )


def load_swarm_config(path: Path | None) -> dict[str, Any]:
    cfg_path = path or (project_root() / "swarm_config" / "swarm_config.json")
    if not cfg_path.exists():
        raise FileNotFoundError(f"Swarm config not found: {cfg_path}")
    with cfg_path.open("r", encoding="utf-8") as handle:
        cfg = json.load(handle)
    return cfg


def load_style_genome() -> dict[str, Any]:
    paths = get_swarm_paths()
    if not paths.style_genome_json.exists():
        base = {
            "updated_at": utc_now_iso(),
            "preferred_mutation_dimensions": ["hook_structure", "pacing", "story_format"],
            "blocked_mutation_dimensions": [],
            "notes": "Initial genome. Run `python tools/swarm.py learn` after review cycles.",
        }
        paths.style_genome_json.write_text(json.dumps(base, indent=2) + "\n", encoding="utf-8")
        return base

    with paths.style_genome_json.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def append_iteration_event(event: dict[str, Any]) -> None:
    paths = get_swarm_paths()
    with paths.iterations_jsonl.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")


def load_iteration_events(limit: int = 300) -> list[dict[str, Any]]:
    paths = get_swarm_paths()
    if not paths.iterations_jsonl.exists():
        return []
    lines = paths.iterations_jsonl.read_text(encoding="utf-8").splitlines()
    rows = []
    for line in lines[-limit:]:
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            rows.append(parsed)
    return rows


def fetch_analytics_summary(db_path: Path, window_days: int) -> AnalyticsSummary:
    if not db_path.exists():
        return AnalyticsSummary(0, 0.0, 0.0, 0.0, [], [])

    with sqlite3.connect(db_path) as connection:
        base = connection.execute(
            """
            SELECT
                COUNT(*) AS row_count,
                COALESCE(AVG(views), 0),
                COALESCE(AVG(ctr), 0),
                COALESCE(AVG(avg_view_duration_seconds), 0)
            FROM daily_video_stats
            WHERE date >= date('now', ?)
            """,
            (f"-{window_days} day",),
        ).fetchone()

        top = connection.execute(
            """
            SELECT video_id
            FROM daily_video_stats
            WHERE date >= date('now', ?)
            GROUP BY video_id
            ORDER BY AVG(views) DESC
            LIMIT 3
            """,
            (f"-{window_days} day",),
        ).fetchall()

        weak = connection.execute(
            """
            SELECT video_id
            FROM daily_video_stats
            WHERE date >= date('now', ?)
            GROUP BY video_id
            ORDER BY AVG(ctr) ASC, AVG(avg_view_duration_seconds) ASC
            LIMIT 3
            """,
            (f"-{window_days} day",),
        ).fetchall()

    return AnalyticsSummary(
        rows=int(base[0] or 0),
        avg_views=float(base[1] or 0),
        avg_ctr=float(base[2] or 0),
        avg_avd=float(base[3] or 0),
        top_videos=[row[0] for row in top],
        weak_videos=[row[0] for row in weak],
    )


def summarize_recent_decisions(events: list[dict[str, Any]], limit: int = 8) -> str:
    reviewed = [e for e in events if e.get("event") == "reviewed"][-limit:]
    if not reviewed:
        return "No prior human review outcomes yet."
    parts = [f"{r.get('video_id','?')}={r.get('decision','pending')}" for r in reviewed]
    return ", ".join(parts)


def build_prompt(
    series: str,
    topic_focus: str,
    analytics: AnalyticsSummary,
    cfg: dict[str, Any],
    style_genome: dict[str, Any],
    decision_summary: str,
) -> str:
    return f"""
You are a multi-agent video swarm coordinator.

Return ONLY valid JSON with keys:
- video_slug (kebab-case)
- working_title
- hook
- goal
- core_message
- key_points (array of max 3 strings)
- style_mutation
- script_scenes (array of objects with: scene, narration, on_screen)
- cta
- analytics_rationale

Constraints:
- Platform: {cfg.get('platform', 'youtube')}
- Duration target seconds: {cfg.get('target_duration_seconds', 90)}
- Tone: {cfg.get('tone', 'clear, practical')}
- Topic focus: {topic_focus}
- Series: {series}
- Mutation dimensions to prefer: {style_genome.get('preferred_mutation_dimensions', [])}
- Mutation dimensions to avoid: {style_genome.get('blocked_mutation_dimensions', [])}

Recent analytics summary:
- Rows: {analytics.rows}
- Avg views: {analytics.avg_views:.2f}
- Avg ctr: {analytics.avg_ctr:.4f}
- Avg avd seconds: {analytics.avg_avd:.2f}
- Top videos: {', '.join(analytics.top_videos) if analytics.top_videos else 'n/a'}
- Weak videos: {', '.join(analytics.weak_videos) if analytics.weak_videos else 'n/a'}

Human decision history (latest): {decision_summary}

Design the NEXT video idea that preserves winning topic angle but mutates ONE style dimension.
""".strip()


def call_ollama(model: str, prompt: str, ollama_url: str, timeout_s: int = 90) -> str:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.6},
    }

    endpoint = ollama_url.rstrip("/") + "/api/chat"
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with request.urlopen(req, timeout=timeout_s) as response:
        body = json.loads(response.read().decode("utf-8"))

    content = body.get("message", {}).get("content", "")
    if not content:
        raise ValueError("Empty response content from Ollama")
    return content


def extract_json(text: str) -> dict[str, Any]:
    candidate = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", candidate, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)

    try:
        obj = json.loads(candidate)
    except json.JSONDecodeError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise
        obj = json.loads(candidate[start : end + 1])

    if not isinstance(obj, dict):
        raise ValueError("Model output JSON must be an object")
    return obj


def validate_plan(plan: dict[str, Any]) -> dict[str, Any]:
    missing = sorted(REQUIRED_PLAN_KEYS.difference(plan.keys()))
    if missing:
        raise ValueError(f"Model output missing required keys: {', '.join(missing)}")
    if not isinstance(plan.get("key_points"), list):
        raise ValueError("'key_points' must be a list")
    if not isinstance(plan.get("script_scenes"), list):
        raise ValueError("'script_scenes' must be a list")
    return plan


def create_from_templates(video_id: str) -> Path:
    root = project_root()
    destination = root / "videos" / video_id
    if destination.exists():
        raise FileExistsError(f"Video folder already exists: {destination}")
    destination.mkdir(parents=True, exist_ok=False)

    templates_dir = root / "templates"
    for filename in TEMPLATE_FILES:
        source = templates_dir / filename
        if not source.exists():
            raise FileNotFoundError(f"Missing template file: {source}")
        destination.joinpath(filename).write_text(source.read_text(encoding="utf-8"), encoding="utf-8")

    return destination


def write_swarm_outputs(video_dir: Path, series: str, plan: dict[str, Any], analytics: AnalyticsSummary) -> None:
    brief = video_dir / "brief.md"
    outline = video_dir / "outline.md"
    script = video_dir / "script.md"
    on_screen = video_dir / "on_screen.txt"
    metadata = video_dir / "metadata.json"
    review = video_dir / "human_review.md"
    manifest = video_dir / "swarm_manifest.json"

    key_points = plan.get("key_points", [])[:3]
    points_block = "\n".join(f"{idx}. {point}" for idx, point in enumerate(key_points, start=1)) or "1. TBD"

    brief.write_text(
        "\n".join(
            [
                "# Video Brief",
                "",
                "## Working Title",
                str(plan.get("working_title", "")),
                "",
                "## Goal",
                str(plan.get("goal", "")),
                "",
                "## Audience",
                "Operators and creators scaling outreach content.",
                "",
                "## Core Message",
                str(plan.get("core_message", "")),
                "",
                "## Key Points (3 max)",
                points_block,
                "",
                "## Style Mutation",
                str(plan.get("style_mutation", "")),
                "",
                "## Analytics Rationale",
                str(plan.get("analytics_rationale", "")),
                f"Current baseline: views={analytics.avg_views:.2f}, ctr={analytics.avg_ctr:.4f}, avd={analytics.avg_avd:.2f}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    hook = str(plan.get("hook", ""))
    cta = str(plan.get("cta", ""))
    outline.write_text(
        "\n".join(
            [
                "# Video Outline",
                "",
                "## Hook (0-10s)",
                hook,
                "",
                "## Body",
                "- Expand each key point with one concrete example.",
                "",
                "## CTA + Close (final 10-15s)",
                cta,
                "",
            ]
        ),
        encoding="utf-8",
    )

    scenes = plan.get("script_scenes", [])
    if not scenes:
        scenes = [
            {"scene": "1", "narration": hook, "on_screen": hook[:70]},
            {"scene": "2", "narration": str(plan.get("core_message", "")), "on_screen": "Core insight"},
            {"scene": "3", "narration": cta, "on_screen": "Follow for next experiment"},
        ]

    script_lines = ["# Script"]
    os_lines: list[str] = []
    for scene in scenes:
        scene_name = str(scene.get("scene", "scene"))
        narration = str(scene.get("narration", "")).strip()
        overlay = str(scene.get("on_screen", "")).strip()
        script_lines.extend(["", f"## Scene {scene_name}", narration])
        if overlay:
            os_lines.append(overlay)

    script.write_text("\n".join(script_lines) + "\n", encoding="utf-8")
    on_screen.write_text("\n".join(os_lines) + "\n", encoding="utf-8")

    metadata.write_text(
        json.dumps(
            {
                "title": plan.get("working_title", ""),
                "description": plan.get("core_message", ""),
                "tags": [series, plan.get("video_slug", "")],
                "series_id": series,
                "language": "en",
                "thumbnail_text": hook[:60],
                "publish": {"status": "draft", "scheduled_at": "YYYY-MM-DDTHH:MM:SSZ"},
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    review.write_text(
        "\n".join(
            [
                "# Human Upload Review",
                "",
                "Status: pending",
                "",
                "## Checklist",
                "- [ ] Claims fact-checked",
                "- [ ] Brand/tone approved",
                "- [ ] No policy violations",
                "- [ ] Thumbnail/title coherent",
                "",
                "## Decision",
                "Set via: `python tools/swarm.py review <video_id> --decision approved`",
                "",
            ]
        ),
        encoding="utf-8",
    )

    manifest.write_text(
        json.dumps(
            {
                "generated_at": utc_now_iso(),
                "video_id": video_dir.name,
                "working_title": plan.get("working_title", ""),
                "style_mutation": plan.get("style_mutation", ""),
                "analytics_snapshot": {
                    "rows": analytics.rows,
                    "avg_views": analytics.avg_views,
                    "avg_ctr": analytics.avg_ctr,
                    "avg_avd": analytics.avg_avd,
                    "top_videos": analytics.top_videos,
                    "weak_videos": analytics.weak_videos,
                },
                "review_status": "pending",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def run_openclaw_hook(command: str | None, video_id: str, workdir: Path) -> None:
    if not command:
        return
    rendered = command.replace("{video_id}", video_id)
    subprocess.run(rendered, shell=True, cwd=workdir, check=True)


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "next-video"


def iterate(args: argparse.Namespace) -> Path:
    cfg = load_swarm_config(Path(args.config) if args.config else None)
    analytics = fetch_analytics_summary(Path(args.db), args.window_days)
    style_genome = load_style_genome()
    events = load_iteration_events(limit=300)
    decision_summary = summarize_recent_decisions(events)

    plan: dict[str, Any]
    if args.dry_run:
        plan = {
            "video_slug": f"{_safe_slug(args.topic_focus)}-mutation",
            "working_title": f"{args.topic_focus.title()} That Actually Converts",
            "hook": "Your last 5 videos are leaking retention in the first 8 seconds.",
            "goal": "Increase CTR and 30-second retention with one controlled style mutation.",
            "core_message": "Use one narrative format change while preserving the proven topic angle.",
            "key_points": [
                "Open with measurable pain",
                "Demo one tactical fix",
                "Close with micro-commitment CTA",
            ],
            "style_mutation": "Switch from listicle pacing to before/after storytelling.",
            "script_scenes": [],
            "cta": "Comment your current bottleneck and we will test it next.",
            "analytics_rationale": "Low CTR and AVD suggest stronger hook clarity is needed.",
        }
    else:
        prompt = build_prompt(args.series, args.topic_focus, analytics, cfg, style_genome, decision_summary)
        raw = call_ollama(args.model, prompt, args.ollama_url, timeout_s=args.timeout_s)
        plan = extract_json(raw)

    plan = validate_plan(plan)

    now = datetime.utcnow().strftime("%Y%m%d")
    slug = _safe_slug(str(plan.get("video_slug", "next-video")))
    base_video_id = f"{args.series}-{slug}-{now}"
    video_id = base_video_id
    videos_root = project_root() / "videos"
    counter = 2
    while (videos_root / video_id).exists():
        video_id = f"{base_video_id}-{counter}"
        counter += 1

    video_dir = create_from_templates(video_id)
    write_swarm_outputs(video_dir, args.series, plan, analytics)
    run_openclaw_hook(cfg.get("openclaw", {}).get("post_plan_command"), video_id, project_root())

    append_iteration_event(
        {
            "event": "generated",
            "at": utc_now_iso(),
            "video_id": video_id,
            "series": args.series,
            "topic_focus": args.topic_focus,
            "style_mutation": plan.get("style_mutation", ""),
            "avg_ctr": analytics.avg_ctr,
            "avg_avd": analytics.avg_avd,
        }
    )
    return video_dir


def _record_synthetic_analytics(video_id: str, db_path: Path, seed: int | None = None) -> dict[str, float]:
    rng = random.Random(seed)
    views = rng.randint(200, 2500)
    ctr = round(rng.uniform(0.02, 0.11), 4)
    avd = round(rng.uniform(12, 68), 2)
    watch_time_minutes = round((views * avd) / 60.0, 2)

    rows = [
        (
            datetime.utcnow().date().isoformat(),
            video_id,
            "youtube",
            views,
            watch_time_minutes,
            avd,
            ctr,
            rng.randint(3, 120),
            rng.randint(0, 30),
            rng.randint(0, 25),
            rng.randint(0, 18),
        )
    ]

    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        ensure_schema(connection)
        upsert_rows(connection, rows)
        connection.commit()

    return {
        "views": float(views),
        "ctr": ctr,
        "avg_view_duration_seconds": avd,
    }


def simulate(args: argparse.Namespace) -> list[str]:
    run_ids: list[str] = []
    db = Path(args.db)

    for index in range(args.cycles):
        iteration_args = argparse.Namespace(
            series=args.series,
            topic_focus=args.topic_focus,
            db=str(db),
            window_days=args.window_days,
            config=args.config,
            model=args.model,
            ollama_url=args.ollama_url,
            timeout_s=args.timeout_s,
            dry_run=True,
        )
        created = iterate(iteration_args)
        video_id = created.name
        run_ids.append(video_id)

        decision = "approved" if (index % 2 == 0 or args.approve_all) else "rejected"
        review_video(video_id, decision)
        metrics = _record_synthetic_analytics(video_id, db, seed=args.seed + index if args.seed is not None else None)

        append_iteration_event(
            {
                "event": "simulated_metrics",
                "at": utc_now_iso(),
                "video_id": video_id,
                "decision": decision,
                **metrics,
            }
        )

    learn_from_feedback(db, args.window_days)
    return run_ids


def _update_manifest_review(video_id: str, decision: str) -> None:
    manifest = project_root() / "videos" / video_id / "swarm_manifest.json"
    if not manifest.exists():
        return
    data = json.loads(manifest.read_text(encoding="utf-8"))
    data["review_status"] = decision
    data["reviewed_at"] = utc_now_iso()
    manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def review_video(video_id: str, decision: str) -> Path:
    target = project_root() / "videos" / video_id / "human_review.md"
    if not target.exists():
        raise FileNotFoundError(f"human_review.md not found: {target}")

    text = target.read_text(encoding="utf-8")
    text = re.sub(r"^Status:\s*.*$", f"Status: {decision}", text, flags=re.MULTILINE)
    text += f"\nReviewed at: {utc_now_iso()}\n"
    target.write_text(text, encoding="utf-8")

    _update_manifest_review(video_id, decision)
    append_iteration_event({"event": "reviewed", "at": utc_now_iso(), "video_id": video_id, "decision": decision})
    return target


def learn_from_feedback(db_path: Path, window_days: int) -> Path:
    events = load_iteration_events(limit=2000)
    approved = [e for e in events if e.get("event") == "reviewed" and e.get("decision") == "approved"]
    rejected = [e for e in events if e.get("event") == "reviewed" and e.get("decision") == "rejected"]
    analytics = fetch_analytics_summary(db_path, window_days)

    prefer = ["hook_structure", "pacing", "story_format"]
    block = []
    if len(rejected) > len(approved):
        block.append("extreme_style_shift")
    if analytics.avg_ctr < 0.03 and "thumbnail_positioning" not in prefer:
        prefer.append("thumbnail_positioning")
    if analytics.avg_avd < 20 and "open_loop_tease" not in prefer:
        prefer.append("open_loop_tease")

    genome = {
        "updated_at": utc_now_iso(),
        "approved_count": len(approved),
        "rejected_count": len(rejected),
        "avg_ctr": analytics.avg_ctr,
        "avg_avd": analytics.avg_avd,
        "preferred_mutation_dimensions": prefer,
        "blocked_mutation_dimensions": block,
        "notes": "Heuristic update. Replace with model-based learner if needed.",
    }

    paths = get_swarm_paths()
    paths.style_genome_json.write_text(json.dumps(genome, indent=2) + "\n", encoding="utf-8")
    append_iteration_event({"event": "learned", "at": utc_now_iso(), "genome": genome})
    return paths.style_genome_json


def show_status() -> str:
    events = load_iteration_events(limit=500)
    generated = [e for e in events if e.get("event") == "generated"]
    reviewed = [e for e in events if e.get("event") == "reviewed"]
    approved = [e for e in reviewed if e.get("decision") == "approved"]
    rejected = [e for e in reviewed if e.get("decision") == "rejected"]
    pending = len(generated) - len(reviewed)
    last = generated[-1]["video_id"] if generated else "n/a"

    return "\n".join(
        [
            "Swarm status",
            f"- generated: {len(generated)}",
            f"- reviewed: {len(reviewed)}",
            f"- approved: {len(approved)}",
            f"- rejected: {len(rejected)}",
            f"- pending review: {max(pending, 0)}",
            f"- latest generated: {last}",
        ]
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evolving video swarm with local Ollama/OpenClaw hooks")
    subparsers = parser.add_subparsers(dest="command", required=True)

    iterate_parser = subparsers.add_parser("iterate", help="Generate next video package from analytics")
    iterate_parser.add_argument("--series", default="quick_tips", help="Series id")
    iterate_parser.add_argument("--topic-focus", default="outreach automation", help="Primary topic direction")
    iterate_parser.add_argument("--db", default=str(default_db_path()), help="Path to analytics sqlite db")
    iterate_parser.add_argument("--window-days", type=int, default=14, help="Analytics lookback window")
    iterate_parser.add_argument("--config", help="Path to swarm config json")
    iterate_parser.add_argument("--model", default="llama3.1:8b", help="Ollama model")
    iterate_parser.add_argument("--ollama-url", default="http://127.0.0.1:11434", help="Ollama base URL")
    iterate_parser.add_argument("--timeout-s", type=int, default=90, help="Ollama call timeout seconds")
    iterate_parser.add_argument("--dry-run", action="store_true", help="Skip Ollama call and use deterministic sample")

    review_parser = subparsers.add_parser("review", help="Record human decision for upload gate")
    review_parser.add_argument("video_id", help="Video id folder name")
    review_parser.add_argument("--decision", choices=["approved", "rejected"], required=True)

    status_parser = subparsers.add_parser("status", help="Show swarm memory status")
    status_parser.add_argument("--json", action="store_true", help="Output recent events JSON")

    learn_parser = subparsers.add_parser("learn", help="Update style genome from feedback + analytics")
    learn_parser.add_argument("--db", default=str(default_db_path()), help="Path to analytics sqlite db")
    learn_parser.add_argument("--window-days", type=int, default=30, help="Analytics lookback window")

    simulate_parser = subparsers.add_parser(
        "simulate",
        help="Run a fully local dry-run loop (generate/review/analytics/learn) for fast testing",
    )
    simulate_parser.add_argument("--cycles", type=int, default=3, help="Number of iterations to run")
    simulate_parser.add_argument("--series", default="quick_tips", help="Series id")
    simulate_parser.add_argument("--topic-focus", default="outreach automation", help="Primary topic direction")
    simulate_parser.add_argument("--db", default=str(default_db_path()), help="Path to analytics sqlite db")
    simulate_parser.add_argument("--window-days", type=int, default=30, help="Analytics lookback window")
    simulate_parser.add_argument("--config", help="Path to swarm config json")
    simulate_parser.add_argument("--model", default="llama3.1:8b", help="Ollama model")
    simulate_parser.add_argument("--ollama-url", default="http://127.0.0.1:11434", help="Ollama base URL")
    simulate_parser.add_argument("--timeout-s", type=int, default=90, help="Ollama call timeout seconds")
    simulate_parser.add_argument("--seed", type=int, help="Optional seed for deterministic synthetic metrics")
    simulate_parser.add_argument(
        "--approve-all",
        action="store_true",
        help="Set all simulated reviews to approved (default alternates approved/rejected)",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "iterate":
            video_dir = iterate(args)
            print(f"Created swarm iteration: {video_dir}")
        elif args.command == "review":
            review_path = review_video(args.video_id, args.decision)
            print(f"Updated review status: {review_path}")
        elif args.command == "status":
            if args.json:
                print(json.dumps(load_iteration_events(limit=100), indent=2))
            else:
                print(show_status())
        elif args.command == "learn":
            path = learn_from_feedback(Path(args.db), args.window_days)
            print(f"Updated style genome: {path}")
        elif args.command == "simulate":
            if args.cycles < 1:
                parser.exit(status=1, message="Error: --cycles must be >= 1\n")
            run_ids = simulate(args)
            print("Completed simulation cycles:")
            for run_id in run_ids:
                print(f"- {run_id}")
    except (error.URLError, TimeoutError) as exc:
        parser.exit(status=1, message=f"Error: Ollama endpoint unavailable: {exc}\n")
    except Exception as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")


if __name__ == "__main__":
    main()
