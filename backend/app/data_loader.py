"""
MIND Dataset Loader — Semantic TF-IDF Embeddings
=================================================
Loads articles from the Microsoft MIND dataset (news.tsv) and computes
semantically meaningful TF-IDF + SVD embeddings (better than random hashes).
Caches embeddings to disk so warm restarts are instant.

news.tsv columns (tab-separated):
  0: News ID  1: Category  2: SubCategory  3: Title  4: Abstract
"""

import csv
import hashlib
import os
import pickle
import random
from collections import defaultdict
from typing import Dict, List, Tuple

import numpy as np

EMBEDDING_DIM = 64

# ──────────────────────────────────────────────────────────────
# Category → Mood Affinity Mapping
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

CATEGORY_ICONS = {
    "health": "🏥", "lifestyle": "✨", "sports": "⚽", "news": "📰",
    "finance": "💰", "entertainment": "🎭", "autos": "🚗", "travel": "✈️",
    "foodanddrink": "🍔", "tv": "📺", "music": "🎵", "movies": "🎬",
    "video": "📹", "weather": "🌤️", "kids": "🧒", "middleeast": "🌍",
    "northamerica": "🌎",
}

CATEGORY_COLORS = {
    "sports": "#ff6b6b", "finance": "#00d4ff", "health": "#00e88f",
    "entertainment": "#ffb347", "travel": "#a78bfa", "news": "#7c5cff",
    "lifestyle": "#ff9f40", "foodanddrink": "#ff6384", "movies": "#818cf8",
    "tv": "#2dd4bf", "music": "#fbbf24", "autos": "#94a3b8",
    "weather": "#38bdf8", "kids": "#a3e635", "middleeast": "#fb7185",
    "northamerica": "#64748b", "video": "#f97316",
}


# ──────────────────────────────────────────────────────────────
# Semantic TF-IDF + SVD Embeddings
# ──────────────────────────────────────────────────────────────
def _compute_tfidf_embeddings(
    texts: List[str],
    dim: int,
    cache_path: str = None,
) -> np.ndarray:
    """Compute TF-IDF + Truncated SVD semantic embeddings with disk caching."""
    if cache_path and os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            data = pickle.load(f)
        if data.get("n") == len(texts) and data.get("dim") == dim:
            print(f"[OK] Loaded {len(texts)} cached TF-IDF embeddings")
            return data["embeddings"]

    print(f"[INFO] Computing TF-IDF + SVD embeddings for {len(texts)} articles…")
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize

    vectorizer = TfidfVectorizer(
        max_features=10_000,
        stop_words="english",
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
    )
    tfidf = vectorizer.fit_transform(texts)

    n_comp = min(dim, tfidf.shape[0] - 1, tfidf.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_comp, random_state=42, n_iter=7)
    emb = svd.fit_transform(tfidf).astype(np.float32)
    emb = normalize(emb, norm="l2")

    if emb.shape[1] < dim:
        pad = np.zeros((emb.shape[0], dim - emb.shape[1]), dtype=np.float32)
        emb = np.hstack([emb, pad])

    if cache_path:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "wb") as f:
            pickle.dump({"n": len(texts), "dim": dim, "embeddings": emb}, f)
        print(f"[OK] Cached embeddings → {cache_path}")

    return emb


