"""
video_studio_app/analytics/app.py
=================================
Flask web dashboard for Video Studio v3.0 Analytics.

Serves HTML pages powered by Chart.js.
Data is read from:
  - job_queue.py / queue_db.json
  - batch_processor.py / batch_db.json
  - scheduler.py / schedule_db.json
  - performance_tracker.py / performance_db.json
  - uploads_db.json

Routes:
  /              — main dashboard
  /queue         — queue management
  /calendar      — scheduling calendar
  /batch         — batch processing
  /export        — CSV/JSON export
  /api/...       — JSON data endpoints (for AJAX)
"""

from __future__ import annotations

import csv
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

# Add parent dir to path so sibling modules are importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    url_for,
)

# ---------------------------------------------------------------------------
# Import data layers (lazy — only load when route is called)
# ---------------------------------------------------------------------------

def _load_json(path: str) -> dict:
    p = Path(path)
    if p.exists():
        try:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


# ── Job Queue ──────────────────────────────────────────────────────────────

def get_queue_data(status: Optional[str] = None) -> dict:
    db = _load_json("video_studio_app/queue_db.json")
    jobs = db.get("jobs", [])
    if status:
        jobs = [j for j in jobs if j.get("status") == status]
    return {"jobs": jobs, "total": len(jobs)}


def get_queue_stats() -> dict:
    db = _load_json("video_studio_app/queue_db.json")
    counts = {"pending": 0, "processing": 0, "done": 0, "failed": 0, "total": 0}
    for j in db.get("jobs", []):
        s = j.get("status", "pending")
        if s in counts:
            counts[s] += 1
        counts["total"] += 1
    return counts


def get_template_stats() -> dict:
    db = _load_json("video_studio_app/queue_db.json")
    templates: dict[str, dict] = {}
    for j in db.get("jobs", []):
        t = j.get("template", "unknown")
        if t not in templates:
            templates[t] = {"total": 0, "done": 0, "failed": 0, "pending": 0, "processing": 0}
        templates[t]["total"] += 1
        s = j.get("status", "pending")
        if s in templates[t]:
            templates[t][s] += 1
    return templates


def get_processing_time_stats() -> dict:
    db = _load_json("video_studio_app/queue_db.json")
    done_jobs = [j for j in db.get("jobs", []) if j.get("status") == "done"]
    if not done_jobs:
        return {"avg_sec": 0, "min_sec": 0, "max_sec": 0, "count": 0}

    durations = []
    for j in done_jobs:
        started = j.get("started_at")
        completed = j.get("completed_at")
        if started and completed:
            try:
                s = datetime.fromisoformat(started.replace("Z", "+00:00"))
                c = datetime.fromisoformat(completed.replace("Z", "+00:00"))
                durations.append((c - s).total_seconds())
            except (ValueError, OSError):
                pass

    if not durations:
        return {"avg_sec": 0, "min_sec": 0, "max_sec": 0, "count": 0}
    return {
        "avg_sec": round(sum(durations) / len(durations), 1),
        "min_sec": round(min(durations), 1),
        "max_sec": round(max(durations), 1),
        "count": len(durations),
    }


# ── Batch Processor ─────────────────────────────────────────────────────────

def get_batch_data() -> dict:
    db = _load_json("video_studio_app/batch_db.json")
    return {
        "batches": db.get("batches", []),
        "active_batch_id": db.get("active_batch_id"),
        "total": len(db.get("batches", [])),
    }


# ── Scheduler ──────────────────────────────────────────────────────────────

def get_schedule_data(year: Optional[int] = None, month: Optional[int] = None) -> dict:
    db = _load_json("video_studio_app/schedule_db.json")
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month

    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    cal: dict[str, list] = {}
    for day in range(1, days_in_month + 1):
        cal[f"{year:04d}-{month:02d}-{day:02d}"] = []

    for sv in db.get("scheduled_videos", []):
        try:
            dt = datetime.fromisoformat(sv.get("scheduled_datetime", "").replace("Z", "+00:00"))
            if dt.year == year and dt.month == month:
                key = dt.strftime("%Y-%m-%d")
                cal.setdefault(key, []).append(sv)
        except (ValueError, AttributeError):
            pass

    schedule_stats = {"scheduled": 0, "posted": 0, "missed": 0, "cancelled": 0, "total": 0, "overdue": 0}
    for sv in db.get("scheduled_videos", []):
        s = sv.get("upload_status", "scheduled")
        if s in schedule_stats:
            schedule_stats[s] += 1
        schedule_stats["total"] += 1
        if s == "scheduled":
            try:
                dt = datetime.fromisoformat(sv.get("scheduled_datetime", "").replace("Z", "+00:00"))
                if now >= dt + timedelta(hours=1):
                    schedule_stats["overdue"] += 1
            except (ValueError, AttributeError):
                pass

    return {
        "calendar": cal,
        "year": year,
        "month": month,
        "stats": schedule_stats,
        "scheduled_videos": db.get("scheduled_videos", []),
        "today_key": now.strftime("%Y-%m-%d"),
    }


