"""
Hyper-Personalization Engine — FastAPI Backend
===============================================
Real-time content recommendation API powered by an RL-based brain.

Endpoints:
  POST /recommend    — Get personalized article recommendations
  POST /feedback     — Submit user feedback (read/skip/like/dislike)
  GET  /stats        — Get RL agent training statistics
  GET  /articles     — Browse full article catalog
  GET  /health       — Health check
"""

import os
import time
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.data_loader import load_mind_articles, CATEGORY_MOOD_MAP
from app.rl_agent import RLAgent

# ──────────────────────────────────────────────────────────────
# APP INITIALIZATION
# ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Hyper-Personalization Engine",
    description="RL-powered real-time content recommendation system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# LOAD DATA & INIT AGENT
# ──────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EMBEDDING_DIM = 64
CONTEXT_DIM = 32  # richer context encoding

# Load MIND articles
ARTICLES, ARTICLE_EMBEDDINGS_NP = load_mind_articles(
    data_dir=DATA_DIR,
    max_articles=150,
    embedding_dim=EMBEDDING_DIM,
)
CANDIDATE_EMBEDDINGS = torch.FloatTensor(ARTICLE_EMBEDDINGS_NP)

# Initialize the RL Brain
agent = RLAgent(
    context_dim=CONTEXT_DIM,
    action_dim=EMBEDDING_DIM,
    lr=3e-4,
    epsilon_start=0.8,
    epsilon_min=0.05,
    epsilon_decay=0.992,
    batch_size=32,
    replay_capacity=5000,
)

# Load pre-trained model if available
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "trained_agent.pt")
if os.path.exists(MODEL_PATH):
    checkpoint = torch.load(MODEL_PATH, map_location=agent.device, weights_only=True)
    agent.policy_net.load_state_dict(checkpoint["policy_net"])
    agent.target_net.load_state_dict(checkpoint["target_net"])
    agent.optimizer.load_state_dict(checkpoint["optimizer"])
    agent.epsilon = checkpoint.get("epsilon", 0.1)
    agent.total_steps = checkpoint.get("total_steps", 0)
    agent.total_reward = checkpoint.get("total_reward", 0.0)
    print(f"[OK] Loaded pre-trained model (epsilon={agent.epsilon:.4f}, steps={agent.total_steps})")
else:
    print("[INFO] No pre-trained model found, starting fresh.")

# Track per-user contexts for proper feedback attribution
user_context_cache: dict = {}

# Track per-user click history for the UI
user_history: dict = {}  # {user_id: [{article_title, category, action, reward, timestamp}, ...]}


