"""
generate_synthetic_data.py
==========================
Generates two CSV files in data/synthetic/:
  - synthetic_users.csv        (20 simulated user personas)
  - synthetic_interactions.csv (600+ interaction rows)

Run from repo root:
    python tools/generate_synthetic_data.py

Uses random seed=42 for full reproducibility.
"""

import csv
import os
import random
from collections import defaultdict

# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic")

ALL_CATEGORIES = [
    "finance", "sports", "health", "entertainment", "news",
    "travel", "foodanddrink", "lifestyle", "movies", "tv",
    "music", "autos", "weather", "kids", "middleeast", "northamerica",
]

MOODS   = ["happy", "sad", "relaxed", "stressed", "focused", "energetic"]
TIMES   = ["Morning", "Afternoon", "Evening", "Night"]

# ──────────────────────────────────────────────────────────────
# User persona definitions  (3–4 users per archetype, total 20)
# ──────────────────────────────────────────────────────────────
USER_PERSONAS = [
    # ── Sports fans (India region) ────────────────────────────
    {
        "user_id": "U001", "name": "Arjun Sharma",
        "age_group": "18-25", "region": "india",
        "interests": ["sports", "entertainment"],
        "avoid_topics": ["finance", "weather"],
        "mood_tendency": "energetic",
        "reading_speed": "fast", "reading_frequency": "daily",
    },
    {
        "user_id": "U002", "name": "Priya Patel",
        "age_group": "26-35", "region": "india",
        "interests": ["sports", "health"],
        "avoid_topics": ["kids", "autos"],
        "mood_tendency": "happy",
        "reading_speed": "medium", "reading_frequency": "daily",
    },
    {
        "user_id": "U003", "name": "Rahul Verma",
        "age_group": "18-25", "region": "india",
        "interests": ["sports", "movies"],
        "avoid_topics": ["finance", "middleeast"],
        "mood_tendency": "energetic",
        "reading_speed": "fast", "reading_frequency": "weekly",
    },
    {
        "user_id": "U004", "name": "Sneha Reddy",
        "age_group": "26-35", "region": "india",
        "interests": ["sports", "entertainment", "music"],
        "avoid_topics": ["autos", "weather"],
        "mood_tendency": "happy",
        "reading_speed": "medium", "reading_frequency": "daily",
    },

    # ── Finance analysts (North America) ──────────────────────
    {
        "user_id": "U005", "name": "James Carter",
        "age_group": "36-45", "region": "north_america",
        "interests": ["finance", "news"],
        "avoid_topics": ["kids", "music"],
        "mood_tendency": "focused",
        "reading_speed": "slow", "reading_frequency": "daily",
    },
    {
        "user_id": "U006", "name": "Sarah Mitchell",
        "age_group": "26-35", "region": "north_america",
        "interests": ["finance", "northamerica"],
        "avoid_topics": ["kids", "sports"],
        "mood_tendency": "focused",
        "reading_speed": "slow", "reading_frequency": "daily",
    },
    {
        "user_id": "U007", "name": "David Huang",
        "age_group": "36-45", "region": "north_america",
        "interests": ["finance", "news", "autos"],
        "avoid_topics": ["music", "lifestyle"],
        "mood_tendency": "stressed",
        "reading_speed": "medium", "reading_frequency": "daily",
    },
    {
        "user_id": "U008", "name": "Emily Ross",
        "age_group": "46-55", "region": "north_america",
        "interests": ["finance", "northamerica", "news"],
        "avoid_topics": ["kids", "movies"],
        "mood_tendency": "focused",
        "reading_speed": "slow", "reading_frequency": "weekly",
    },

    # ── Wellness seekers (Europe) ──────────────────────────────
    {
        "user_id": "U009", "name": "Sofia Müller",
        "age_group": "26-35", "region": "europe",
        "interests": ["health", "lifestyle", "foodanddrink"],
        "avoid_topics": ["autos", "middleeast"],
        "mood_tendency": "relaxed",
        "reading_speed": "medium", "reading_frequency": "daily",
    },
    {
        "user_id": "U010", "name": "Luca Rossi",
        "age_group": "36-45", "region": "europe",
        "interests": ["health", "travel", "foodanddrink"],
        "avoid_topics": ["finance", "autos"],
        "mood_tendency": "relaxed",
        "reading_speed": "medium", "reading_frequency": "daily",
    },
    {
        "user_id": "U011", "name": "Emma Dubois",
        "age_group": "18-25", "region": "europe",
        "interests": ["lifestyle", "health", "music"],
        "avoid_topics": ["autos", "weather"],
        "mood_tendency": "happy",
        "reading_speed": "fast", "reading_frequency": "weekly",
    },
    {
        "user_id": "U012", "name": "Hans Weber",
        "age_group": "46-55", "region": "europe",
        "interests": ["health", "foodanddrink", "travel"],
        "avoid_topics": ["sports", "kids"],
        "mood_tendency": "relaxed",
        "reading_speed": "slow", "reading_frequency": "weekly",
    },

    # ── News junkies (Middle East) ─────────────────────────────
    {
        "user_id": "U013", "name": "Omar Al-Rashid",
        "age_group": "26-35", "region": "middle_east",
        "interests": ["news", "middleeast"],
        "avoid_topics": ["kids", "music"],
        "mood_tendency": "focused",
        "reading_speed": "medium", "reading_frequency": "daily",
    },
    {
        "user_id": "U014", "name": "Fatima Hassan",
        "age_group": "36-45", "region": "middle_east",
        "interests": ["news", "middleeast", "northamerica"],
        "avoid_topics": ["sports", "autos"],
        "mood_tendency": "stressed",
        "reading_speed": "slow", "reading_frequency": "daily",
    },
    {
        "user_id": "U015", "name": "Khalid Nasser",
        "age_group": "18-25", "region": "middle_east",
        "interests": ["news", "finance", "middleeast"],
        "avoid_topics": ["kids", "lifestyle"],
        "mood_tendency": "focused",
        "reading_speed": "medium", "reading_frequency": "daily",
    },
    {
        "user_id": "U016", "name": "Layla Ibrahim",
        "age_group": "26-35", "region": "middle_east",
        "interests": ["news", "entertainment", "middleeast"],
        "avoid_topics": ["autos", "weather"],
        "mood_tendency": "focused",
        "reading_speed": "medium", "reading_frequency": "weekly",
    },

    # ── Entertainment lovers (Worldwide) ──────────────────────
    {
        "user_id": "U017", "name": "Mia Johnson",
        "age_group": "18-25", "region": "worldwide",
        "interests": ["movies", "tv", "music"],
        "avoid_topics": ["finance", "weather"],
        "mood_tendency": "happy",
        "reading_speed": "fast", "reading_frequency": "daily",
    },
    {
        "user_id": "U018", "name": "Carlos Mendez",
        "age_group": "26-35", "region": "worldwide",
        "interests": ["movies", "entertainment", "sports"],
        "avoid_topics": ["kids", "weather"],
        "mood_tendency": "energetic",
        "reading_speed": "fast", "reading_frequency": "daily",
    },
    {
        "user_id": "U019", "name": "Yuki Tanaka",
        "age_group": "18-25", "region": "worldwide",
        "interests": ["music", "tv", "lifestyle"],
        "avoid_topics": ["finance", "autos"],
        "mood_tendency": "happy",
        "reading_speed": "fast", "reading_frequency": "daily",
    },
    {
        "user_id": "U020", "name": "Aisha Williams",
        "age_group": "36-45", "region": "worldwide",
        "interests": ["movies", "tv", "entertainment", "music"],
        "avoid_topics": ["finance", "middleeast"],
        "mood_tendency": "relaxed",
        "reading_speed": "medium", "reading_frequency": "weekly",
    },
]

