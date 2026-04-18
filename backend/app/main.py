"""
Hyper-Personalization Engine — FastAPI Backend
===============================================
RL-powered real-time news recommendation with:
  • Per-user history embeddings fed into context (fills [22:32])
  • Diversity-aware top-K selection (≥4 different categories)
  • Pre-trained user personas for instant demo personalization
  • Category preference tracking per user
  • Cold-start vs warm-user demonstration
"""

import os
import random
import time
from typing import Dict, List, Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.data_loader import load_mind_articles, CATEGORY_MOOD_MAP, CATEGORY_COLORS
from app.rl_agent import RLAgent

# ──────────────────────────────────────────────────────────────
# App init
# ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Hyper-Personalization Engine",
    description="RL-powered real-time news recommendation system",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# Data & agent
# ──────────────────────────────────────────────────────────────
DATA_DIR       = os.path.join(os.path.dirname(__file__), "..", "data")
EMBEDDING_DIM  = 64
CONTEXT_DIM    = 32
MAX_ARTICLES   = 250

ARTICLES, ARTICLE_EMBEDDINGS_NP = load_mind_articles(
    data_dir=DATA_DIR, max_articles=MAX_ARTICLES, embedding_dim=EMBEDDING_DIM,
)
CANDIDATE_EMBEDDINGS = torch.FloatTensor(ARTICLE_EMBEDDINGS_NP)

agent = RLAgent(
    context_dim=CONTEXT_DIM,
    action_dim=EMBEDDING_DIM,
    lr=5e-4,
    epsilon_start=0.8,
    epsilon_min=0.05,
    epsilon_decay=0.97,
    batch_size=32,
    replay_capacity=5_000,
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "trained_agent.pt")
if os.path.exists(MODEL_PATH):
    ckpt = torch.load(MODEL_PATH, map_location=agent.device, weights_only=True)
    agent.policy_net.load_state_dict(ckpt["policy_net"])
    agent.target_net.load_state_dict(ckpt["target_net"])
    agent.optimizer.load_state_dict(ckpt["optimizer"])
    agent.epsilon       = ckpt.get("epsilon", 0.1)
    agent.total_steps   = ckpt.get("total_steps", 0)
    agent.total_reward  = ckpt.get("total_reward", 0.0)
    print(f"[OK] Loaded model  ε={agent.epsilon:.4f}  steps={agent.total_steps}")
else:
    print("[INFO] No pre-trained model — starting fresh.")

# ──────────────────────────────────────────────────────────────
# Per-user in-memory state
# ──────────────────────────────────────────────────────────────
user_context_cache:        Dict[str, np.ndarray]         = {}
user_history:              Dict[str, List[dict]]          = {}
user_clicked_embeddings:   Dict[str, List[np.ndarray]]   = {}   # for context [22:32]
user_category_preferences: Dict[str, Dict[str, float]]   = {}

# ──────────────────────────────────────────────────────────────
# Persona definitions
# ──────────────────────────────────────────────────────────────
PERSONAS = [
    {
        "id": "alex",
        "name": "Alex Chen",
        "emoji": "⚽",
        "title": "Sports Fanatic",
        "description": "Follows every game — football, F1, basketball. Loves stats & analysis.",
        "interests": ["sports", "entertainment", "health"],
        "default_mood": "energetic",
        "default_bpm": 85,
        "default_noise": 45,
        "default_time": "Evening",
        "default_speed": "fast",
        "color": "#ff6b6b",
    },
    {
        "id": "sam",
        "name": "Sam Rivera",
        "emoji": "💼",
        "title": "Finance Analyst",
        "description": "Always tracking markets, earnings, and macroeconomic trends.",
        "interests": ["finance", "news", "northamerica"],
        "default_mood": "focused",
        "default_bpm": 68,
        "default_noise": 20,
        "default_time": "Morning",
        "default_speed": "slow",
        "color": "#00d4ff",
    },
    {
        "id": "jamie",
        "name": "Jamie Park",
        "emoji": "🌿",
        "title": "Wellness Guru",
        "description": "Health-conscious — fitness routines, nutritious recipes, and mindfulness.",
        "interests": ["health", "lifestyle", "foodanddrink"],
        "default_mood": "relaxed",
        "default_bpm": 62,
        "default_noise": 25,
        "default_time": "Morning",
        "default_speed": "medium",
        "color": "#00e88f",
    },
    {
        "id": "taylor",
        "name": "Taylor Kim",
        "emoji": "🎬",
        "title": "Entertainment Buff",
        "description": "Pop-culture obsessed — movies, TV shows, music releases, celeb news.",
        "interests": ["entertainment", "movies", "tv", "music"],
        "default_mood": "happy",
        "default_bpm": 75,
        "default_noise": 50,
        "default_time": "Evening",
        "default_speed": "medium",
        "color": "#ffb347",
    },
    {
        "id": "morgan",
        "name": "Morgan Wells",
        "emoji": "✈️",
        "title": "Travel Explorer",
        "description": "Always planning the next adventure — destinations, food tourism, culture.",
        "interests": ["travel", "foodanddrink", "lifestyle"],
        "default_mood": "happy",
        "default_bpm": 70,
        "default_noise": 35,
        "default_time": "Afternoon",
        "default_speed": "medium",
        "color": "#a78bfa",
    },
    {
        "id": "riley",
        "name": "Riley Zhang",
        "emoji": "📰",
        "title": "News Junkie",
        "description": "Keeps up with global events, politics, and investigative journalism.",
        "interests": ["news", "middleeast", "northamerica"],
        "default_mood": "focused",
        "default_bpm": 72,
        "default_noise": 30,
        "default_time": "Morning",
        "default_speed": "fast",
        "color": "#7c5cff",
    },
]
PERSONA_MAP = {p["id"]: p for p in PERSONAS}


