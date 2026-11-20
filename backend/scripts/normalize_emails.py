"""Lower-case every stored account email, once, after the 2026-11-20 auth fix.

Sign-up now trims and lower-cases emails, and every lookup does the same. Accounts
created before that may still hold mixed-case addresses, which the new lookups cannot
find — so their owners could not sign in until this runs.

Dry run by default: it reports what it would change and writes nothing.

    docker compose exec backend python scripts/normalize_emails.py           # report
    docker compose exec backend python scripts/normalize_emails.py --apply   # write

Two accounts that differ only by case (`Ada@x.com` and `ada@x.com`) are never merged
automatically: each may own projects, and which one the person actually uses is a human
decision. They are reported and left untouched; the script exits non-zero while any
remain. Unverified pending sign-ups with mixed-case emails are simply removed — they
expire within minutes anyway, and the person can sign up again.
"""

import argparse
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from pymongo import MongoClient


def normalize(email: str) -> str:
    return email.strip().lower()


def mask(email: str) -> str:
    """Enough to recognise an account in a terminal, not enough to leak a full address."""
    local, _, domain = email.partition("@")
    return f"{local[:2]}***@{domain}"


@dataclass(frozen=True)
class Plan:
    updates: list[tuple[Any, str, str]] = field(default_factory=list)  # (id, old, new)
    conflicts: dict[str, list[str]] = field(default_factory=dict)  # normalized -> originals


def plan_user_changes(users: list[dict[str, Any]]) -> Plan:
    """Decide which accounts can be lower-cased safely and which collide."""
    by_normalized: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for user in users:
        by_normalized[normalize(user["email"])].append(user)

    updates: list[tuple[Any, str, str]] = []
    conflicts: dict[str, list[str]] = {}
    for normalized, group in by_normalized.items():
        if len(group) > 1:
            conflicts[normalized] = sorted(user["email"] for user in group)
            continue
        (user,) = group
        if user["email"] != normalized:
            updates.append((user["_id"], user["email"], normalized))
    return Plan(updates=updates, conflicts=conflicts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--apply", action="store_true", help="write the changes (default: report only)"
    )
    args = parser.parse_args()

    from app.config import settings  # imported late so --help works without a .env

    with MongoClient(settings.mongo_uri) as client:
        db = client[settings.mongo_db]
        plan = plan_user_changes(list(db.users.find({}, {"email": 1})))
        stale_pending = [
            row["_id"]
            for row in db.pending_signups.find({}, {"email": 1})
            if row["email"] != normalize(row["email"])
        ]

        print(f"database: {settings.mongo_db}")
        print(f"accounts to lower-case: {len(plan.updates)}")
        for _, old, new in plan.updates:
            print(f"  {mask(old)} -> {mask(new)}")
        print(f"pending sign-ups to remove: {len(stale_pending)}")
        print(f"conflicting accounts (left untouched): {len(plan.conflicts)}")
        for normalized, originals in plan.conflicts.items():
            print(f"  {mask(normalized)}: {len(originals)} accounts")

        if not args.apply:
            print("dry run: nothing written. Re-run with --apply to write.")
            return 1 if plan.conflicts else 0

        for user_id, old, new in plan.updates:
            # Guarded on the old value, so a concurrent edit is never overwritten.
            db.users.update_one({"_id": user_id, "email": old}, {"$set": {"email": new}})
        if stale_pending:
            db.pending_signups.delete_many({"_id": {"$in": stale_pending}})
        print(f"applied: {len(plan.updates)} account(s), {len(stale_pending)} pending sign-up(s)")
    return 1 if plan.conflicts else 0


if __name__ == "__main__":
    sys.exit(main())