# Mood tendencies per archetype → natural mood pool for each user
MOOD_POOLS = {
    "energetic": ["energetic", "energetic", "happy", "happy", "relaxed"],
    "happy":     ["happy", "happy", "relaxed", "energetic", "happy"],
    "focused":   ["focused", "focused", "stressed", "focused", "relaxed"],
    "relaxed":   ["relaxed", "relaxed", "happy", "relaxed", "focused"],
    "stressed":  ["stressed", "stressed", "focused", "stressed", "relaxed"],
    "sad":       ["sad", "sad", "relaxed", "focused", "sad"],
}


# ──────────────────────────────────────────────────────────────
# Helper: compute reward from action + category match
# ──────────────────────────────────────────────────────────────
def _reward_for_action(action: str, is_preferred: bool, is_avoided: bool) -> float:
    base = {
        "like":    1.0,
        "read":    0.6,
        "skip":   -0.3,
        "dislike": -1.0,
    }[action]

    if is_preferred:
        base += 0.3
    if is_avoided:
        base -= 0.4

    return round(max(-1.5, min(1.5, base)), 2)


def _dwell_and_scroll(action: str) -> tuple:
    """Return (dwell_time_s, scroll_depth_pct) based on action."""
    if action in ("like", "read"):
        dwell = random.randint(30, 180)
        scroll = random.randint(60, 100)
    elif action == "skip":
        dwell = random.randint(2, 10)
        scroll = random.randint(5, 25)
    else:  # dislike
        dwell = random.randint(3, 15)
        scroll = random.randint(5, 35)
    return dwell, scroll


