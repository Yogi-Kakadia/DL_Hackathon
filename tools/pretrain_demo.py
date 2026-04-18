"""
pretrain_demo.py
================
Pre-trains the RL agent on synthetic interaction data so the model is
demo-ready before any real users interact with the system.

Usage (from repo root):
    python tools/pretrain_demo.py

What it does:
  1. Reads data/synthetic/synthetic_interactions.csv
  2. Builds a 32-D context vector for every row
  3. Derives a 64-D article embedding from the category string
  4. Calls agent.update(ctx, art_emb, reward, next_ctx) for each row
  5. Saves the trained model to backend/model/trained_agent.pt

Context vector layout (32D):
  [0:6]   mood        (6D one-hot)
  [6:10]  time_of_day (4D one-hot)
  [10:13] reading_speed (3D one-hot, medium default)
  [13]    bpm_norm    (scalar, default 0.35)
  [14]    noise_norm  (scalar, default 0.33)
  [15]    session_pos (scalar, default 0.10)
  [16:22] padding     (zeros)
  [22:32] history_emb (10D rolling history, zeros for synthetic data)
"""

import csv
import os
import sys

import numpy as np
import torch

# ── Path setup — must come before any app imports ──────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.rl_agent import RLAgent                           # noqa: E402
from app.data_loader import _deterministic_embedding       # noqa: E402

# ──────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────
INTERACTIONS_CSV = os.path.join(
    os.path.dirname(__file__), "..", "data", "synthetic", "synthetic_interactions.csv"
)
MODEL_OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "backend", "model")
MODEL_OUTPUT_PATH = os.path.join(MODEL_OUTPUT_DIR, "trained_agent.pt")

# ──────────────────────────────────────────────────────────────
# Context encoding helpers
# ──────────────────────────────────────────────────────────────
MOOD_ENCODINGS = {
    "happy":    [1, 0, 0, 0, 0, 0],
    "sad":      [0, 1, 0, 0, 0, 0],
    "relaxed":  [0, 0, 1, 0, 0, 0],
    "stressed": [0, 0, 0, 1, 0, 0],
    "focused":  [0, 0, 0, 0, 1, 0],
    "energetic":[0, 0, 0, 0, 0, 1],
}

TIME_ENCODINGS = {
    "Morning":   [1, 0, 0, 0],
    "Afternoon": [0, 1, 0, 0],
    "Evening":   [0, 0, 1, 0],
    "Night":     [0, 0, 0, 1],
}

SPEED_ENCODINGS = {
    "slow":   [1, 0, 0],
    "medium": [0, 1, 0],
    "fast":   [0, 0, 1],
}

# Default scalar biometrics (normalised to [0, 1])
DEFAULT_BPM_NORM   = 0.35   # ~70 bpm
DEFAULT_NOISE_NORM = 0.33   # ~33 dB (quiet)
DEFAULT_SESSION    = 0.10   # early in session


def build_context_vector(
    mood: str,
    time_of_day: str,
    reading_speed: str = "medium",
    bpm_norm: float = DEFAULT_BPM_NORM,
    noise_norm: float = DEFAULT_NOISE_NORM,
    session_pos: float = DEFAULT_SESSION,
    context_dim: int = 32,
) -> np.ndarray:
    """
    Assemble a 32-D context vector matching the layout expected by the
    backend's build_context_vector function in main.py.

    Layout:
      [0:6]   mood one-hot      (6D)
      [6:10]  time_of_day       (4D)
      [10:13] reading_speed     (3D)
      [13]    bpm_norm
      [14]    noise_norm
      [15]    session_pos
      [16:22] padding zeros     (6D)
      [22:32] history embedding (10D — zeros for synthetic data)
    """
    ctx = np.zeros(context_dim, dtype=np.float32)

    # Mood (6D one-hot)
    mood_vec = MOOD_ENCODINGS.get(mood, MOOD_ENCODINGS["focused"])
    ctx[0:6] = mood_vec

    # Time of day (4D one-hot)
    time_vec = TIME_ENCODINGS.get(time_of_day, TIME_ENCODINGS["Morning"])
    ctx[6:10] = time_vec

    # Reading speed (3D one-hot)
    speed_vec = SPEED_ENCODINGS.get(reading_speed, SPEED_ENCODINGS["medium"])
    ctx[10:13] = speed_vec

    # Scalar biometrics
    ctx[13] = bpm_norm
    ctx[14] = noise_norm
    ctx[15] = session_pos

    # Indices 16-21 stay zero (padding)
    # Indices 22-31 stay zero (history — not available for synthetic data)

    return ctx