def _persona_user_id(persona_id: str) -> str:
    return f"persona_{persona_id}"


def _initialize_persona(persona: dict) -> None:
    """Pre-warm a persona's history with articles from their preferred categories."""
    pid = _persona_user_id(persona["id"])
    if pid in user_history and len(user_history[pid]) >= 10:
        return  # already initialized

    user_history[pid] = []
    user_clicked_embeddings[pid] = []
    user_category_preferences[pid] = {}

    # Collect articles from preferred categories
    preferred: List[dict] = []
    for interest in persona["interests"]:
        cat_arts = [a for a in ARTICLES if a["category"] == interest]
        preferred.extend(cat_arts[:12])

    rng = random.Random(42)
    rng.shuffle(preferred)
    clicks = preferred[:20]

    for art in clicks:
        user_history[pid].append({
            "title":           art["title"][:60],
            "category":        art["category"],
            "icon":            art.get("icon", ""),
            "action":          "like",
            "reward":          1.0,
            "dwell_time":      28,
            "interaction_num": len(user_history[pid]) + 1,
        })
        user_clicked_embeddings[pid].append(ARTICLE_EMBEDDINGS_NP[art["id"]].copy())
        cat = art["category"]
        user_category_preferences[pid][cat] = user_category_preferences[pid].get(cat, 0) + 1.5

    print(f"[OK] Initialized persona '{persona['id']}' with {len(clicks)} pre-loaded interactions")


# Pre-warm all personas at startup
for _p in PERSONAS:
    _initialize_persona(_p)

# ──────────────────────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────────────────────
class ContextPayload(BaseModel):
    user_id:          str           = Field(..., description="Unique user identifier")
    mood:             str           = Field(..., description="happy/sad/relaxed/stressed/focused/energetic")
    bpm:              int           = Field(ge=40, le=200)
    ambient_noise:    int           = Field(ge=0, le=120)
    time_of_day:      str           = Field(..., description="Morning/Afternoon/Evening/Night")
    reading_speed:    Optional[str] = Field(default="medium", description="slow/medium/fast")
    session_duration: Optional[int] = Field(default=0)


class FeedbackPayload(BaseModel):
    user_id:    str
    article_id: int   = Field(ge=0)
    action:     str   = Field(..., description="read/skip/like/dislike")
    dwell_time: Optional[float] = Field(default=0.0)


class SwitchPersonaPayload(BaseModel):
    persona_id: str
    user_id:    str


# ──────────────────────────────────────────────────────────────
# Context encoding  (32-dim)
# ──────────────────────────────────────────────────────────────
MOOD_ENC  = {"happy":[1,0,0,0,0,0],"sad":[0,1,0,0,0,0],"relaxed":[0,0,1,0,0,0],
             "stressed":[0,0,0,1,0,0],"focused":[0,0,0,0,1,0],"energetic":[0,0,0,0,0,1]}