# ──────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ──────────────────────────────────────────────────────────────
class ContextPayload(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    mood: str = Field(..., description="Current mood: happy, sad, relaxed, stressed, focused, energetic")
    bpm: int = Field(ge=40, le=200, description="Heart rate BPM")
    ambient_noise: int = Field(ge=0, le=120, description="Ambient noise in dB")
    time_of_day: str = Field(..., description="Morning, Afternoon, Evening, or Night")
    reading_speed: Optional[str] = Field(default="medium", description="slow, medium, fast")
    session_duration: Optional[int] = Field(default=0, description="Minutes spent in session")


class FeedbackPayload(BaseModel):
    user_id: str
    article_id: int = Field(ge=0, description="Article index")
    action: str = Field(..., description="read, skip, like, dislike")
    dwell_time: Optional[float] = Field(default=0.0, description="Seconds spent on article")


# ──────────────────────────────────────────────────────────────
# CONTEXT ENCODING — Converts UI signals → 32D tensor
# ──────────────────────────────────────────────────────────────
MOOD_ENCODING = {
    "happy":     [1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    "sad":       [0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
    "relaxed":   [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    "stressed":  [0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    "focused":   [0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
    "energetic": [0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
}

TIME_ENCODING = {
    "Morning":   [1.0, 0.0, 0.0, 0.0],
    "Afternoon": [0.0, 1.0, 0.0, 0.0],
    "Evening":   [0.0, 0.0, 1.0, 0.0],
    "Night":     [0.0, 0.0, 0.0, 1.0],
}

SPEED_ENCODING = {
    "slow":   [1.0, 0.0, 0.0],
    "medium": [0.0, 1.0, 0.0],
    "fast":   [0.0, 0.0, 1.0],
}


def encode_context(payload: ContextPayload) -> np.ndarray:
    """
    Encode the multimodal context into a 32-dimensional vector:
      • [0:6]   Mood one-hot (6D)
      • [6:10]  Time-of-day one-hot (4D)
      • [10:13] Reading speed one-hot (3D)
      • [13]    Normalized BPM
      • [14]    Normalized ambient noise
      • [15]    Normalized session duration
      • [16:22] Cross-features: mood × BPM interaction
      • [22:32] Reserved for user history embedding (zeros for cold start)
    """
    vec = np.zeros(CONTEXT_DIM, dtype=np.float32)

    # Mood one-hot
    mood_vec = MOOD_ENCODING.get(payload.mood.lower(), [0.0] * 6)
    vec[0:6] = mood_vec

    # Time one-hot
    time_vec = TIME_ENCODING.get(payload.time_of_day, [0.25] * 4)
    vec[6:10] = time_vec

    # Speed one-hot
    speed_vec = SPEED_ENCODING.get(
        (payload.reading_speed or "medium").lower(), [0.0, 1.0, 0.0]
    )
    vec[10:13] = speed_vec

    # Continuous features (normalized)
    vec[13] = payload.bpm / 200.0
    vec[14] = payload.ambient_noise / 120.0
    vec[15] = min(payload.session_duration or 0, 120) / 120.0

    # Cross-features: mood intensity modulated by physiological state
    bpm_factor = payload.bpm / 200.0
    for i in range(6):
        vec[16 + i] = mood_vec[i] * bpm_factor

    # [22:32] reserved for user history — zeros = cold start

    return vec


# ──────────────────────────────────────────────────────────────
# REWARD SHAPING
# ──────────────────────────────────────────────────────────────
def compute_reward(action: str, dwell_time: float = 0.0) -> float:
    """
    Nuanced reward signal:
      • like   → +1.0
      • read   → +0.5 base, up to +1.0 with dwell time
      • skip   → -0.3
      • dislike→ -1.0
    """
    base_rewards = {
        "like": 1.0,
        "read": 0.5,
        "skip": -0.3,
        "dislike": -1.0,
    }
    reward = base_rewards.get(action, 0.0)

    # Dwell time bonus for reads (> 5s shows engagement)
    if action == "read" and dwell_time > 0:
        dwell_bonus = min(dwell_time / 30.0, 0.5)  # cap at 0.5 bonus
        reward += dwell_bonus

    return reward


# ──────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "articles_loaded": len(ARTICLES),
        "agent_epsilon": agent.epsilon,
        "device": str(agent.device),
    }


@app.post("/recommend")
async def get_recommendations(context: ContextPayload):
    """Get personalized article recommendations based on current context."""
    start = time.time()

    # 1. Encode context
    context_vec = encode_context(context)
    context_tensor = torch.FloatTensor(context_vec).unsqueeze(0)

    # Cache context for feedback attribution
    user_context_cache[context.user_id] = context_vec.copy()

    # 2. Ask the RL brain for top article indices
    top_indices = agent.recommend(
        context_tensor, CANDIDATE_EMBEDDINGS, top_k=8
    )

    # 3. Build response with mood-relevance scoring
    mood = context.mood.lower()
    recommended = []
    for rank, idx in enumerate(top_indices):
        idx = int(idx)
        if idx >= len(ARTICLES):
            continue
        article = ARTICLES[idx].copy()
        # Add mood-relevance score for UI display
        affinity = article.get("mood_affinity", {})
        article["mood_relevance"] = round(affinity.get(mood, 0.5), 2)
        article["rank"] = rank + 1
        recommended.append(article)

    elapsed = round((time.time() - start) * 1000, 1)

    return {
        "status": "success",
        "recommendations": recommended,
        "latency_ms": elapsed,
        "exploration_rate": round(agent.epsilon, 4),
        "context_used": {
            "mood": context.mood,
            "bpm": context.bpm,
            "time": context.time_of_day,
            "noise": context.ambient_noise,
        },
    }


@app.post("/feedback")
async def process_feedback(feedback: FeedbackPayload):
    """Process user feedback and train the RL agent online."""
    if feedback.article_id >= len(ARTICLES):
        raise HTTPException(status_code=404, detail="Article not found")

    # Retrieve cached context (or use random for cold start)
    context_vec = user_context_cache.get(
        feedback.user_id, np.random.randn(CONTEXT_DIM).astype(np.float32)
    )

    article_embedding = ARTICLE_EMBEDDINGS_NP[feedback.article_id]

    # Compute nuanced reward
    reward = compute_reward(feedback.action, feedback.dwell_time or 0.0)

    # Train the agent
    info = agent.update(context_vec, article_embedding, reward)

    # Track user click history
    article = ARTICLES[feedback.article_id]
    if feedback.user_id not in user_history:
        user_history[feedback.user_id] = []
    user_history[feedback.user_id].append({
        "title": article["title"][:60],
        "category": article["category"],
        "icon": article.get("icon", ""),
        "action": feedback.action,
        "reward": reward,
        "dwell_time": feedback.dwell_time or 0,
        "interaction_num": len(user_history[feedback.user_id]) + 1,
    })

    return {
        "status": "learned",
        "reward_given": reward,
        "action": feedback.action,
        "agent_info": info,
        "history_length": len(user_history[feedback.user_id]),
    }


@app.get("/stats")
async def get_agent_stats():
    """Dashboard data: RL agent performance metrics."""
    return {
        "status": "success",
        "stats": agent.get_stats(),
        "articles_count": len(ARTICLES),
    }


@app.post("/cold-start")
async def cold_start_reset(payload: dict):
    """Reset the agent to full exploration mode for new user demo."""
    user_id = payload.get("user_id", "new_user")

    # Reset agent to explore mode
    agent.reset_for_cold_start()

    # Clear this user's history
    user_history[user_id] = []
    user_context_cache.pop(user_id, None)

    return {
        "status": "cold_start_activated",
        "epsilon": agent.epsilon,
        "message": "Agent reset to full exploration. Recommendations will be diverse.",
    }


@app.get("/history/{user_id}")
async def get_user_history(user_id: str):
    """Return the click history for a user."""
    history = user_history.get(user_id, [])
    return {
        "status": "success",
        "user_id": user_id,
        "history": history,
        "total_interactions": len(history),
    }


@app.get("/articles")
async def get_all_articles():
    """Return the full article catalog for browsing."""
    categories = {}
    for art in ARTICLES:
        cat = art["category"]
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1

    return {
        "status": "success",
        "total": len(ARTICLES),
        "categories": categories,
        "articles": ARTICLES,
    }