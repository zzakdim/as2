# outreach_video_swarm

Simple, documented scaffold for planning, scripting, rendering, and tracking outreach videos.

## Folder Overview

- `channel_config/`: channel defaults, constraints, and series definitions.
- `prompts/`: prompt files for writing or automation workflows.
- `templates/`: reusable templates for briefs, research, outlines, scripts, and metadata.
- `assets_common/`: shared music, fonts, logos.
- `videos/`: per-video working folders.
- `metrics/`: exported analytics and KPI snapshots.
- `experiments/`: test log and next test plan.
- `tools/`: lightweight Python scripts for workflow and rendering.

## How to Create a New Video Folder

1. Pick an ID format, e.g. `2026-03-01-cold-email-hook`.
2. Create a folder under `videos/`:

```bash
mkdir -p videos/2026-03-01-cold-email-hook
```

3. Copy templates into that folder:

```bash
cp templates/brief.md videos/2026-03-01-cold-email-hook/
cp templates/sources.md videos/2026-03-01-cold-email-hook/
cp templates/outline.md videos/2026-03-01-cold-email-hook/
cp templates/script.md videos/2026-03-01-cold-email-hook/
cp templates/on_screen.txt videos/2026-03-01-cold-email-hook/
cp templates/metadata.json videos/2026-03-01-cold-email-hook/
```

4. Fill out `brief.md` first, then `sources.md`, then `outline.md`.

## How to Generate a Script from Brief

Recommended sequence:

1. Complete `brief.md` with goal, audience, and key points.
2. Add evidence and links in `sources.md`.
3. Draft structure in `outline.md`.
4. Write `script.md` scene by scene.
5. Extract concise overlay lines into `on_screen.txt`.

Optional helper command:

```bash
python tools/run.py new --series quick_tips --topic cold-email-hooks
```

After writing `brief.md` and `outline.md`, generate metadata:

```bash
python tools/run.py meta quick_tips-cold-email-hooks
```

(Stub command today; extend it later to automate draft generation.)

## How to Render a Video

Current render workflow is a placeholder:

```bash
python tools/render.py --video-id quick_tips-cold-email-hooks
```

- Put slide images in `videos/<video_id>/images/` and narration audio in `videos/<video_id>/narration.wav` (or pass `--images-dir` / `--audio`).
- Output defaults to `videos/<video_id>/output/final.mp4` (override with `--output`).
- Render presets should stay aligned with `channel_config/constraints.yaml`.

## How to Publish to YouTube

1. Ensure `metadata.json` is generated and reviewed.
2. Ensure rendered video exists at `videos/<video_id>/output/final.mp4` (or pass `--video-file`).
3. Obtain an OAuth2 access token with `youtube.upload` scope.
4. Upload with:

```bash
python tools/run.py publish <video_id> --access-token <TOKEN>
```

Optional flags:
- `--video-file output/final.mp4`
- `--category-id 27`

## Metrics Pull (SQLite)

Store daily analytics rows into `metrics/analytics.db`:

```bash
python tools/analytics_pull.py --input metrics/daily_stats.json
```

Input JSON should contain `date` and `rows` (one row per video/platform).
Use `--date YYYY-MM-DD` to override the payload date.

## Experiment Planning

Generate a suggested controlled test plan from recent analytics:

```bash
python tools/experiment_planner.py --window-days 14
```

This reads `metrics/analytics.db` and writes recommendations to `experiments/next_plan.md`.

## Where to Put Outputs

- Final videos: `videos/<video_id>/output/`
- Draft exports: `videos/<video_id>/drafts/`
- Generated thumbnails: `videos/<video_id>/thumbnails/`
- Metrics exports (CSV/JSON/screenshots): `metrics/`

A minimal per-video output structure could be:

```text
videos/<video_id>/
  brief.md
  sources.md
  outline.md
  script.md
  on_screen.txt
  metadata.json
  drafts/
  output/
  thumbnails/
```


## Evolving Swarm Loop (Ollama + OpenClaw, local-first)

Use `tools/swarm.py` to run a multi-agent iteration loop that turns analytics into the next video package.

### 1) Configure swarm

Edit `swarm_config/swarm_config.json`:
- `platform`, `target_duration_seconds`, `tone`
- optional `openclaw.post_plan_command` hook (command template with `{video_id}`)

Example OpenClaw hook:

```json
{
  "openclaw": {
    "post_plan_command": "openclaw run local-render --video {video_id}"
  }
}
```

### 2) Generate next video iteration

```bash
python tools/swarm.py iterate --series quick_tips --topic-focus "cold outreach"
```

If Ollama is not available yet, test the pipeline with:

```bash
python tools/swarm.py iterate --dry-run --series quick_tips --topic-focus "cold outreach"
```

This creates `videos/<video_id>/` and fills:
- `brief.md` (goal, key points, style mutation, analytics rationale)
- `outline.md`
- `script.md`
- `on_screen.txt`
- `metadata.json`
- `human_review.md` (upload gate)

### 3) Human upload gate

After manual review/upload decision, record status:

```bash
python tools/swarm.py review <video_id> --decision approved
```

(or `--decision rejected`).

### 4) Continuous adaptation loop

1. Pull latest analytics into sqlite (`tools/analytics_pull.py`).
2. Run `tools/swarm.py iterate ...` for next concept + style mutation.
3. Human checks/approves upload (`tools/swarm.py review ...`).
4. Periodically update mutation memory with:

```bash
python tools/swarm.py learn --window-days 30
```

5. Inspect swarm memory/queue health with:

```bash
python tools/swarm.py status
python tools/swarm.py status --json
```

6. Publish and collect analytics.
7. Repeat.

### 5) One-command local swarm test (no Ollama required)

To test the full evolving loop end-to-end on your machine (generation -> review -> analytics -> learning):

```bash
python tools/swarm.py simulate --cycles 3 --series quick_tips --topic-focus "cold outreach" --seed 42
```

What this does locally:
- generates 3 video packages using deterministic dry-run planning
- alternates human review decisions (approved/rejected) unless `--approve-all`
- writes synthetic analytics rows into `metrics/analytics.db`
- updates style genome via `learn`

After simulation, inspect:

```bash
python tools/swarm.py status
python tools/swarm.py status --json
cat swarm_state/style_genome.json
```

### Swarm state files

`tools/swarm.py` now stores evolving memory in:
- `swarm_state/iterations.jsonl` (event log: generated/reviewed/learned)
- `swarm_state/style_genome.json` (preferred/blocked mutation dimensions)
- `videos/<video_id>/swarm_manifest.json` (per-iteration snapshot + review status)
