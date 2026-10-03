import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import migrate_excel as m  # noqa: E402

NOW = "2026-10-03T00:00:00+00:00"


def frame(rows):
    return pd.DataFrame(rows, columns=["Task / Content (EXACT SOURCE TEXT)", "Major Head", "Sub-area",
                                       "Task Type", "Links / URLs (preserved)", "Source Row"])


def test_norm_key_ignores_case_spacing_punctuation():
    assert m.norm_key("  Write LinkedIn   articles!! ") == m.norm_key("write linkedin articles")


def test_duplicates_collapse_to_one_and_keep_every_source_row():
    df = frame([
        ["Plan for GRE", "03 Exams", "GRE", "Action Task", None, 5],
        ["PLAN FOR GRE.", "03 Exams", "GRE", "Action Task", "https://a.example", 9],
        ["Something else", "01 Command", "X", "Goal / Reference", None, 12],
    ])
    tasks, stats = m.build_tasks(df, NOW)
    assert len(tasks) == 2 and stats["removed"] == 1
    gre = next(t for t in tasks if t["title"] == "Plan for GRE")  # first occurrence's wording is kept
    assert gre["sourceRefs"] == ["CONTENT#5", "CONTENT#9"]
    assert gre["links"] == ["https://a.example"]


def test_ids_are_stable_between_runs():
    assert m.stable_id("task", "plan for gre") == m.stable_id("task", "plan for gre")


def test_real_workbook_has_no_duplicate_tasks_or_items():
    seed = Path(__file__).resolve().parents[1] / "data/private/seed.json"
    if not seed.exists():
        return
    data = json.loads(seed.read_text(encoding="utf-8"))
    assert len({t["dedupeKey"] for t in data["tasks"]}) == len(data["tasks"])
    assert len({i["dedupeKey"] for i in data["items"]}) == len(data["items"])
    cat_ids = {c["id"] for c in data["categories"]}
    assert all(t["categoryId"] in cat_ids for t in data["tasks"])
    assert all(i["categoryId"] in cat_ids for i in data["items"])
