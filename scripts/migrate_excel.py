#!/usr/bin/env python3
"""Convert the master Excel workbook into seed.json for the tracker.

Rules
-----
* Every task exists exactly once. Tasks are compared on a normalised key
  (case, spacing and punctuation ignored); the FIRST occurrence is kept and every
  original row is remembered in `sourceRefs`, so nothing is lost.
* Task text is never reworded.
* Output goes to data/private/ (git-ignored) because it holds personal data.

Usage:  python scripts/migrate_excel.py path/to/MASTER_FILE.xlsx
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SCHEMA_VERSION = 1
TASK_SHEET = "CONTENT CATEGORIZED"

PALETTE = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0d9488"]

DISPLAY_NAMES = {
    "GITHUB": "GitHub", "LEETCODE": "LeetCode", "HACKER RANK": "HackerRank", "HACKER EARTH": "HackerEarth",
    "CODECHEF": "CodeChef", "CODESIGNAL": "CodeSignal", "CODEWARS": "Codewars", "TOPCODER": "TopCoder",
    "SUBSTACK": "Substack", "BYTEBYTEGO": "ByteByteGo", "FIGMA": "Figma", "NOTION": "Notion",
    "ACADEMIA": "Academia", "RESEARCH GATE": "ResearchGate", "IEEE": "IEEE", "SCOPUS": "Scopus",
    "ABCD": "ABCD", "ORCID": "ORCID", "SSRN": "SSRN", "JSTOR": "JSTOR", "GOOGLE SCHOLAR": "Google Scholar",
    "SPRINGER": "Springer", "EMERALD": "Emerald", "IGI": "IGI Global", "LAP LAMBERT": "LAP Lambert",
}

# Rows of the COMP & SMP sheet that are social / publishing channels (the rest are company facts).
SOCIAL_ATTRS = [
    "YouTube Main", "YouTube Shorts", "Instagram", "Instagram Reels", "Threads", "X/Twitter",
    "Facebook ID", "Facebook Page", "LinkedIn", "WhatsApp Business", "WhatsApp Channel",
    "Telegram Channel", "Discord", "Medium", "Substack", "Quora", "Newsletter",
]
SENSITIVE_ATTRS = {"PAN", "GST", "CIN", "Bank", "Password Vault"}
PERSONAL_ENTITY = "Atul Pandey"

PLATFORM_STATUS = ["To fill in", "Active", "Needs update", "Inactive"]


# ----------------------------------------------------------------------------- helpers
def norm_key(text: object) -> str:
    """Normalised comparison key. MUST match normaliseKey() in src/db.ts."""
    return re.sub(r"[^a-z0-9]+", " ", str(text).lower()).strip()


def stable_id(prefix: str, key: str) -> str:
    return f"{prefix}_{hashlib.sha1(key.encode('utf-8')).hexdigest()[:10]}"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def clean(value: object) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)) or value is pd.NaT:
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    return text or None


def display_name(raw: str) -> str:
    raw = raw.strip()
    return DISPLAY_NAMES.get(raw.upper(), raw.title())


def field(key: str, label: str, type_: str = "text", **extra) -> dict:
    return {"key": key, "label": label, "type": type_, **extra}


def extract_links(text: str | None) -> list[str]:
    if not text:
        return []
    found = [p for p in re.split(r"[\s;,]+", text) if p.lower().startswith(("http://", "https://", "mailto:"))]
    return list(dict.fromkeys(found))


# ----------------------------------------------------------------------------- categories
def platform_fields() -> list[dict]:
    return [
        field("profile_url", "Profile URL", "url"),
        field("username", "Username / handle"),
        field("status", "Status", "select", options=PLATFORM_STATUS),
        field("last_updated", "Last updated", "date"),
        field("notes", "Notes"),
    ]


def build_categories(taxonomy: pd.DataFrame, comp: pd.DataFrame) -> list[dict]:
    cats: list[dict] = []

    def add(id_: str, name: str, group: str, fields: list[dict], description: str = "", **extra) -> None:
        cats.append({
            "id": id_, "name": name, "group": group, "order": len(cats) + 1,
            "color": PALETTE[len(cats) % len(PALETTE)], "description": description, "fields": fields, **extra,
        })

    add("academic-platforms", "Academic Platforms", "Platforms & Profiles", platform_fields(),
        "Research and academic profiles")
    add("tech-platforms", "Tech Platforms", "Platforms & Profiles", platform_fields(),
        "Coding, design and tech profiles")
    add("personal-social", "Personal Social Media", "Platforms & Profiles",
        platform_fields() + [field("platform", "Platform")], "Your own social accounts")

    add("publications", "Publications", "Publishing & Learning", [
        field("call_link", "Call for paper", "url"),
        field("proposal_deadline", "Proposal deadline", "date"),
        field("full_paper_deadline", "Full paper deadline", "date"),
        field("association", "Association"),
        field("publication_type", "Type"),
        field("priority", "Priority", "select", options=["High", "Medium", "Low"]),
        field("action", "Action"),
        field("status", "Status", "select", options=[
            "Proposal Submitted", "Proposal Accepted", "Full Paper Submitted", "Under Review",
            "Accepted", "Published", "Rejected"]),
        field("status_note", "Status note"),
        field("comments", "Comments"),
        field("reminder", "Reminder", "date"),
    ], "Book chapters, journal papers and calls for papers")
    add("courses", "Courses", "Publishing & Learning", [
        field("status", "Status", "select", options=["Not started", "Ongoing", "Completed", "Paused"]),
        field("start_date", "Start date", "date"), field("end_date", "End date", "date"), field("notes", "Notes"),
    ])
    add("exams", "Exams", "Publishing & Learning", [
        field("exam_date", "Exam date", "date"),
        field("status", "Status", "select", options=[
            "Planned", "Preparing", "Registered", "Appeared", "Result awaited", "Cleared", "Not cleared"]),
        field("notes", "Notes"),
    ])
    add("competitions", "Competitions", "Publishing & Learning", [
        field("organiser", "Organiser / platform"), field("url", "Link", "url"),
        field("registration_deadline", "Registration deadline", "date"), field("event_date", "Event date", "date"),
        field("status", "Status", "select", options=["Spotted", "Registered", "Participating", "Completed", "Skipped"]),
        field("notes", "Notes"),
    ], "Hackathons, contests and challenges (starts empty - add as you find them)")

    company_facts = [
        a for a in comp["Attribute"].dropna().map(str).str.strip()
        if a not in SOCIAL_ATTRS and a != "Notes"
    ]
    company_fields = []
    for attr in company_facts:
        if attr == "Priority":
            company_fields.append(field("priority", attr, "select", options=["High", "Medium", "Low"]))
        elif attr in ("Website", "Primary Domain"):
            company_fields.append(field(slug(attr).replace("-", "_"), attr, "url"))
        else:
            company_fields.append(field(slug(attr).replace("-", "_"), attr, sensitive=attr in SENSITIVE_ATTRS))
    company_fields.append(field("notes", "Notes"))
    add("companies", "Companies", "Companies", company_fields, "Registrations, domains, tools and admin details")
    add("company-social", "Company Social Media", "Companies", [
        field("company", "Company", "relation", relationCategoryId="companies"),
        field("platform", "Platform"),
        field("url", "URL", "url"), field("username", "Username / handle"),
        field("status", "Status", "select", options=PLATFORM_STATUS),
        field("last_updated", "Last updated", "date"), field("notes", "Notes"),
    ], "Every company x platform, so gaps are visible")

    add("emails-newsletters", "Emails & Newsletters", "Records", [
        field("kind", "Kind", "select", options=["Personal email", "Professional email", "Newsletter"]),
        field("notes", "Notes"),
    ])

    for _, row in taxonomy.iterrows():
        head = str(row["Major Head"]).strip()
        m = re.match(r"^(\d{2})\s+(.*)$", head)
        num, name = (m.group(1), m.group(2)) if m else (slug(head), head)
        subs = [s.strip() for s in str(row["Recommended Sub-areas"]).split(";") if s.strip()]
        add(f"head-{num}", name, "Task Heads", [], str(row.get("Portal Use") or ""), subAreas=subs)
    return cats


# ----------------------------------------------------------------------------- structured sheets
def make_item(cat: str, title: str, data: dict, now: str) -> dict:
    data = {k: v for k, v in data.items() if v is not None}
    key = f"{cat}:{norm_key(title)}"
    return {"id": stable_id("item", key), "categoryId": cat, "title": title, "data": data,
            "dedupeKey": key, "createdAt": now, "updatedAt": now}


def platform_items(df: pd.DataFrame, cat: str, now: str) -> list[dict]:
    """Platform grid sheets: platform names across row 1, 'DATE' and 'Links' rows beneath."""
    label_col = df.iloc[:, :2].astype(str).apply(lambda c: c.str.strip().str.lower())
    date_row = next((i for i in range(len(df)) if "date" in label_col.iloc[i].tolist()), None)
    link_row = next((i for i in range(len(df)) if "links" in label_col.iloc[i].tolist()), None)
    items = []
    for j in range(2, df.shape[1]):
        header = clean(df.iat[0, j])
        if not header:
            continue
        url = clean(df.iat[link_row, j]) if link_row is not None else None
        date = clean(df.iat[date_row, j]) if date_row is not None else None
        data = {"profile_url": url if url and url.lower().startswith("http") else None,
                "username": url if url and not url.lower().startswith("http") else None,
                "last_updated": date, "status": "Active" if url else "To fill in"}
        items.append(make_item(cat, display_name(header), data, now))
    return items


MONTH_RE = re.compile(r"by\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)", re.I)


def parse_deadline_text(text: str, year: int) -> str | None:
    m = MONTH_RE.search(text)
    if not m:
        return None
    for fmt in ("%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)} {year}", fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def publication_items(df: pd.DataFrame, now: str) -> tuple[list[dict], list[str]]:
    items, mismatches = [], []
    for _, r in df.iterrows():
        title = clean(r.get("Title of Paper"))
        if not title:
            continue
        status_raw = clean(r.get("Status")) or ""
        accepted = status_raw.lower().startswith("proposal accepted")
        full_deadline = clean(r.get("Full Paper Deadline"))
        note = status_raw if accepted else None
        if accepted:
            stated = parse_deadline_text(status_raw, int(full_deadline[:4]) if full_deadline else 2026)
            if stated and full_deadline and stated != full_deadline:
                mismatches.append(f"#{clean(r.get('S.No.'))} {title[:60]}: status text says {stated}, "
                                  f"deadline column says {full_deadline}")
        data = {
            "call_link": clean(r.get("Call for Paper Link")),
            "proposal_deadline": clean(r.get("Proposal Deadline")),
            "full_paper_deadline": full_deadline,
            "association": clean(r.get("Association")),
            "publication_type": clean(r.get("Publication Type")),
            "priority": clean(r.get("Priority")),
            "action": clean(r.get("Action")),
            "status": "Proposal Accepted" if accepted else (status_raw or None),
            "status_note": note,
            "comments": clean(r.get("Comments")),
            "reminder": clean(r.get("Reminder")),
        }
        items.append(make_item("publications", title, data, now))
    return items, mismatches


def simple_list_items(df: pd.DataFrame, cat: str, name_col: str, extra: dict[str, str], now: str) -> list[dict]:
    items = []
    for _, r in df.iterrows():
        name = clean(r.get(name_col))
        if name:
            items.append(make_item(cat, name, {k: clean(r.get(col)) for k, col in extra.items()}, now))
    return items


def email_items(df: pd.DataFrame, now: str) -> list[dict]:
    cols = {"Personal email": 1, "Professional email": 2, "Newsletter": 4}
    items = []
    for kind, idx in cols.items():
        for v in df.iloc[1:, idx]:
            text = clean(v)
            if text:
                items.append(make_item("emails-newsletters", text, {"kind": kind}, now))
    return items


def company_items(comp: pd.DataFrame, now: str) -> tuple[list[dict], list[dict], list[dict]]:
    """Returns (company items, company-social items, personal-social items)."""
    comp = comp.copy()
    comp["Attribute"] = comp["Attribute"].astype(str).str.strip()
    entity_cols = [c for c in comp.columns[2:]]
    companies, company_social, personal_social = [], [], []
    for col in entity_cols:
        name = str(col).strip()
        values = {row.Attribute: clean(row[col]) for _, row in comp.iterrows()}
        if name == PERSONAL_ENTITY:
            for platform in SOCIAL_ATTRS:
                v = values.get(platform)
                url = v if v and v.lower().startswith("http") else None
                data = {"platform": platform, "profile_url": url, "username": None if url else v,
                        "status": "Active" if v else "To fill in"}
                personal_social.append(make_item("personal-social", platform, data, now))
            continue
        facts = {slug(a).replace("-", "_"): v for a, v in values.items() if a not in SOCIAL_ATTRS and a != "Notes"}
        facts["notes"] = values.get("Notes")
        company = make_item("companies", name, facts, now)
        companies.append(company)
        for platform in SOCIAL_ATTRS:
            v = values.get(platform)
            data = {"company": company["id"], "platform": platform,
                    "url": v if v and v.lower().startswith("http") else None,
                    "username": None if (v and v.lower().startswith("http")) else v,
                    "status": "Active" if v else "To fill in"}
            company_social.append(make_item("company-social", f"{name} - {platform}", data, now))
    return companies, company_social, personal_social


# ----------------------------------------------------------------------------- tasks
KIND_MAP = {
    "action task": "action_task", "goal / reference": "goal_reference",
    "reference / link": "reference_link", "reference / list": "reference_list",
}


def build_tasks(df: pd.DataFrame, now: str) -> tuple[list[dict], dict]:
    """De-duplicate tasks. First occurrence wins; all source rows are kept in sourceRefs."""
    text_col = next(c for c in df.columns if str(c).startswith("Task / Content"))
    link_col = next(c for c in df.columns if str(c).startswith("Links"))
    tasks: dict[str, dict] = {}
    merged: dict[str, int] = {}
    conflicts: list[str] = []
    total = 0
    for _, r in df.iterrows():
        title = clean(r[text_col])
        if not title:
            continue
        total += 1
        key = norm_key(title)
        head_num = re.match(r"^(\d{2})", str(r["Major Head"]).strip())
        cat_id = f"head-{head_num.group(1)}" if head_num else "head-01"
        ref = f"CONTENT#{int(r['Source Row'])}"
        links = extract_links(clean(r[link_col]))
        if key in tasks:
            t = tasks[key]
            t["sourceRefs"].append(ref)
            t["links"] = list(dict.fromkeys(t["links"] + links))
            merged[key] = merged.get(key, 1) + 1
            if t["categoryId"] != cat_id:
                conflicts.append(f"{title[:60]} ({t['categoryId']} vs {cat_id})")
            continue
        tasks[key] = {
            "id": stable_id("task", key), "categoryId": cat_id, "subArea": clean(r["Sub-area"]),
            "title": title, "kind": KIND_MAP.get(str(r["Task Type"]).strip().lower(), "goal_reference"),
            "status": "todo", "links": links, "sourceRefs": [ref], "dedupeKey": key,
            "createdAt": now, "updatedAt": now,
        }
    stats = {"total_rows": total, "unique": len(tasks), "removed": total - len(tasks),
             "merged_groups": merged, "category_conflicts": conflicts}
    return list(tasks.values()), stats


def near_duplicates(tasks: list[dict], threshold: float = 0.9) -> list[tuple[dict, dict, float]]:
    """Pairs that are *almost* identical. Reported for human review - never auto-removed."""
    pool = [t for t in tasks if len(t["dedupeKey"]) > 25]
    out = []
    for i, a in enumerate(pool):
        for b in pool[i + 1:]:
            ka, kb = a["dedupeKey"], b["dedupeKey"]
            if abs(len(ka) - len(kb)) > 12:
                continue
            sm = difflib.SequenceMatcher(None, ka, kb)
            if sm.quick_ratio() >= threshold and sm.ratio() >= threshold:
                out.append((a, b, sm.ratio()))
    return out


# ----------------------------------------------------------------------------- main
def write_report(path: Path, stats: dict, near: list, mismatches: list, counts: dict, tasks: list[dict]) -> None:
    lines = [
        "# Migration report", "",
        f"- Task rows read: **{stats['total_rows']}**",
        f"- Unique tasks kept: **{stats['unique']}**",
        f"- Duplicate rows merged away: **{stats['removed']}**",
        f"- Duplicate groups with conflicting category: **{len(stats['category_conflicts'])}**", "",
        "## Records created", "",
        *[f"- {k}: {v}" for k, v in counts.items()], "",
        "## Most repeated tasks (now single entries)", "",
    ]
    by_key = {t["dedupeKey"]: t for t in tasks}
    for key, n in sorted(stats["merged_groups"].items(), key=lambda kv: -kv[1])[:10]:
        lines.append(f"- x{n}: {by_key[key]['title'][:90]}")
    lines += ["", "## Near-duplicates for you to review (NOT removed)", ""]
    lines += [f"- {a['title'][:70]}  <->  {b['title'][:70]}  ({ratio:.0%})" for a, b, ratio in near] or ["- none"]
    lines += ["", "## Publications: status text vs deadline column disagree", ""]
    lines += [f"- {m}" for m in mismatches] or ["- none"]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("--out", type=Path, default=Path("data/private"))
    args = ap.parse_args()

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sheets = pd.read_excel(args.xlsx, sheet_name=None, header=0)
    raw = pd.read_excel(args.xlsx, sheet_name=None, header=None)

    categories = build_categories(sheets["PORTAL TAXONOMY"], sheets["COMP & SMP"])
    items: list[dict] = []
    items += platform_items(raw["ACADEMIC PLATFORM"], "academic-platforms", now)
    items += platform_items(raw["TECH PLATFORMPORTFOLIO"], "tech-platforms", now)
    pubs, mismatches = publication_items(sheets["PUBLICATIONS"], now)
    items += pubs
    items += simple_list_items(sheets["ONGOING COURSES"].rename(columns=str.strip), "courses", "COURSE NAME",
                               {"status": "STATUS"}, now)
    items += simple_list_items(sheets["EXAMS"], "exams", "EXAMS", {"exam_date": "DATE", "status": "STATUS"}, now)
    companies, company_social, personal_social = company_items(sheets["COMP & SMP"], now)
    items += companies + company_social + personal_social
    items += email_items(raw["EMAILS & NL"], now)

    keys = [i["dedupeKey"] for i in items]
    assert len(keys) == len(set(keys)), "duplicate items detected"

    tasks, stats = build_tasks(sheets[TASK_SHEET], now)
    assert len({t["dedupeKey"] for t in tasks}) == len(tasks), "duplicate tasks detected"
    near = near_duplicates(tasks)

    args.out.mkdir(parents=True, exist_ok=True)
    seed = {"schemaVersion": SCHEMA_VERSION, "generatedAt": now, "categories": categories,
            "items": items, "tasks": tasks}
    (args.out / "seed.json").write_text(json.dumps(seed, indent=2, ensure_ascii=False), encoding="utf-8")
    counts = {"categories": len(categories), "items": len(items), "tasks": len(tasks)}
    write_report(args.out / "migration_report.md", stats, near, mismatches, counts, tasks)
    print(json.dumps({**counts, "task_rows_read": stats["total_rows"], "duplicates_removed": stats["removed"],
                      "near_duplicates_to_review": len(near)}, indent=2))


if __name__ == "__main__":
    main()
