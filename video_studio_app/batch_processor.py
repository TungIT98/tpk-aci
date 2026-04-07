"""
video_studio_app/batch_processor.py
=====================================
Batch processing engine for running multiple video pipeline jobs sequentially
or in parallel, with progress tracking and checkpoint/resume support.

Public API:
  BatchJob          — dataclass: list of (script, template, platforms) items
  BatchProcessor    — runs batch, emits progress
  process_batch(jobs, checkpoint=True, parallel=False) -> BatchResult
  load_checkpoint(batch_id)  -> BatchResult | None
  get_active_batch()         -> BatchInfo | None
"""

from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BATCH_DB = os.getenv("BATCH_DB", "video_studio_app/batch_db.json")
CHECKPOINT_INTERVAL = 1   # save checkpoint every N jobs


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class BatchJobItem:
    """Single item inside a batch job."""
    script_path: str
    template: str
    platforms: list[str]             # e.g. ["youtube", "tiktok"]
    seo_brief_id: Optional[str] = None
    priority: int = 0
    metadata: dict = field(default_factory=dict)


@dataclass
class BatchJob:
    """A batch = list of BatchJobItems."""
    items: list[BatchJobItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "items": [
                {**asdict(item), "metadata": item.metadata}
                for item in self.items
            ]
        }

    @classmethod
    def from_dict(cls, d: dict) -> BatchJob:
        items = [BatchJobItem(**{k: v for k, v in i.items()}) for i in d["items"]]
        return cls(items=items)


@dataclass
class ItemResult:
    """Result of processing one BatchJobItem."""
    script_path: str
    template: str
    platforms: list[str]
    status: str = "pending"      # pending | done | failed | skipped
    job_id: Optional[str] = None   # references job_queue job_id
    video_id: Optional[str] = None
    error: Optional[str] = None
    duration_sec: float = 0.0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BatchResult:
    """Aggregated result for an entire batch run."""
    batch_id: str
    total: int
    done: int = 0
    failed: int = 0
    skipped: int = 0
    results: list[ItemResult] = field(default_factory=list)
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    is_complete: bool = False

    @property
    def progress_pct(self) -> float:
        if self.total == 0:
            return 100.0
        return round((self.done + self.failed + self.skipped) / self.total * 100, 1)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["progress_pct"] = self.progress_pct
        return d


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _load_db() -> dict:
    path = Path(BATCH_DB)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"batches": [], "active_batch_id": None}


def _save_db(db: dict) -> None:
    path = Path(BATCH_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(path))


def _save_checkpoint(result: BatchResult) -> None:
    db = _load_db()
    # Upsert
    for i, b in enumerate(db["batches"]):
        if b["batch_id"] == result.batch_id:
            db["batches"][i] = result.to_dict()
            break
    else:
        db["batches"].append(result.to_dict())
    _save_db(db)


# ---------------------------------------------------------------------------
# Pipeline stub (replace with real pipeline integration)
# ---------------------------------------------------------------------------

