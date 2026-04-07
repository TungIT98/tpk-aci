"""
video_studio_app/team_features.py
==================================
Team collaboration layer — user profiles, task assignments, and role-based
permissions for the video studio.

Persisted to team_db.json.

Public API:
  UserProfile        — dataclass: name, role, assigned_tasks
  TaskAssignment     — dataclass: video_id, assigned_to, status, notes
  create_user(name, role)          -> UserProfile
  get_user(user_id)                 -> UserProfile | None
  list_users(role=None)             -> list[UserProfile]
  assign_task(video_id, user_id, note="") -> TaskAssignment
  get_user_tasks(user_id, status=None) -> list[TaskAssignment]
  update_task_status(task_id, status, note=None) -> TaskAssignment
  get_team_stats()                  -> dict
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

TEAM_DB = os.getenv("TEAM_DB", "video_studio_app/team_db.json")

ROLES = {
    "founder":    "Full access to all features and settings",
    "engineer":   "Pipeline, automation, and technical features",
    "producer":   "Video production, scheduling, and upload management",
    "editor":     "Video editing and asset management",
    "analyst":    "Analytics, reporting, and performance tracking",
    "viewer":     "Read-only access to dashboards and reports",
}

TASK_STATUSES = ("todo", "in_progress", "review", "done", "cancelled")


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class UserProfile:
    """Team member profile."""
    user_id: str
    name: str
    role: str
    email: str = ""
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict = field(default_factory=dict)

    @property
    def display_name(self) -> str:
        return f"{self.name} ({self.role})"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> UserProfile:
        return cls(**d)


@dataclass
class TaskAssignment:
    """Task assigned to a user for a specific video."""
    task_id: str
    video_id: str
    assigned_to: str               # user_id
    assigned_by: str = ""          # user_id who created the assignment
    status: str = "todo"           # todo | in_progress | review | done | cancelled
    role: str = ""                 # expected role for this task (e.g. "editor")
    title: str = ""                # short description
    notes: str = ""
    seo_brief_id: str = ""         # link to SEO brief
    priority: int = 0
    due_at: Optional[str] = None   # ISO-8601
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> TaskAssignment:
        return cls(**d)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _load_db() -> dict:
    path = Path(TEAM_DB)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"users": [], "tasks": [], "next_user_id": 1, "next_task_id": 1}


def _save_db(db: dict) -> None:
    path = Path(TEAM_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(path))


def _find_user(db: dict, user_id: str) -> tuple[int, dict] | tuple[None, None]:
    for i, u in enumerate(db["users"]):
        if u["user_id"] == user_id:
            return i, u
    return None, None


def _find_task(db: dict, task_id: str) -> tuple[int, dict] | tuple[None, None]:
    for i, t in enumerate(db["tasks"]):
        if t["task_id"] == task_id:
            return i, t
    return None, None


# ---------------------------------------------------------------------------
# User API
# ---------------------------------------------------------------------------

def create_user(
    name: str,
    role: str,
    email: str = "",
    created_by: str = "",
    metadata: Optional[dict] = None,
) -> UserProfile:
    """
    Add a new team member.

    Args:
        name:        Display name
        role:        One of ROLES keys
        email:       Optional email address
        created_by:  user_id of the creator (for audit trail)
        metadata:    Extra fields
    """
    if role not in ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of {list(ROLES.keys())}")

    db = _load_db()
    user_id = f"u_{db['next_user_id']:03d}"
    db["next_user_id"] += 1

    user = UserProfile(
        user_id=user_id,
        name=name,
        role=role,
        email=email,
        metadata=metadata or {},
    )
    db["users"].append(asdict(user))
    _save_db(db)
    return user


def get_user(user_id: str) -> Optional[UserProfile]:
    db = _load_db()
    _, entry = _find_user(db, user_id)
    return UserProfile.from_dict(entry) if entry else None


def list_users(role: Optional[str] = None, active_only: bool = True) -> list[UserProfile]:
    db = _load_db()
    results = []
    for entry in db["users"]:
        if active_only and not entry.get("is_active", True):
            continue
        if role and entry["role"] != role:
            continue
        results.append(UserProfile.from_dict(entry))
    return results


def update_user(user_id: str, **fields) -> Optional[UserProfile]:
    """Update user fields (name, role, email, is_active, metadata)."""
    db = _load_db()
    idx, entry = _find_user(db, user_id)
    if entry is None:
        return None
    entry.update(fields)
    _save_db(db)
    return UserProfile.from_dict(entry)


def deactivate_user(user_id: str) -> bool:
    """Soft-delete a user."""
    db = _load_db()
    idx, entry = _find_user(db, user_id)
    if entry is None:
        return False
    entry["is_active"] = False
    _save_db(db)
    return True


# ---------------------------------------------------------------------------
# Task Assignment API
# ---------------------------------------------------------------------------

def assign_task(
    video_id: str,
    assigned_to: str,
    assigned_by: str = "",
    title: str = "",
    role: str = "",
    seo_brief_id: str = "",
    priority: int = 0,
    due_at: Optional[str] = None,
    notes: str = "",
) -> TaskAssignment:
    """
    Assign a video task to a team member.

    Args:
        video_id:     Target video / upload_id
        assigned_to:  user_id of the assignee
        assigned_by:  user_id of the person making the assignment
        title:        Short task description
        role:         Expected role for this task
        seo_brief_id: Link to SEO brief for context
        priority:     Higher = more urgent
        due_at:       ISO-8601 deadline
        notes:        Free-text notes
    """
    db = _load_db()
    # Validate user exists
    _, user_entry = _find_user(db, assigned_to)
    if user_entry is None:
        raise ValueError(f"User '{assigned_to}' not found in team_db.json")

    task_id = f"task_{db['next_task_id']:04d}"
    db["next_task_id"] += 1

    task = TaskAssignment(
        task_id=task_id,
        video_id=video_id,
        assigned_to=assigned_to,
        assigned_by=assigned_by,
        title=title,
        role=role,
        seo_brief_id=seo_brief_id,
        priority=priority,
        due_at=due_at,
        notes=notes,
    )
    db["tasks"].append(asdict(task))
    _save_db(db)
    return task


def get_task(task_id: str) -> Optional[TaskAssignment]:
    db = _load_db()
    _, entry = _find_task(db, task_id)
    return TaskAssignment.from_dict(entry) if entry else None


def get_user_tasks(
    user_id: str,
    status: Optional[str] = None,
    limit: int = 100,
) -> list[TaskAssignment]:
    """
    Return all tasks assigned to a user, optionally filtered by status.
    Sorted: priority desc, then created_at asc.
    """
    db = _load_db()
    results = []
    for entry in db["tasks"]:
        if entry["assigned_to"] != user_id:
            continue
        if status and entry["status"] != status:
            continue
        results.append(TaskAssignment.from_dict(entry))
    results.sort(key=lambda t: (-t.priority, t.created_at))
    return results[:limit]


def get_video_tasks(video_id: str) -> list[TaskAssignment]:
    """Return all tasks for a specific video."""
    db = _load_db()
    results = []
    for entry in db["tasks"]:
        if entry["video_id"] == video_id:
            results.append(TaskAssignment.from_dict(entry))
    results.sort(key=lambda t: t.created_at)
    return results


def update_task_status(
    task_id: str,
    status: str,
    note: Optional[str] = None,
) -> Optional[TaskAssignment]:
    """
    Update task status. Validates status is in TASK_STATUSES.
    Appends to notes if note is provided.
    """
    if status not in TASK_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Must be one of {TASK_STATUSES}")

    db = _load_db()
    idx, entry = _find_task(db, task_id)
    if entry is None:
        return None
    entry["status"] = status
    entry["updated_at"] = datetime.now(timezone.utc).isoformat()
    if note:
        prefix = f"[{datetime.now(timezone.utc).isoformat()[:10]}] "
        entry["notes"] = (entry.get("notes", "") + "\n" + prefix + note).strip()
    _save_db(db)
    return TaskAssignment.from_dict(entry)


def unassign_task(task_id: str) -> bool:
    """Remove a task assignment (marks as cancelled)."""
    db = _load_db()
    idx, entry = _find_task(db, task_id)
    if entry is None:
        return False
    entry["status"] = "cancelled"
    entry["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_db(db)
    return True


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def get_team_stats() -> dict:
    """Return team-level statistics."""
    db = _load_db()
    total_users = len([u for u in db["users"] if u.get("is_active", True)])
    by_role: dict[str, int] = {}
    for u in db["users"]:
        if u.get("is_active", True):
            by_role[u["role"]] = by_role.get(u["role"], 0) + 1

    task_counts = {s: 0 for s in TASK_STATUSES}
    for t in db["tasks"]:
        if t["status"] in task_counts:
            task_counts[t["status"]] += 1

    return {
        "total_users": total_users,
        "by_role": by_role,
        "total_tasks": sum(task_counts.values()),
        "tasks_by_status": task_counts,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Team Features CLI")
    sub = parser.add_subparsers(dest="cmd")

    # Users
    add_user_p = sub.add_parser("add-user", help="Add a team member")
    add_user_p.add_argument("--name", required=True)
    add_user_p.add_argument("--role", required=True, choices=list(ROLES.keys()))
    add_user_p.add_argument("--email", default="")

    list_users_p = sub.add_parser("list-users", help="List team members")
    list_users_p.add_argument("--role", default=None)

    # Tasks
    assign_p = sub.add_parser("assign", help="Assign a task")
    assign_p.add_argument("--video-id", required=True)
    assign_p.add_argument("--user-id", required=True)
    assign_p.add_argument("--title", default="")
    assign_p.add_argument("--role", default="")
    assign_p.add_argument("--priority", type=int, default=0)
    assign_p.add_argument("--due", default=None)

    my_tasks_p = sub.add_parser("my-tasks", help="Show tasks for a user")
    my_tasks_p.add_argument("user_id")
    my_tasks_p.add_argument("--status", default=None)

    update_p = sub.add_parser("update-task", help="Update task status")
    update_p.add_argument("task_id")
    update_p.add_argument("status", choices=list(TASK_STATUSES))
    update_p.add_argument("--note", default=None)

    stats_p = sub.add_parser("stats", help="Team statistics")

    args = parser.parse_args()

    if args.cmd == "add-user":
        u = create_user(args.name, args.role, email=args.email)
        print(f"Created: [{u.user_id}] {u.display_name}")

    elif args.cmd == "list-users":
        users = list_users(role=args.role)
        if not users:
            print("No users found.")
        for u in users:
            print(f"[{u.user_id}] {u.display_name} | {u.email}")

    elif args.cmd == "assign":
        try:
            t = assign_task(
                args.video_id, args.user_id, title=args.title,
                role=args.role, priority=args.priority, due_at=args.due,
            )
            print(f"Assigned: [{t.task_id}] video={t.video_id} → user={t.assigned_to}")
        except ValueError as e:
            print(f"Error: {e}")

    elif args.cmd == "my-tasks":
        tasks = get_user_tasks(args.user_id, status=args.status)
        if not tasks:
            print("No tasks.")
        for t in tasks:
            print(
                f"[{t.task_id}] {t.status:12s} | pri={t.priority} | "
                f"{t.title[:30]} | vid={t.video_id}"
            )

    elif args.cmd == "update-task":
        t = update_task_status(args.task_id, args.status, note=args.note)
        print(f"Updated: [{t.task_id}] → {t.status}" if t else "Task not found.")

    elif args.cmd == "stats":
        s = get_team_stats()
        print(f"Users: {s['total_users']} ({s['by_role']})")
        print(f"Tasks: {s['total_tasks']}")
        for status, count in s["tasks_by_status"].items():
            print(f"  {status}: {count}")

    else:
        parser.print_help()
