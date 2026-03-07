import argparse
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import swarm


class SwarmWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        (self.root / "templates").mkdir(parents=True, exist_ok=True)
        (self.root / "swarm_config").mkdir(parents=True, exist_ok=True)

        template_defaults = {
            "brief.md": "# Video Brief\n",
            "sources.md": "# Sources\n",
            "outline.md": "# Video Outline\n",
            "script.md": "# Script\n",
            "on_screen.txt": "",
            "metadata.json": "{}\n",
        }
        for filename, content in template_defaults.items():
            (self.root / "templates" / filename).write_text(content, encoding="utf-8")

        (self.root / "swarm_config" / "swarm_config.json").write_text(
            json.dumps(
                {
                    "platform": "youtube",
                    "target_duration_seconds": 90,
                    "tone": "clear and practical",
                    "openclaw": {"post_plan_command": ""},
                }
            ),
            encoding="utf-8",
        )

        self.original_project_root = swarm.project_root
        swarm.project_root = lambda: self.root

    def tearDown(self) -> None:
        swarm.project_root = self.original_project_root
        self.temp_dir.cleanup()

    def test_validate_plan_requires_keys(self) -> None:
        with self.assertRaises(ValueError):
            swarm.validate_plan({"video_slug": "only-one-key"})

    def test_simulate_runs_end_to_end(self) -> None:
        args = argparse.Namespace(
            cycles=2,
            series="quick_tips",
            topic_focus="cold outreach",
            db=str(self.root / "metrics" / "analytics.db"),
            window_days=30,
            config=str(self.root / "swarm_config" / "swarm_config.json"),
            model="llama3.1:8b",
            ollama_url="http://127.0.0.1:11434",
            timeout_s=30,
            seed=7,
            approve_all=False,
        )

        run_ids = swarm.simulate(args)
        self.assertEqual(len(run_ids), 2)

        for run_id in run_ids:
            video_dir = self.root / "videos" / run_id
            self.assertTrue((video_dir / "brief.md").exists())
            self.assertTrue((video_dir / "human_review.md").exists())
            self.assertTrue((video_dir / "swarm_manifest.json").exists())

        genome_path = self.root / "swarm_state" / "style_genome.json"
        self.assertTrue(genome_path.exists())

        events = swarm.load_iteration_events(limit=100)
        event_types = {event.get("event") for event in events}
        self.assertIn("generated", event_types)
        self.assertIn("reviewed", event_types)
        self.assertIn("simulated_metrics", event_types)
        self.assertIn("learned", event_types)


if __name__ == "__main__":
    unittest.main()