# ──────────────────────────────────────────────────────────────
# Generate interactions for one user
# ──────────────────────────────────────────────────────────────
def _generate_user_interactions(user: dict, session_start_id: int) -> list:
    uid         = user["user_id"]
    interests   = user["interests"]
    avoid       = user["avoid_topics"]
    mood_pool   = MOOD_POOLS.get(user["mood_tendency"], MOODS)
    non_avoided = [c for c in ALL_CATEGORIES if c not in avoid]
    num_sessions = random.randint(3, 6)

    rows = []
    session_id = session_start_id
    interaction_num = 0

    for _ in range(num_sessions):
        session_length = random.randint(5, 15)
        session_mood   = random.choice(mood_pool)
        time_of_day    = random.choice(TIMES)

        for pos in range(session_length):
            interaction_num += 1

            # 70% chance to pick preferred category, 30% explore
            if random.random() < 0.70 and interests:
                category = random.choice(interests)
            else:
                explore_pool = [c for c in non_avoided if c not in interests]
                if explore_pool:
                    category = random.choice(explore_pool)
                else:
                    category = random.choice(non_avoided) if non_avoided else random.choice(ALL_CATEGORIES)

            is_preferred = category in interests
            is_avoided   = category in avoid

            # Decide action
            if is_preferred:
                # Strongly prefer like/read
                action = random.choices(
                    ["like", "read", "skip", "dislike"],
                    weights=[40, 40, 15, 5],
                    k=1,
                )[0]
            elif is_avoided:
                action = random.choices(
                    ["like", "read", "skip", "dislike"],
                    weights=[5, 10, 50, 35],
                    k=1,
                )[0]
            else:
                action = random.choices(
                    ["like", "read", "skip", "dislike"],
                    weights=[20, 30, 35, 15],
                    k=1,
                )[0]

            reward            = _reward_for_action(action, is_preferred, is_avoided)
            dwell, scroll     = _dwell_and_scroll(action)

            # Slight mood drift within session (last few articles)
            current_mood = session_mood
            if pos > session_length * 0.7:
                current_mood = random.choice(mood_pool)

            rows.append({
                "user_id":          uid,
                "article_category": category,
                "action":           action,
                "reward":           reward,
                "dwell_time_s":     dwell,
                "scroll_depth_pct": scroll,
                "mood":             current_mood,
                "time_of_day":      time_of_day,
                "session_id":       f"S{session_id:04d}",
                "interaction_num":  interaction_num,
            })

        session_id += 1

    return rows


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ── Write synthetic_users.csv ──────────────────────────────
    users_path = os.path.join(OUTPUT_DIR, "synthetic_users.csv")
    users_fieldnames = [
        "user_id", "name", "age_group", "region",
        "interests", "avoid_topics",
        "mood_tendency", "reading_speed", "reading_frequency",
    ]
    with open(users_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=users_fieldnames)
        writer.writeheader()
        for u in USER_PERSONAS:
            row = dict(u)
            row["interests"]    = "|".join(u["interests"])
            row["avoid_topics"] = "|".join(u["avoid_topics"])
            writer.writerow({k: row[k] for k in users_fieldnames})

    print(f"[OK] Written {len(USER_PERSONAS)} users → {users_path}")

    # ── Generate interactions ──────────────────────────────────
    all_interactions = []
    session_counter  = 1
    for user in USER_PERSONAS:
        interactions = _generate_user_interactions(user, session_counter)
        all_interactions.extend(interactions)
        # Advance session counter past sessions used by this user
        session_ids_used = len({r["session_id"] for r in interactions})
        session_counter += session_ids_used

    # ── Write synthetic_interactions.csv ──────────────────────
    interactions_path = os.path.join(OUTPUT_DIR, "synthetic_interactions.csv")
    interactions_fieldnames = [
        "user_id", "article_category", "action", "reward",
        "dwell_time_s", "scroll_depth_pct", "mood",
        "time_of_day", "session_id", "interaction_num",
    ]
    with open(interactions_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=interactions_fieldnames)
        writer.writeheader()
        writer.writerows(all_interactions)

    print(f"[OK] Written {len(all_interactions)} interactions → {interactions_path}")

    # ── Summary stats ──────────────────────────────────────────
    print("\n" + "=" * 50)
    print("SUMMARY STATISTICS")
    print("=" * 50)
    print(f"  Total users        : {len(USER_PERSONAS)}")
    print(f"  Total interactions : {len(all_interactions)}")

    action_counts = defaultdict(int)
    category_counts = defaultdict(int)
    reward_sum = 0.0
    for row in all_interactions:
        action_counts[row["action"]] += 1
        category_counts[row["article_category"]] += 1
        reward_sum += float(row["reward"])

    print(f"  Average reward     : {reward_sum / len(all_interactions):.4f}")
    print(f"\n  Action distribution:")
    for action, count in sorted(action_counts.items()):
        pct = 100 * count / len(all_interactions)
        print(f"    {action:<10}: {count:>4}  ({pct:.1f}%)")

    print(f"\n  Top 5 categories by interaction count:")
    top5 = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    for cat, count in top5:
        print(f"    {cat:<16}: {count}")

    interactions_per_user = defaultdict(int)
    for row in all_interactions:
        interactions_per_user[row["user_id"]] += 1
    counts = list(interactions_per_user.values())
    print(f"\n  Interactions per user: min={min(counts)}  max={max(counts)}  avg={sum(counts)/len(counts):.1f}")
    print("=" * 50)


if __name__ == "__main__":
    main()