TIME_ENC  = {"Morning":[1,0,0,0],"Afternoon":[0,1,0,0],"Evening":[0,0,1,0],"Night":[0,0,0,1]}
SPEED_ENC = {"slow":[1,0,0],"medium":[0,1,0],"fast":[0,0,1]}


def encode_context(payload: ContextPayload) -> np.ndarray:
    """
    32-dim context vector:
      [0:6]   Mood one-hot
      [6:10]  Time-of-day one-hot
      [10:13] Reading speed one-hot
      [13]    BPM / 200
      [14]    Ambient noise / 120
      [15]    Session duration / 120
      [16:22] Cross-features: mood × BPM factor
      [22:32] User history embedding (mean of recent clicked articles → 10D)
    """
    vec = np.zeros(CONTEXT_DIM, dtype=np.float32)

    mood_vec = MOOD_ENC.get(payload.mood.lower(), [0]*6)
    vec[0:6]  = mood_vec
    vec[6:10] = TIME_ENC.get(payload.time_of_day, [0.25]*4)
    vec[10:13]= SPEED_ENC.get((payload.reading_speed or "medium").lower(), [0,1,0])
    vec[13]   = payload.bpm / 200.0
    vec[14]   = payload.ambient_noise / 120.0
    vec[15]   = min(payload.session_duration or 0, 120) / 120.0

    bpm_factor = payload.bpm / 200.0
    for i in range(6):
        vec[16 + i] = mood_vec[i] * bpm_factor

    # User history embedding: compress mean of last-15 clicked articles to 10D
    clicked = user_clicked_embeddings.get(payload.user_id, [])
    if clicked:
        recent  = np.array(clicked[-15:])          # (≤15, 64)
        avg_emb = np.mean(recent, axis=0)           # (64,)
        chunk   = EMBEDDING_DIM // 10
        for i in range(10):
            vec[22 + i] = float(np.mean(avg_emb[i * chunk : (i + 1) * chunk]))

    return vec


# ──────────────────────────────────────────────────────────────
# Reward shaping
# ──────────────────────────────────────────────────────────────
def compute_reward(action: str, dwell_time: float = 0.0) -> float:
    base = {"like": 1.0, "read": 0.5, "skip": -0.3, "dislike": -1.0}
    reward = base.get(action, 0.0)
    if action == "read" and dwell_time > 0:
        reward += min(dwell_time / 30.0, 0.5)
    return reward


# ──────────────────────────────────────────────────────────────
# Diversity-aware top-K selection
# ──────────────────────────────────────────────────────────────
def _diversify(candidates: List[dict], n: int = 8) -> List[dict]:
    """Greedy diversity: guarantee at most 2 articles per category in top-n."""
    if len(candidates) <= n:
        return candidates
    selected: List[dict] = []
    cat_count: Dict[str, int] = {}
    remaining = list(candidates)
    # First pass: fill with diversity
    for art in remaining[:]:
        cat = art["category"]
        if cat_count.get(cat, 0) < 2:
            selected.append(art)
            cat_count[cat] = cat_count.get(cat, 0) + 1
            remaining.remove(art)
        if len(selected) >= n:
            break
    # Fill remainder if needed
    for art in remaining:
        if len(selected) >= n:
            break
        selected.append(art)
    return selected[:n]


# ──────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "articles_loaded": len(ARTICLES),
        "agent_epsilon":   agent.epsilon,
        "device":          str(agent.device),
        "personas":        len(PERSONAS),
    }


def _context_boost(bpm: int, noise: int, time_of_day: str) -> Dict[str, float]:
    """
    Deterministic per-category boost derived from BPM, ambient noise, and time.
    This makes context sliders immediately affect rankings without needing training.
    """
    boost: Dict[str, float] = {}

    # BPM → energy level
    if bpm >= 90:          # High energy / workout
        for c in ["sports", "entertainment", "music"]: boost[c] = boost.get(c, 0) + 0.25
    elif bpm >= 75:        # Moderate energy
        for c in ["news", "finance", "autos"]:         boost[c] = boost.get(c, 0) + 0.12
    else:                  # Calm / low heart rate
        for c in ["health", "lifestyle", "foodanddrink", "travel"]: boost[c] = boost.get(c, 0) + 0.20

    # Ambient noise → focus vs passive consumption
    if noise <= 25:        # Quiet — deep focus
        for c in ["finance", "news", "health", "middleeast", "northamerica"]: boost[c] = boost.get(c, 0) + 0.20
    elif noise >= 60:      # Noisy — passive / light content
        for c in ["entertainment", "tv", "movies", "music", "kids"]: boost[c] = boost.get(c, 0) + 0.20

    # Time of day → natural reading habits
    tod = time_of_day.lower()
    if tod == "morning":
        for c in ["news", "finance", "health"]:              boost[c] = boost.get(c, 0) + 0.18
    elif tod == "afternoon":
        for c in ["sports", "autos", "northamerica"]:        boost[c] = boost.get(c, 0) + 0.12
    elif tod == "evening":
        for c in ["entertainment", "tv", "movies", "music"]: boost[c] = boost.get(c, 0) + 0.18
    elif tod == "night":
        for c in ["lifestyle", "foodanddrink", "travel"]:    boost[c] = boost.get(c, 0) + 0.18

    return boost


