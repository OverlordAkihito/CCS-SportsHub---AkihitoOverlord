#!/usr/bin/env python3
"""Optional foreground watcher that refreshes AUTO_STATE.md when repository state changes.

Run from any terminal with: python scripts/context_watch.py
It watches repository metadata via context_sync.py, not application semantics. It is intentionally
foreground-only; no OS service, daemon, or persistent background access is installed for you.
"""
from __future__ import annotations
import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYNC = ROOT / "scripts" / "context_sync.py"


def run_sync(check: bool) -> subprocess.CompletedProcess[str]:
    cmd = [sys.executable, str(SYNC)]
    if check:
        cmd.append("--check")
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interval", type=float, default=2.0, help="polling interval in seconds (minimum 0.5; default 2.0)")
    args = parser.parse_args()
    interval = max(0.5, args.interval)

    initial = run_sync(check=False)
    if initial.returncode != 0:
        print(initial.stderr.strip() or initial.stdout.strip() or "Initial context snapshot failed.", file=sys.stderr)
        return initial.returncode
    print(initial.stdout.strip())
    print(f"Watching repository metadata every {interval:g}s. Press Ctrl+C to stop.")
    print("This updates context/AUTO_STATE.md only; the AI must still maintain semantic context and handoff files.")

    try:
        while True:
            time.sleep(interval)
            checked = run_sync(check=True)
            if checked.returncode == 0:
                continue
            updated = run_sync(check=False)
            if updated.returncode == 0:
                print(updated.stdout.strip())
            else:
                msg = updated.stderr.strip() or updated.stdout.strip() or "Context snapshot refresh failed."
                print(msg, file=sys.stderr)
    except KeyboardInterrupt:
        print("Watcher stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