def _deterministic_embedding(text: str, dim: int = 64) -> np.ndarray:
    """SHA-256 fallback embedding (used by training pipeline for unseen articles)."""
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    seed = int(h[:8], 16)
    rng = np.random.RandomState(seed)
    vec = rng.randn(dim).astype(np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


# ──────────────────────────────────────────────────────────────
# Main loader
# ──────────────────────────────────────────────────────────────
def load_mind_articles(
    data_dir: str,
    max_articles: int = 300,
    embedding_dim: int = EMBEDDING_DIM,
) -> Tuple[List[dict], np.ndarray]:
    """
    Load articles from MIND news.tsv with semantic TF-IDF embeddings.
    Returns (articles_list, embeddings_array[N, embedding_dim]).
    """
    possible_paths = [
        os.path.join(data_dir, "MINDlarge_train", "news.tsv"),   # correct path
        os.path.join(data_dir, "MINDlarge_dev", "news.tsv"),
        os.path.join(data_dir, "MINDlarge_test", "news.tsv"),
        os.path.join(data_dir, "MINDlarge_train", "MINDlarge_train", "news.tsv"),  # legacy
        os.path.join(data_dir, "MINDlarge_dev", "MINDlarge_dev", "news.tsv"),
        os.path.join(data_dir, "news.tsv"),
    ]

    news_path = next((p for p in possible_paths if os.path.exists(p)), None)
    if news_path is None:
        print("[WARN] MIND dataset not found — using synthetic fallback articles.")
        return _generate_synthetic_articles(max_articles, embedding_dim)

    print(f"[INFO] Loading MIND dataset from: {news_path}")

    all_rows = []
    with open(news_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) >= 4 and row[3].strip():
                all_rows.append(row)

    # Balanced sampling across categories (deterministic with seed)
    by_category: Dict[str, list] = defaultdict(list)
    for row in all_rows:
        cat = row[1].lower().strip()
        if cat:
            by_category[cat].append(row)

    rng = random.Random(42)
    per_category = max(10, max_articles // max(1, len(by_category)))
    sampled: List = []
    for cat in sorted(by_category):
        pool = by_category[cat]
        sampled.extend(rng.sample(pool, min(per_category, len(pool))))

    rng.shuffle(sampled)
    sampled = sampled[:max_articles]

    # Build text corpus for TF-IDF
    corpus = []
    for row in sampled:
        title    = row[3].strip()
        abstract = row[4].strip() if len(row) > 4 else ""
        cat      = row[1].lower()
        subcat   = row[2].lower() if len(row) > 2 else ""
        corpus.append(f"{title} {abstract} {cat} {subcat}")

    cache_dir  = os.path.dirname(news_path)
    cache_path = os.path.join(cache_dir, f"emb_cache_{max_articles}_{embedding_dim}.pkl")

    try:
        embeddings = _compute_tfidf_embeddings(corpus, embedding_dim, cache_path)
    except Exception as exc:
        print(f"[WARN] TF-IDF failed ({exc}) — falling back to SHA-256 embeddings")
        embeddings = np.array(
            [_deterministic_embedding(t, embedding_dim) for t in corpus],
            dtype=np.float32,
        )

    articles: List[dict] = []
    for idx, row in enumerate(sampled):
        category    = row[1].lower().strip()
        subcategory = row[2].lower().strip() if len(row) > 2 else ""
        title       = row[3].strip()
        abstract    = row[4].strip() if len(row) > 4 and row[4].strip() else ""

        articles.append({
            "id":           idx,
            "news_id":      row[0],
            "title":        title,
            "abstract":     abstract,
            "category":     category,
            "subcategory":  subcategory,
            "icon":         CATEGORY_ICONS.get(category, "📄"),
            "color":        CATEGORY_COLORS.get(category, "#7c5cff"),
            "mood_affinity": CATEGORY_MOOD_MAP.get(category, {
                "happy": 0.5, "relaxed": 0.5, "focused": 0.5,
                "stressed": 0.3, "sad": 0.3, "energetic": 0.5,
            }),
        })

    cats = {a["category"] for a in articles}
    print(f"[OK] Loaded {len(articles)} articles across {len(cats)} categories")
    return articles, embeddings.astype(np.float32)


# ──────────────────────────────────────────────────────────────
# Synthetic fallback
# ──────────────────────────────────────────────────────────────
def _generate_synthetic_articles(count: int = 50, dim: int = 64) -> Tuple[List[dict], np.ndarray]:
    synthetic = [
        ("Champions League Quarter-Finals Preview", "sports",        "Breaking down all matchups for the quarter finals."),
        ("Global Markets Rally on AI Optimism",     "finance",       "Tech stocks surge as AI adoption accelerates worldwide."),
        ("Top 10 Must-Watch Movies This Spring",    "entertainment", "From blockbusters to indie gems, your watchlist."),
        ("Electric SUVs: 2026 Buyer's Guide",       "autos",         "Compare the best electric SUVs on the market today."),
        ("Hidden Beach Destinations",               "travel",        "Escape the crowds with these secluded paradise spots."),
        ("5-Minute Meditation for Stress Relief",   "health",        "Quick mindfulness exercises for a busy day."),
        ("Mastering Sourdough: A Beginner's Guide", "foodanddrink",  "Learn the art of sourdough from scratch."),
        ("Premier League Title Race Heats Up",      "sports",        "Three teams separated by just two points with 8 games left."),
        ("Understanding Blockchain Beyond Crypto",  "finance",       "Real-world blockchain applications transforming supply chains."),
        ("The Psychology of Color in Interior Design", "lifestyle",  "How colors affect mood and productivity at home."),
        ("Best New Albums Dropping This Week",      "music",         "Fresh releases from top artists across all genres."),
        ("Space Tourism: What to Expect in 2026",   "travel",        "Commercial space flights are finally becoming reality."),
        ("Formula 1: Season Mid-Point Analysis",    "sports",        "Stats, standings, and predictions for the rest of the season."),
        ("Oscar Predictions: Who Will Win Big?",    "movies",        "Our expert predictions for every major Oscar category."),
        ("Teaching Kids to Code: Fun Platforms",    "kids",          "Age-appropriate programming tools for young minds."),
        ("Late Night TV: Best Moments This Week",   "tv",            "The funniest clips from your favorite late-night hosts."),
        ("Cryptocurrency Market Weekly Roundup",    "finance",       "Bitcoin, Ethereum, and altcoin performance analysis."),
        ("Yoga for Beginners: Start Your Journey",  "health",        "Gentle poses perfect for newcomers to yoga practice."),
        ("Breaking: Record Heat Wave Approaching",  "weather",       "Prepare for record temperatures across the nation."),
        ("Streaming Wars: Which Service Wins?",     "entertainment", "Comparing content libraries and pricing across platforms."),
    ]
    articles: List[dict] = []
    embs: List[np.ndarray] = []
    for idx, (title, cat, abstract) in enumerate(synthetic):
        embs.append(_deterministic_embedding(f"{title} {abstract} {cat}", dim))
        articles.append({
            "id": idx, "news_id": f"SYN{idx:04d}",
            "title": title, "abstract": abstract,
            "category": cat, "subcategory": "",
            "icon": CATEGORY_ICONS.get(cat, "📄"),
            "color": CATEGORY_COLORS.get(cat, "#7c5cff"),
            "mood_affinity": CATEGORY_MOOD_MAP.get(cat, {
                "happy": 0.5, "relaxed": 0.5, "focused": 0.5,
                "stressed": 0.3, "sad": 0.3, "energetic": 0.5,
            }),
        })

    while len(articles) < count:
        src = random.randint(0, len(synthetic) - 1)
        art = articles[src].copy()
        art["id"] = len(articles)
        articles.append(art)
        embs.append(embs[src].copy())

    print(f"[OK] Generated {min(count, len(articles))} synthetic articles")
    return articles[:count], np.array(embs[:count], dtype=np.float32)