@app.post("/recommend")
async def get_recommendations(context: ContextPayload):
    """
    Blended ranking:
      40% mood + context boost  (immediate effect, no training needed)
      35% RL agent Q-value rank (learned user preference)
      25% per-user category pref (click history)
    This ensures mood-relevant articles are always near the top while
    the RL agent's learning still shifts rankings over time.
    """
    start = time.time()

    ctx_vec    = encode_context(context)
    ctx_tensor = torch.FloatTensor(ctx_vec).unsqueeze(0)
    user_context_cache[context.user_id] = ctx_vec.copy()

    top_indices = agent.recommend(ctx_tensor, CANDIDATE_EMBEDDINGS, top_k=40)
    n_candidates = len(top_indices)

    mood       = context.mood.lower()
    ctx_boosts = _context_boost(context.bpm, context.ambient_noise, context.time_of_day)
    user_prefs = user_category_preferences.get(context.user_id, {})
    max_pref   = max(user_prefs.values(), default=1.0) or 1.0

    candidates: List[dict] = []
    for rl_rank, idx in enumerate(top_indices):
        idx = int(idx)
        if idx >= len(ARTICLES):
            continue
        art = ARTICLES[idx].copy()
        cat = art["category"]

        # 1. Mood + context score (deterministic)
        base_mood    = art.get("mood_affinity", {}).get(mood, 0.5)
        context_bump = ctx_boosts.get(cat, 0.0)
        mood_score   = min(1.0, base_mood + context_bump)

        # 2. RL agent rank score (0 = last, 1 = first)
        rl_score = 1.0 - (rl_rank / max(n_candidates, 1))

        # 3. Learned user preference score
        pref_raw  = user_prefs.get(cat, 0.0)
        pref_score = min(1.0, max(0.0, pref_raw / max_pref)) if pref_raw > 0 else 0.0

        # Blended final score
        blend = 0.40 * mood_score + 0.35 * rl_score + 0.25 * pref_score

        art["mood_relevance"] = round(mood_score, 2)
        art["_blend"]         = blend
        candidates.append(art)

    # Sort by blended score before diversity filter
    candidates.sort(key=lambda x: x["_blend"], reverse=True)

    recommended = _diversify(candidates, n=16)
    for rank, art in enumerate(recommended):
        art["rank"] = rank + 1
        art.pop("_blend", None)

    elapsed = round((time.time() - start) * 1000, 1)
    return {
        "status":           "success",
        "recommendations":  recommended,
        "latency_ms":       elapsed,
        "exploration_rate": round(agent.epsilon, 4),
        "context_used": {
            "mood":        context.mood,
            "bpm":         context.bpm,
            "time":        context.time_of_day,
            "noise":       context.ambient_noise,
            "history_len": len(user_clicked_embeddings.get(context.user_id, [])),
        },
    }