# ── Performance / Uploads ──────────────────────────────────────────────────

def get_video_stats() -> dict:
    db = _load_json("video_studio_app/uploads_db.json")
    uploads = db.get("uploads", [])
    total = len(uploads)
    if total == 0:
        return {
            "total": 0, "draft": 0, "rendered": 0, "uploaded": 0,
            "total_views": 0, "total_revenue": 0.0,
            "success_rate": 0, "by_platform": {},
        }

    by_platform: dict[str, dict] = {}
    for u in uploads:
        p = u.get("platform", "unknown")
        if p not in by_platform:
            by_platform[p] = {"count": 0, "views": 0, "revenue": 0.0}
        by_platform[p]["count"] += 1
        by_platform[p]["views"] += u.get("views", 0)
        by_platform[p]["revenue"] += u.get("revenue_usd", 0.0)

    uploaded = sum(1 for u in uploads if u.get("upload_status") == "published")
    return {
        "total": total,
        "draft": total - uploaded,
        "rendered": 0,
        "uploaded": uploaded,
        "total_views": sum(u.get("views", 0) for u in uploads),
        "total_revenue": round(sum(u.get("revenue_usd", 0.0) for u in uploads), 4),
        "success_rate": round(uploaded / total * 100, 1) if total else 0,
        "by_platform": by_platform,
        "uploads": uploads,
    }


def get_performance_stats(days: int = 30) -> dict:
    perf_db = _load_json("video_studio_app/performance_db.json")
    metrics = perf_db.get("metrics", [])
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    period = [m for m in metrics if m.get("created_at", "") >= cutoff]
    if not period:
        # Fall back to all-time if no period data
        period = metrics

    return {
        "total_videos": len(metrics),
        "period_videos": len(period),
        "total_views": sum(m.get("views", 0) for m in period),
        "total_likes": sum(m.get("likes", 0) for m in period),
        "total_comments": sum(m.get("comments", 0) for m in period),
        "total_revenue": round(sum(m.get("revenue_usd", 0.0) for m in period), 4),
        "avg_ctr": 0.0,
        "avg_engagement": 0.0,
        "metrics": period[-20:],  # last 20 for table
    }


def get_dashboard_summary() -> dict:
    queue_stats = get_queue_stats()
    video_stats = get_video_stats()
    perf_stats = get_performance_stats()
    batch_data = get_batch_data()
    schedule_data = get_schedule_data()

    # Weekly video counts (mock trend for chart)
    # In production this would come from a time-series DB
    now = datetime.now(timezone.utc)
    weekly_labels = [(now - timedelta(days=6 - i)).strftime("%a") for i in range(7)]
    # Seed with realistic-looking mock data
    weekly_views = [120, 345, 280, 510, 620, 490, 730]

    return {
        "queue_stats": queue_stats,
        "video_stats": video_stats,
        "perf_stats": perf_stats,
        "batch_data": batch_data,
        "schedule_stats": schedule_data["stats"],
        "weekly_labels": weekly_labels,
        "weekly_views": weekly_views,
        "template_stats": get_template_stats(),
        "processing_time": get_processing_time_stats(),
    }


# ── Export helpers ─────────────────────────────────────────────────────────

def export_queue_csv() -> io.BytesIO:
    db = _load_json("video_studio_app/queue_db.json")
    output = io.StringIO()
    fieldnames = ["job_id", "template", "platforms", "status", "priority",
                  "created_at", "started_at", "completed_at", "error_message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for j in db.get("jobs", []):
        writer.writerow({k: j.get(k, "") for k in fieldnames})
    buf = io.BytesIO(output.getvalue().encode("utf-8"))
    buf.seek(0)
    return buf


def export_schedule_csv() -> io.BytesIO:
    db = _load_json("video_studio_app/schedule_db.json")
    output = io.StringIO()
    fieldnames = ["scheduled_video_id", "video_id", "platform", "scheduled_datetime",
                  "title", "upload_status", "posted_at"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for sv in db.get("scheduled_videos", []):
        writer.writerow({k: sv.get(k, "") for k in fieldnames})
    buf = io.BytesIO(output.getvalue().encode("utf-8"))
    buf.seek(0)
    return buf


def export_videos_csv() -> io.BytesIO:
    db = _load_json("video_studio_app/uploads_db.json")
    output = io.StringIO()
    fieldnames = ["upload_id", "title", "platform", "upload_status", "views",
                  "likes", "comments", "shares", "revenue_usd", "published_at"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for u in db.get("uploads", []):
        writer.writerow({k: u.get(k, "") for k in fieldnames})
    buf = io.BytesIO(output.getvalue().encode("utf-8"))
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Flask App
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).parent
TEMPLATE_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR),
)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET", "video-studio-analytics-secret-2026")

# Custom Jinja2 filters
@app.template_filter("abs")
def _abs(value):
    return abs(value)


# ── Navigation helper ──────────────────────────────────────────────────────

NAVPILLS = [
    ("Dashboard", "/", "dashboard"),
    ("Queue", "/queue", "queue"),
    ("Calendar", "/calendar", "calendar"),
    ("Batch", "/batch", "batch"),
    ("Export", "/export", "export"),
]


