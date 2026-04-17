"""
MIND Dataset Loader
====================
Loads real articles from the Microsoft MIND dataset (news.tsv).
Provides rich article metadata for the recommendation engine.

news.tsv columns (tab-separated):
  0: News ID
  1: Category
  2: SubCategory
  3: Title
  4: Abstract
  5: URL
  6: Title Entities (JSON)
  7: Abstract Entities (JSON)
"""

import csv
import os
import random
import hashlib
import numpy as np
from typing import List, Dict, Optional


# ──────────────────────────────────────────────────────────────
# Category → Mood Affinity Mapping
# Used to bias recommendations based on user mood context
# ──────────────────────────────────────────────────────────────
CATEGORY_MOOD_MAP = {
    "health":        {"relaxed": 0.9, "happy": 0.7, "stressed": 0.6, "focused": 0.5, "sad": 0.4, "energetic": 0.6},
    "lifestyle":     {"happy": 0.9, "relaxed": 0.8, "energetic": 0.7, "focused": 0.3, "stressed": 0.4, "sad": 0.5},
    "sports":        {"energetic": 0.95, "happy": 0.8, "focused": 0.6, "relaxed": 0.4, "stressed": 0.3, "sad": 0.2},
    "news":          {"focused": 0.8, "stressed": 0.5, "energetic": 0.5, "relaxed": 0.4, "happy": 0.4, "sad": 0.3},
    "finance":       {"focused": 0.9, "stressed": 0.6, "energetic": 0.4, "relaxed": 0.3, "happy": 0.3, "sad": 0.2},
    "entertainment": {"happy": 0.95, "relaxed": 0.8, "energetic": 0.7, "sad": 0.6, "stressed": 0.5, "focused": 0.3},
    "autos":         {"focused": 0.7, "energetic": 0.6, "happy": 0.5, "relaxed": 0.5, "stressed": 0.3, "sad": 0.2},
    "travel":        {"happy": 0.9, "relaxed": 0.85, "energetic": 0.7, "focused": 0.4, "sad": 0.5, "stressed": 0.3},
    "foodanddrink":  {"happy": 0.85, "relaxed": 0.8, "energetic": 0.5, "focused": 0.3, "stressed": 0.4, "sad": 0.5},
    "tv":            {"relaxed": 0.85, "happy": 0.8, "sad": 0.6, "stressed": 0.5, "energetic": 0.4, "focused": 0.2},
    "music":         {"happy": 0.9, "relaxed": 0.85, "energetic": 0.8, "sad": 0.7, "stressed": 0.5, "focused": 0.4},
    "movies":        {"relaxed": 0.85, "happy": 0.8, "sad": 0.6, "energetic": 0.5, "stressed": 0.4, "focused": 0.3},
    "video":         {"relaxed": 0.8, "happy": 0.75, "energetic": 0.6, "sad": 0.5, "stressed": 0.4, "focused": 0.3},
    "weather":       {"focused": 0.6, "relaxed": 0.5, "happy": 0.4, "energetic": 0.4, "stressed": 0.3, "sad": 0.3},
    "kids":          {"happy": 0.9, "relaxed": 0.7, "energetic": 0.6, "sad": 0.3, "focused": 0.3, "stressed": 0.2},
    "middleeast":    {"focused": 0.7, "stressed": 0.5, "energetic": 0.3, "relaxed": 0.2, "happy": 0.2, "sad": 0.4},
    "northamerica":  {"focused": 0.7, "stressed": 0.4, "energetic": 0.4, "relaxed": 0.3, "happy": 0.3, "sad": 0.3},
}

# Category icons for the frontend
CATEGORY_ICONS = {
    "health": "🏥",
    "lifestyle": "✨",
    "sports": "⚽",
    "news": "📰",
    "finance": "💰",
    "entertainment": "🎭",
    "autos": "🚗",
    "travel": "✈️",
    "foodanddrink": "🍔",
    "tv": "📺",
    "music": "🎵",
    "movies": "🎬",
    "video": "📹",
    "weather": "🌤️",
    "kids": "🧒",
    "middleeast": "🌍",
    "northamerica": "🌎",
}