# ──────────────────────────────────────────────────────────────
# Main pre-training routine
# ──────────────────────────────────────────────────────────────
def main():
    # ── Validate data file ────────────────────────────────────
    if not os.path.exists(INTERACTIONS_CSV):
        print(
            f"[ERROR] Interactions CSV not found at:\n  {INTERACTIONS_CSV}\n"
            "Run  python tools/generate_synthetic_data.py  first."
        )
        sys.exit(1)

    # ── Load CSV ───────────────────────────────────────────────
    rows = []
    with open(INTERACTIONS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"[INFO] Loaded {len(rows)} interactions from {INTERACTIONS_CSV}")

    # ── Initialise RL agent ───────────────────────────────────
    agent = RLAgent(
        context_dim=32,
        action_dim=64,
        lr=5e-4,
        epsilon_start=0.8,
        epsilon_min=0.05,
        epsilon_decay=0.97,
        batch_size=32,
        replay_capacity=5000,
    )

    print(f"[INFO] Agent initialised on device: {agent.device}")
    print(f"[INFO] Starting pre-training over {len(rows)} interactions …\n")

    total_reward = 0.0

    for i, row in enumerate(rows):
        # ── Build context vector ───────────────────────────────
        mood        = row.get("mood", "focused")
        time_of_day = row.get("time_of_day", "Morning")

        # session_pos: normalise interaction_num within reasonable range
        try:
            session_pos = min(float(row.get("interaction_num", 1)) / 15.0, 1.0)
        except (ValueError, TypeError):
            session_pos = DEFAULT_SESSION

        ctx_vec = build_context_vector(
            mood=mood,
            time_of_day=time_of_day,
            reading_speed="medium",           # not stored in CSV, use default
            bpm_norm=DEFAULT_BPM_NORM,
            noise_norm=DEFAULT_NOISE_NORM,
            session_pos=session_pos,
        )

        # ── Article embedding ─────────────────────────────────
        category   = row.get("article_category", "news")
        art_text   = f"{category} news article"
        art_emb    = _deterministic_embedding(art_text, dim=64)

        # ── Reward ────────────────────────────────────────────
        try:
            reward = float(row.get("reward", 0.0))
        except (ValueError, TypeError):
            reward = 0.0

        total_reward += reward

        # ── Update agent  (ctx as both current and next ctx) ──
        info = agent.update(
            context=ctx_vec,
            action=art_emb,
            reward=reward,
            next_context=ctx_vec,   # synthetic data has no true s', reuse s
        )

        # ── Progress logging every 100 rows ───────────────────
        if (i + 1) % 100 == 0:
            print(
                f"  Step {i+1:>4}/{len(rows)} | "
                f"loss={info['loss']:.6f} | "
                f"epsilon={info['epsilon']:.4f} | "
                f"buffer={info['buffer_size']:>4} | "
                f"avg_reward={total_reward / (i + 1):.4f}"
            )

    # ── Save model ────────────────────────────────────────────
    os.makedirs(MODEL_OUTPUT_DIR, exist_ok=True)
    torch.save(
        {
            "policy_net":   agent.policy_net.state_dict(),
            "target_net":   agent.target_net.state_dict(),
            "optimizer":    agent.optimizer.state_dict(),
            "epsilon":      agent.epsilon,
            "total_steps":  agent.total_steps,
            "total_reward": agent.total_reward,
        },
        MODEL_OUTPUT_PATH,
    )
    print(f"\n[OK] Model saved → {MODEL_OUTPUT_PATH}")

    # ── Final stats ───────────────────────────────────────────
    stats = agent.get_stats()
    print("\n" + "=" * 50)
    print("PRE-TRAINING COMPLETE")
    print("=" * 50)
    print(f"  Total interactions : {len(rows)}")
    print(f"  Total reward       : {total_reward:.4f}")
    print(f"  Avg reward         : {total_reward / max(1, len(rows)):.4f}")
    print(f"  Final epsilon      : {stats['epsilon']:.4f}")
    print(f"  Replay buffer size : {stats['buffer_size']}")
    print(f"  Avg loss (last 50) : {stats['avg_loss']:.6f}")
    print(f"  Cold-start mode    : {stats['is_cold_start']}")
    print("=" * 50)
    print("\nModel is ready. Start the backend and load it with:")
    print("  uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