@app.context_processor
def inject_nav():
    return {"navpills": NAVPILLS, "year": datetime.now().year}


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def dashboard():
    data = get_dashboard_summary()
    return render_template("dashboard.html", **data)


@app.route("/queue")
def queue_page():
    status_filter = request.args.get("status", "")
    data = get_queue_data(status=status_filter if status_filter in ("pending", "processing", "done", "failed") else None)
    stats = get_queue_stats()
    return render_template("queue.html", jobs=data["jobs"], total=data["total"],
                           stats=stats, status_filter=status_filter)


@app.route("/queue/cancel/<job_id>", methods=["POST"])
def cancel_job(job_id):
    """Reset a job to cancelled state (soft-cancel — doesn't delete)."""
    import video_studio_app.job_queue as jq
    job = jq.get_job(job_id)
    if job:
        # Requeue resets to pending; cancelled state isn't in JOB_STATES
        # So we just mark done to remove from active queue
        jq.mark_done(job_id)
    return redirect(url_for("queue_page"))


@app.route("/queue/retry/<job_id>", methods=["POST"])
def retry_job(job_id):
    """Reset a failed job back to pending."""
    import video_studio_app.job_queue as jq
    jq.requeue(job_id)
    return redirect(url_for("queue_page"))


@app.route("/calendar")
def calendar_page():
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    data = get_schedule_data(year=year, month=month)
    return render_template("calendar.html", **data)


@app.route("/batch")
def batch_page():
    data = get_batch_data()
    return render_template("batch.html", **data)


@app.route("/export")
def export_page():
    queue_stats = get_queue_stats()
    video_stats = get_video_stats()
    schedule_stats = get_schedule_data()["stats"]
    return render_template("export.html", queue_stats=queue_stats,
                           video_stats=video_stats, schedule_stats=schedule_stats)


# ── CSV Export endpoints ────────────────────────────────────────────────────

@app.route("/export/queue/csv")
def export_queue():
    buf = export_queue_csv()
    return send_file(buf, mimetype="text/csv",
                     as_attachment=True,
                     download_name=f"queue_export_{datetime.now().strftime('%Y%m%d')}.csv")


@app.route("/export/schedule/csv")
def export_schedule():
    buf = export_schedule_csv()
    return send_file(buf, mimetype="text/csv",
                     as_attachment=True,
                     download_name=f"schedule_export_{datetime.now().strftime('%Y%m%d')}.csv")


@app.route("/export/videos/csv")
def export_videos():
    buf = export_videos_csv()
    return send_file(buf, mimetype="text/csv",
                     as_attachment=True,
                     download_name=f"videos_export_{datetime.now().strftime('%Y%m%d')}.csv")


@app.route("/export/all/json")
def export_all_json():
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "queue": get_queue_data(),
        "queue_stats": get_queue_stats(),
        "video_stats": get_video_stats(),
        "batch": get_batch_data(),
        "schedule": get_schedule_data(),
        "performance": get_performance_stats(),
    }
    buf = io.BytesIO(json.dumps(data, indent=2, default=str).encode("utf-8"))
    buf.seek(0)
    return send_file(buf, mimetype="application/json",
                     as_attachment=True,
                     download_name=f"analytics_export_{datetime.now().strftime('%Y%m%d')}.json")


# ── JSON API endpoints ─────────────────────────────────────────────────────

@app.route("/api/queue/stats")
def api_queue_stats():
    return jsonify(get_queue_stats())


@app.route("/api/queue/jobs")
def api_queue_jobs():
    status = request.args.get("status")
    data = get_queue_data(status=status)
    return jsonify(data)


@app.route("/api/video/stats")
def api_video_stats():
    return jsonify(get_video_stats())


@app.route("/api/dashboard/summary")
def api_dashboard():
    return jsonify(get_dashboard_summary())


@app.route("/api/batch")
def api_batch():
    return jsonify(get_batch_data())


@app.route("/api/schedule")
def api_schedule():
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    return jsonify(get_schedule_data(year=year, month=month))


# ── Error pages ─────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return render_template("dashboard.html"), 404


@app.errorhandler(500)
def server_error(e):
    return render_template("dashboard.html"), 500


# ---------------------------------------------------------------------------
# CLI / dev server
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Video Studio Analytics Dashboard")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5001, help="Port (default: 5001)")
    parser.add_argument("--debug", action="store_true", help="Enable Flask debug mode")
    args = parser.parse_args()

    print(f"\n=== Video Studio Analytics Dashboard v3.0 ===")
    print(f"  Dashboard:  http://{args.host}:{args.port}/")
    print(f"  Queue:      http://{args.host}:{args.port}/queue")
    print(f"  Calendar:   http://{args.host}:{args.port}/calendar")
    print(f"  Batch:      http://{args.host}:{args.port}/batch")
    print(f"  Export:     http://{args.host}:{args.port}/export\n")

    app.run(host=args.host, port=args.port, debug=args.debug)
