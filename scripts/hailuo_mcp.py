#!/usr/bin/env python3
"""
Hailuo Video Generation MCP Server
Tích hợp MiniMax Hailuo API vào Paperclip agents

Usage:
    python hailuo_mcp.py generate --prompt "A warrior walking" --duration 6 --resolution 720P

API Docs: https://platform.minimaxi.com/docs/api-reference/video-generation-t2v
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# Load .env
ENV_PATH = Path(__file__).parent.parent / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            os.environ[k] = v

MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_BASE_URL = os.environ.get("HAILUO_API_HOST", "https://api.minimax.com")

def generate_video(prompt: str, duration: int = 6, resolution: str = "720P",
                   model: str = "MiniMax-Hailuo-2.3", prompt_optimizer: bool = True,
                   callback_url: str = "") -> dict:
    """Generate video using Hailuo/MiniMax API"""

    if not MINIMAX_API_KEY:
        return {"error": "MINIMAX_API_KEY not found in .env"}

    url = f"{MINIMAX_BASE_URL}/v1/video_generation"

    payload = {
        "model": model,
        "prompt": prompt,
        "prompt_optimizer": prompt_optimizer,
        "duration": duration,
        "resolution": resolution,
    }

    if callback_url:
        payload["callback_url"] = callback_url

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MINIMAX_API_KEY}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            return {
                "task_id": result.get("task_id"),
                "status": result.get("base_resp", {}).get("status_msg", "success"),
                "status_code": result.get("base_resp", {}).get("status_code", 0)
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return {"error": f"HTTP {e.code}: {error_body}"}
    except Exception as e:
        return {"error": str(e)}


def check_video_status(task_id: str) -> dict:
    """Check video generation status"""

    if not MINIMAX_API_KEY:
        return {"error": "MINIMAX_API_KEY not found"}

    url = f"{MINIMAX_BASE_URL}/v1/video_generation_result?task_id={task_id}"

    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {MINIMAX_API_KEY}"},
        method="GET"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}"}
    except Exception as e:
        return {"error": str(e)}


def list_models() -> list:
    """List available video generation models"""
    return [
        {"id": "MiniMax-Hailuo-2.3", "name": "Hailuo 2.3", "description": "Latest Hailuo model"},
        {"id": "MiniMax-Hailuo-02", "name": "Hailuo 02", "description": "Stable version"},
        {"id": "T2V-01-Director", "name": "T2V Director", "description": "Director mode"},
        {"id": "T2V-01", "name": "T2V Standard", "description": "Standard text-to-video"},
    ]


def main():
    parser = argparse.ArgumentParser(description="Hailuo Video Generation MCP")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate video")
    gen_parser.add_argument("--prompt", "-p", required=True, help="Video description")
    gen_parser.add_argument("--duration", "-d", type=int, default=6, help="Duration in seconds (1-10)")
    gen_parser.add_argument("--resolution", "-r", default="720P", choices=["720P", "768P", "1080P"])
    gen_parser.add_argument("--model", "-m", default="MiniMax-Hailuo-2.3")
    gen_parser.add_argument("--no-optimizer", action="store_true", help="Disable prompt optimizer")

    # Status command
    status_parser = subparsers.add_parser("status", help="Check video status")
    status_parser.add_argument("--task-id", "-t", required=True, help="Task ID to check")

    # Models command
    subparsers.add_parser("models", help="List available models")

    args = parser.parse_args()

    if args.command == "generate":
        result = generate_video(
            prompt=args.prompt,
            duration=args.duration,
            resolution=args.resolution,
            model=args.model,
            prompt_optimizer=not args.no_optimizer
        )
        print(json.dumps(result, indent=2))

    elif args.command == "status":
        result = check_video_status(args.task_id)
        print(json.dumps(result, indent=2))

    elif args.command == "models":
        print(json.dumps(list_models(), indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
