#!/usr/bin/env python3
"""Check that the context keeper's required files and key sections exist."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "AGENTS.md": ["Mandatory context recovery", "Required change-tracking and handoff"],
    "README.md": ["Install it safely", "What “auto-tracking” means here"],
    "context/SESSION_HANDOFF.md": ["Next action"],
    "context/PROJECT_OVERVIEW.md": ["Purpose"],
    "context/REQUIREMENTS.md": ["Status vocabulary"],
    "context/ARCHITECTURE.md": ["Evidence status at bootstrap"],
    "context/WORK_STATE.md": ["Active work", "Blockers / unknowns"],
    "context/DECISIONS.md": ["D-001"],
    "context/SECURITY_AND_PRIVACY.md": ["Identity and authorization"],
    "context/SESSION_LOG.md": ["Session Log"],
    "context/AUTO_STATE.md": ["Automatically Generated Repository Snapshot"],
    "context/CONTEXT_INDEX.md": ["Read order at session start"],
    "context/PROMPT_COMPLETENESS.md": ["RTCCO + proof"],
    "context/DEVELOPMENT_SEQUENCE.md": ["Repository audit", "release"],
    "scripts/context_sync.py": ["def collect()", "def main()"],
    "scripts/context_watch.py": ["def main()", "Press Ctrl+C to stop"],
    "FIRST_RUN_PROMPT.txt": ["TASK:", "ACCEPTANCE:"],
    "NEXT_SESSION_PROMPT.txt": ["HANDOFF:"],
}

def main() -> int:
    errors = []
    for rel, needles in REQUIRED.items():
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"MISSING: {rel}")
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except OSError as e:
            errors.append(f"UNREADABLE: {rel}: {e}")
            continue
        for needle in needles:
            if needle not in content:
                errors.append(f"MISSING SECTION/TEXT: {rel} -> {needle!r}")
    if errors:
        print("CONTEXT VALIDATION FAILED")
        for e in errors:
            print(f"- {e}")
        return 1
    print(f"CONTEXT VALIDATION PASS: {len(REQUIRED)} required files and key sections found.")
    print("Note: structural validation does not verify the truth of application claims or the correctness of the app.")
    snap = ROOT / "context" / "AUTO_STATE.md"
    if snap.exists() and "Snapshot not yet generated in the target repository" in snap.read_text(encoding="utf-8"):
        print("WARNING: AUTO_STATE.md is still the starter placeholder; run `python scripts/context_sync.py`.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