@app.post("/feedback")
async def process_feedback(feedback: FeedbackPayload):
    """Train agent online and update per-user preference state."""
    if feedback.article_id >= len(ARTICLES):
        raise HTTPException(status_code=404, detail="Article not found")

    ctx_vec     = user_context_cache.get(feedback.user_id,
                     np.random.randn(CONTEXT_DIM).astype(np.float32))
    article     = ARTICLES[feedback.article_id]
    art_emb     = ARTICLE_EMBEDDINGS_NP[feedback.article_id]
    reward      = compute_reward(feedback.action, feedback.dwell_time or 0.0)
    info        = agent.update(ctx_vec, art_emb, reward)
    agent.action_counts[feedback.article_id] = agent.action_counts.get(feedback.article_id, 0) + 1

    # Track clicked embeddings (for user history in context)
    if feedback.action in ("like", "read"):
        uid_embs = user_clicked_embeddings.setdefault(feedback.user_id, [])
        uid_embs.append(art_emb.copy())

    # Track category preferences
    prefs = user_category_preferences.setdefault(feedback.user_id, {})
    cat   = article["category"]
    delta = {"like": 1.5, "read": 0.8, "skip": -0.3, "dislike": -1.2}.get(feedback.action, 0)
    prefs[cat] = round(prefs.get(cat, 0) + delta, 3)

    # Session history
    hist = user_history.setdefault(feedback.user_id, [])
    hist.append({
        "title":           article["title"][:60],
        "category":        article["category"],
        "icon":            article.get("icon", ""),
        "color":           article.get("color", "#7c5cff"),
        "action":          feedback.action,
        "reward":          reward,
        "dwell_time":      feedback.dwell_time or 0,
        "interaction_num": len(hist) + 1,
    })

    return {
        "status":         "learned",
        "reward_given":   reward,
        "action":         feedback.action,
        "agent_info":     info,
        "history_length": len(hist),
    }


@app.get("/stats")
async def get_agent_stats():
    return {"status": "success", "stats": agent.get_stats(), "articles_count": len(ARTICLES)}


@app.post("/cold-start")
async def cold_start_reset(payload: dict):
    uid = payload.get("user_id", "new_user")
    agent.reset_for_cold_start()
    user_history[uid]              = []
    user_clicked_embeddings[uid]   = []
    user_category_preferences[uid] = {}
    user_context_cache.pop(uid, None)
    return {
        "status":  "cold_start_activated",
        "epsilon": agent.epsilon,
        "message": "Agent reset to full exploration mode.",
    }


@app.get("/history/{user_id}")
async def get_user_history(user_id: str):
    history = user_history.get(user_id, [])
    return {"status": "success", "user_id": user_id,
            "history": history, "total_interactions": len(history)}


@app.get("/preferences/{user_id}")
async def get_user_preferences(user_id: str):
    prefs = user_category_preferences.get(user_id, {})
    sorted_prefs = dict(sorted(prefs.items(), key=lambda x: x[1], reverse=True))
    return {"status": "success", "user_id": user_id, "preferences": sorted_prefs}


@app.get("/personas")
async def list_personas():
    result = []
    for p in PERSONAS:
        pid = _persona_user_id(p["id"])
        result.append({
            **{k: v for k, v in p.items() if k not in ("interests",)},
            "history_count": len(user_history.get(pid, [])),
        })
    return {"status": "success", "personas": result}


@app.post("/switch-persona")
async def switch_persona(payload: SwitchPersonaPayload):
    persona = PERSONA_MAP.get(payload.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail=f"Persona '{payload.persona_id}' not found")

    pid = _persona_user_id(persona["id"])
    _initialize_persona(persona)  # idempotent — skips if already done

    # Copy persona state into the requesting user_id
    user_history[payload.user_id]              = list(user_history.get(pid, []))
    user_clicked_embeddings[payload.user_id]   = list(user_clicked_embeddings.get(pid, []))
    user_category_preferences[payload.user_id] = dict(user_category_preferences.get(pid, {}))

    # Lower epsilon so persona feels "already trained"
    agent.epsilon = max(agent.epsilon_min, min(agent.epsilon, 0.15))

    return {
        "status":        "success",
        "persona":       {k: v for k, v in persona.items() if k not in ("interests",)},
        "history_count": len(user_history[payload.user_id]),
        "preferences":   user_category_preferences[payload.user_id],
        "default_context": {
            "user_id":          payload.user_id,
            "mood":             persona["default_mood"],
            "bpm":              persona["default_bpm"],
            "ambient_noise":    persona["default_noise"],
            "time_of_day":      persona["default_time"],
            "reading_speed":    persona["default_speed"],
            "session_duration": 0,
        },
    }


@app.get("/articles")
async def get_all_articles():
    categories: Dict[str, int] = {}
    for art in ARTICLES:
        categories[art["category"]] = categories.get(art["category"], 0) + 1
    return {"status": "success", "total": len(ARTICLES),
            "categories": categories, "articles": ARTICLES}