def _deterministic_embedding(text: str, dim: int = 64) -> np.ndarray:
    """
    Create a deterministic pseudo-embedding from text using SHA-256.
    This gives consistent, reproducible embeddings without needing
    a heavy transformer model at hackathon demo time.
    """
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    # Use the hash to seed a random generator for reproducible vectors
    seed = int(h[:8], 16)
    rng = np.random.RandomState(seed)
    vec = rng.randn(dim).astype(np.float32)
    # L2 normalize
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def load_mind_articles(
    data_dir: str,
    max_articles: int = 200,
    embedding_dim: int = 64,
) -> tuple:
    """
    Load articles from MIND news.tsv.

    Returns:
        articles: List of article dicts with metadata
        embeddings: numpy array of shape (N, embedding_dim)
    """
    # Try multiple possible paths
    possible_paths = [
        os.path.join(data_dir, "MINDlarge_train", "MINDlarge_train", "news.tsv"),
        os.path.join(data_dir, "MINDlarge_dev", "MINDlarge_dev", "news.tsv"),
        os.path.join(data_dir, "news.tsv"),
    ]

    news_path = None
    for p in possible_paths:
        if os.path.exists(p):
            news_path = p
            break

    if news_path is None:
        print("[WARN] MIND dataset not found, using synthetic articles.")
        return _generate_synthetic_articles(max_articles, embedding_dim)

    print(f"[INFO] Loading MIND dataset from: {news_path}")

    articles = []
    seen_categories = set()

    with open(news_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        all_rows = []
        for row in reader:
            if len(row) >= 5 and row[3].strip() and row[4].strip():
                all_rows.append(row)

    # Sample diverse articles across categories
    # Group by category first
    by_category = {}
    for row in all_rows:
        cat = row[1].lower()
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(row)

    # Take balanced samples from each category
    per_category = max(5, max_articles // max(1, len(by_category)))
    sampled_rows = []
    for cat, rows in by_category.items():
        sampled_rows.extend(random.sample(rows, min(per_category, len(rows))))

    # Shuffle and cap
    random.shuffle(sampled_rows)
    sampled_rows = sampled_rows[:max_articles]

    embeddings_list = []

    for idx, row in enumerate(sampled_rows):
        news_id = row[0]
        category = row[1].lower()
        subcategory = row[2].lower() if len(row) > 2 else ""
        title = row[3].strip()
        abstract = row[4].strip() if len(row) > 4 and row[4].strip() else ""

        # Create embedding from title + abstract
        embed_text = f"{title} {abstract} {category}"
        embedding = _deterministic_embedding(embed_text, embedding_dim)
        embeddings_list.append(embedding)

        # Mood affinity scores
        mood_scores = CATEGORY_MOOD_MAP.get(category, {
            "happy": 0.5, "relaxed": 0.5, "focused": 0.5,
            "stressed": 0.3, "sad": 0.3, "energetic": 0.5,
        })

        articles.append({
            "id": idx,
            "news_id": news_id,
            "title": title,
            "abstract": abstract,
            "category": category,
            "subcategory": subcategory,
            "icon": CATEGORY_ICONS.get(category, "📄"),
            "mood_affinity": mood_scores,
        })

    embeddings = np.array(embeddings_list, dtype=np.float32)
    print(f"[OK] Loaded {len(articles)} articles across {len(by_category)} categories")
    return articles, embeddings


def _generate_synthetic_articles(
    count: int = 50, embedding_dim: int = 64
) -> tuple:
    """Fallback synthetic articles if MIND data isn't available."""
    synthetic = [
        ("10 Best Post-Workout Recovery Meals", "health", "Fuel your body right after the gym with these nutritious meals."),
        ("Champions League Quarter-Finals Preview", "sports", "Who will advance? Breaking down all matchups."),
        ("The Rise of Quantum Computing in 2026", "news", "How quantum processors are reshaping industries."),
        ("Deep Dive: Renewable Energy Revolution", "news", "Solar and wind power reach record efficiency levels."),
        ("Global Markets Rally on AI Optimism", "finance", "Tech stocks surge as AI adoption accelerates worldwide."),
        ("Top 10 Must-Watch Movies This Spring", "entertainment", "From blockbusters to indie gems, here's your watchlist."),
        ("Electric SUVs: The Complete 2026 Buyer's Guide", "autos", "Compare the best electric SUVs on the market today."),
        ("Hidden Beach Destinations You Need to Visit", "travel", "Escape the crowds with these secluded paradise spots."),
        ("Mastering Sourdough: A Beginner's Guide", "foodanddrink", "Learn the art of sourdough from scratch."),
        ("Breaking: Mars Rover Discovers Water Ice", "news", "NASA confirms largest water ice deposit found on Mars."),
        ("5-Minute Meditation for Stress Relief", "health", "Quick mindfulness exercises for your busy day."),
        ("Premier League Title Race Heats Up", "sports", "Three teams separated by just two points."),
        ("Understanding Blockchain Beyond Crypto", "finance", "Real-world blockchain applications transforming supply chains."),
        ("The Psychology of Color in Interior Design", "lifestyle", "How colors affect mood and productivity at home."),
        ("Best New Albums Dropping This Week", "music", "Fresh releases from top artists across all genres."),
        ("Space Tourism: What to Expect in 2026", "travel", "Commercial space flights are finally becoming reality."),
        ("AI-Powered Cooking: Smart Kitchen Tech", "foodanddrink", "Gadgets that are revolutionizing home cooking."),
        ("Formula 1: Season Mid-Point Analysis", "sports", "Stats, standings, and predictions for the rest of the season."),
        ("Guided Sleep Story: The Enchanted Forest", "health", "Drift off to dreamland with this calming narrative."),
        ("The Future of Remote Work", "lifestyle", "How companies are reimagining the hybrid workplace."),
        ("Oscar Predictions: Who Will Win Big?", "movies", "Our expert predictions for every major category."),
        ("Teaching Kids to Code: Fun Platforms", "kids", "Age-appropriate programming tools for young minds."),
        ("Weather Alert: Heat Wave Approaching", "weather", "Prepare for record temperatures this weekend."),
        ("Late Night TV: Best Moments This Week", "tv", "The funniest clips from your favorite hosts."),
        ("Viral Videos: This Week's Internet Gold", "video", "The most shared videos breaking the internet."),
        ("Yoga for Beginners: Start Your Journey", "health", "Gentle poses perfect for newcomers to yoga."),
        ("Cryptocurrency Market Weekly Roundup", "finance", "Bitcoin, Ethereum, and altcoin performance analysis."),
        ("The Art of Japanese Garden Design", "lifestyle", "Creating tranquility with traditional garden principles."),
        ("New Electric Vehicle Tax Credits Explained", "autos", "How to maximize savings on your next EV purchase."),
        ("Streaming Wars: Which Service Wins?", "entertainment", "Comparing content libraries and pricing across platforms."),
    ]

    articles = []
    embeddings_list = []

    for idx, (title, category, abstract) in enumerate(synthetic):
        embedding = _deterministic_embedding(f"{title} {abstract} {category}", embedding_dim)
        embeddings_list.append(embedding)

        mood_scores = CATEGORY_MOOD_MAP.get(category, {
            "happy": 0.5, "relaxed": 0.5, "focused": 0.5,
            "stressed": 0.3, "sad": 0.3, "energetic": 0.5,
        })

        articles.append({
            "id": idx,
            "news_id": f"SYN{idx:04d}",
            "title": title,
            "abstract": abstract,
            "category": category,
            "subcategory": "",
            "icon": CATEGORY_ICONS.get(category, "📄"),
            "mood_affinity": mood_scores,
        })

    # Pad with duplicates if needed
    while len(articles) < count:
        src_idx = random.randint(0, len(synthetic) - 1)
        new_idx = len(articles)
        art = articles[src_idx].copy()
        art["id"] = new_idx
        articles.append(art)
        embeddings_list.append(embeddings_list[src_idx].copy())

    embeddings = np.array(embeddings_list[:count], dtype=np.float32)
    articles = articles[:count]
    print(f"[OK] Generated {len(articles)} synthetic articles")
    return articles, embeddings
