"""Render videos with ffmpeg from still images and narration audio.

Expected default structure per video:
  videos/<video_id>/
    images/                # slide images (jpg/jpeg/png/webp), ordered by filename
    narration.wav          # narration audio (any ffmpeg-supported format)
    output/final.mp4       # render target (created)

Usage:
  python tools/render.py --video-id quick_tips-cold-email-hooks
  python tools/render.py --video-id quick_tips-cold-email-hooks --audio voiceover.mp3
"""

from __future__ import annotations

import argparse
import shlex
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile

from utils import project_root

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, check=True, text=True, capture_output=True)
    except FileNotFoundError as exc:
        binary = command[0] if command else "<unknown>"
        raise RuntimeError(f"Required binary not found: {binary}") from exc


def audio_duration_seconds(audio_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    result = run_command(command)
    return float(result.stdout.strip())


def build_concat_manifest(image_paths: list[Path], seconds_per_image: float) -> str:
    lines: list[str] = []

    for image_path in image_paths[:-1]:
        lines.append(f"file {shlex.quote(str(image_path))}")
        lines.append(f"duration {seconds_per_image:.6f}")

    lines.append(f"file {shlex.quote(str(image_paths[-1]))}")
    lines.append(f"duration {seconds_per_image:.6f}")
    lines.append(f"file {shlex.quote(str(image_paths[-1]))}")

    return "\n".join(lines) + "\n"


def render(video_id: str, images_dir_name: str, audio_name: str, output_name: str) -> Path:
    root = project_root()
    video_dir = root / "videos" / video_id

    if not video_dir.exists():
        raise FileNotFoundError(f"Video folder does not exist: {video_dir}")

    images_dir = video_dir / images_dir_name
    if not images_dir.exists():
        raise FileNotFoundError(f"Images directory does not exist: {images_dir}")

    image_paths = sorted(
        path for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    if not image_paths:
        raise FileNotFoundError(f"No images found in {images_dir} (supported: {sorted(IMAGE_EXTENSIONS)})")

    audio_path = video_dir / audio_name
    if not audio_path.exists():
        raise FileNotFoundError(f"Narration audio file not found: {audio_path}")

    output_path = video_dir / output_name
    output_path.parent.mkdir(parents=True, exist_ok=True)

    duration = audio_duration_seconds(audio_path)
    seconds_per_image = max(duration / len(image_paths), 0.1)

    manifest_content = build_concat_manifest(image_paths, seconds_per_image)
    with NamedTemporaryFile("w", suffix=".txt", delete=False) as manifest:
        manifest.write(manifest_content)
        manifest_path = Path(manifest.name)

    ffmpeg_command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(manifest_path),
        "-i",
        str(audio_path),
        "-vf",
        "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(output_path),
    ]

    try:
        run_command(ffmpeg_command)
    finally:
        manifest_path.unlink(missing_ok=True)

    return output_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Render outreach videos with ffmpeg")
    parser.add_argument("--video-id", required=True, help="Folder name under videos/")
    parser.add_argument("--images-dir", default="images", help="Relative images folder inside video folder")
    parser.add_argument("--audio", default="narration.wav", help="Relative audio file inside video folder")
    parser.add_argument("--output", default="output/final.mp4", help="Relative output video path inside video folder")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        output_path = render(
            video_id=args.video_id,
            images_dir_name=args.images_dir,
            audio_name=args.audio,
            output_name=args.output,
        )
    except (FileNotFoundError, RuntimeError, subprocess.CalledProcessError) as exc:
        parser.exit(status=1, message=f"Error: {exc}\n")

    print(f"Rendered: {output_path}")


if __name__ == "__main__":
    main()