def _run_single_pipeline(item: BatchJobItem) -> ItemResult:
    """
    Run the video pipeline for one item.
    This is a stub — replace with the actual video-pipeline.js / Python pipeline call.
    """
    # Import here to avoid circular / optional deps
    try:
        import job_queue
        # Enqueue and wait (simplified — real impl would be async/event-driven)
        j = job_queue.add_job(
            script_path=item.script_path,
            template=item.template,
            platforms=item.platforms,
            priority=item.priority,
            metadata=item.metadata,
        )
        job_queue.mark_processing(j.job_id)
        # Simulate processing time (replace with actual call)
        time.sleep(0.1)
        job_queue.mark_done(j.job_id)
        return ItemResult(
            script_path=item.script_path,
            template=item.template,
            platforms=item.platforms,
            status="done",
            job_id=j.job_id,
            started_at=j.started_at,
            completed_at=datetime.now(timezone.utc).isoformat(),
            duration_sec=0.1,
        )
    except Exception as exc:
        return ItemResult(
            script_path=item.script_path,
            template=item.template,
            platforms=item.platforms,
            status="failed",
            error=str(exc),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def process_batch(
    jobs: BatchJob,
    batch_id: Optional[str] = None,
    checkpoint: bool = True,
    progress_callback=None,   # callable(ItemResult, BatchResult) — called after each item
) -> BatchResult:
    """
    Process all items in a batch sequentially.

    Args:
        jobs:             BatchJob with list of items
        batch_id:         Optional ID; auto-generated if not supplied
        checkpoint:       Save progress to batch_db.json every CHECKPOINT_INTERVAL jobs
        progress_callback: Called after each item with (ItemResult, BatchResult)

    Returns:
        BatchResult with final counts
    """
    if not jobs.items:
        return BatchResult(batch_id="none", total=0, is_complete=True)

    batch_id = batch_id or f"batch_{uuid.uuid4().hex[:8]}"
    result = BatchResult(batch_id=batch_id, total=len(jobs.items))

    db = _load_db()
    db["active_batch_id"] = batch_id
    _save_db(db)

    try:
        for i, item in enumerate(jobs.items):
            ir = _run_single_pipeline(item)
            result.results.append(ir)

            if ir.status == "done":
                result.done += 1
            elif ir.status == "failed":
                result.failed += 1
            else:
                result.skipped += 1

            if checkpoint and (i + 1) % CHECKPOINT_INTERVAL == 0:
                _save_checkpoint(result)

            if progress_callback:
                progress_callback(ir, result)

            print(
                f"[{batch_id}] {i+1}/{result.total} | "
                f"{ir.status:6s} | {item.template} | {item.script_path}"
            )

        result.is_complete = True
        result.completed_at = datetime.now(timezone.utc).isoformat()

    finally:
        if checkpoint:
            _save_checkpoint(result)
        db = _load_db()
        if db.get("active_batch_id") == batch_id:
            db["active_batch_id"] = None
        _save_db(db)

    return result


def get_batch_result(batch_id: str) -> Optional[BatchResult]:
    """Load a saved batch result."""
    db = _load_db()
    for entry in db["batches"]:
        if entry["batch_id"] == batch_id:
            return _dict_to_result(entry)
    return None


def get_all_batches(limit: int = 20) -> list[BatchResult]:
    """Return recent batch results sorted by started_at desc."""
    db = _load_db()
    batches = [_dict_to_result(b) for b in db["batches"]]
    batches.sort(key=lambda b: b.started_at, reverse=True)
    return batches[:limit]


def get_active_batch() -> Optional[BatchResult]:
    """Return the currently running batch, if any."""
    db = _load_db()
    active_id = db.get("active_batch_id")
    if not active_id:
        return None
    return get_batch_result(active_id)


def _dict_to_result(d: dict) -> BatchResult:
    results = [ItemResult(**r) for r in d.get("results", [])]
    return BatchResult(
        batch_id=d["batch_id"],
        total=d["total"],
        done=d.get("done", 0),
        failed=d.get("failed", 0),
        skipped=d.get("skipped", 0),
        results=results,
        started_at=d.get("started_at", ""),
        completed_at=d.get("completed_at"),
        is_complete=d.get("is_complete", False),
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Batch Processor CLI")
    sub = parser.add_subparsers(dest="cmd")

    run_p = sub.add_parser("run", help="Run a batch from a list of SEO briefs")
    run_p.add_argument("--ids", help="Comma-separated SEO brief IDs (e.g. PW-01,PW-02)")
    run_p.add_argument("--template", default="morning-routine")
    run_p.add_argument("--platforms", default="youtube,tiktok")
    run_p.add_argument("--batch-id", default=None)

    status_p = sub.add_parser("status", help="Show status of a batch")
    status_p.add_argument("batch_id", nargs="?", default=None)

    list_p = sub.add_parser("list", help="List recent batches")
    list_p.add_argument("--limit", type=int, default=10)

    args = parser.parse_args()

    if args.cmd == "run":
        if not args.ids:
            print("--ids required (e.g. PW-01,PW-02,GZ-01)")
            raise SystemExit(1)

        # Build BatchJob from SEO brief IDs
        base = Path("content/seo-briefs")
        platforms = [p.strip() for p in args.platforms.split(",")]
        items = []
        for bid in args.ids.split(","):
            bid = bid.strip()
            script = str(base / f"{bid}.md")
            items.append(BatchJobItem(
                script_path=script,
                template=args.template,
                platforms=platforms,
                seo_brief_id=bid,
            ))

        batch = BatchJob(items=items)
        result = process_batch(batch, batch_id=args.batch_id)

        print(
            f"\nBatch complete: {result.batch_id}\n"
            f"  Total:   {result.total}\n"
            f"  Done:    {result.done}\n"
            f"  Failed:  {result.failed}\n"
            f"  Skipped: {result.skipped}\n"
            f"  Progress:{result.progress_pct}%"
        )

    elif args.cmd == "status":
        batch_id = args.batch_id
        if not batch_id:
            active = get_active_batch()
            if active:
                batch_id = active.batch_id
                print(f"Active batch: {batch_id}")
            else:
                print("No active batch.")
                raise SystemExit(0)

        result = get_batch_result(batch_id)
        if not result:
            print(f"Batch '{batch_id}' not found.")
        else:
            print(
                f"\nBatch: {result.batch_id}\n"
                f"  Total:     {result.total}\n"
                f"  Done:      {result.done}\n"
                f"  Failed:    {result.failed}\n"
                f"  Skipped:   {result.skipped}\n"
                f"  Progress:  {result.progress_pct}%\n"
                f"  Complete:  {result.is_complete}\n"
                f"  Started:   {result.started_at}\n"
                f"  Finished:  {result.completed_at or 'in progress'}"
            )

    elif args.cmd == "list":
        batches = get_all_batches(limit=args.limit)
        if not batches:
            print("No batches found.")
        for b in batches:
            print(
                f"[{b.batch_id}] {b.started_at[:10]} | "
                f"{b.done}/{b.total} done | {b.failed} failed | "
                f"{b.progress_pct}% | {'✓' if b.is_complete else '↻'}"
            )

    else:
        parser.print_help()
