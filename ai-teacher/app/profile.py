"""Persistent learner profile (JSON file store)."""
import json
import os
import datetime

from . import config

_DEFAULT = {
    "name": None,
    "sessions": [],          # [{date, title, score, strong, weak, language, minutes}]
    "concept_strength": {},  # concept -> {"correct": n, "attempts": n}
}


def load():
    if os.path.exists(config.PROFILE_PATH):
        try:
            with open(config.PROFILE_PATH, encoding="utf-8") as f:
                data = json.load(f)
            merged = dict(_DEFAULT)
            merged.update(data)
            return merged
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT)


def save(data):
    try:
        with open(config.PROFILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


def record_session(title, score, strong, weak, language, minutes, concept_stats,
                   grade=None, subject=None):
    profile = load()
    profile["sessions"].append({
        "date": datetime.date.today().isoformat(),
        "title": title,
        "score": score,
        "strong": strong,
        "weak": weak,
        "language": language,
        "minutes": minutes,
        "grade": grade,
        "subject": subject,
    })
    for concept, st in concept_stats.items():
        entry = profile["concept_strength"].setdefault(concept, {"correct": 0, "attempts": 0})
        entry["attempts"] += st["attempts"]
        entry["correct"] += round(st["score_sum"])
    save(profile)
    return profile


def concept_mastery():
    profile = load()
    out = []
    for concept, st in profile.get("concept_strength", {}).items():
        att = st.get("attempts", 0)
        if att:
            out.append({"concept": concept, "mastery": round(st["correct"] / att, 2), "attempts": att})
    out.sort(key=lambda x: x["mastery"])
    return out
