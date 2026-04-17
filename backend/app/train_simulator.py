"""
Training & Evaluation Pipeline for the Hyper-Personalization Engine
====================================================================
Trains the RL agent on REAL user click data from the MIND dataset.

The MIND behaviors.tsv format:
  Column 0: Impression ID
  Column 1: User ID
  Column 2: Timestamp
  Column 3: Click History (space-separated news IDs the user clicked before)
  Column 4: Impressions (space-separated "NewsID-Label" pairs, 1=click 0=skip)

This script:
  1. Loads ALL news articles from news.tsv with embeddings
  2. Builds user profiles from their click history
  3. Trains the RL agent using real impression click/skip signals
  4. Evaluates on the dev set using standard metrics (AUC, NDCG, MRR)

Usage:
    cd backend/venv
    python -m app.train_simulator                      # train on MIND data
    python -m app.train_simulator --max-impressions 5000  # quick test
    python -m app.train_simulator --evaluate-only       # eval without training
"""

import argparse
import csv
import math
import os
import random
import sys
import time
from collections import defaultdict
from typing import Dict, List, Tuple

import numpy as np
import torch

from app.rl_agent import RLAgent
from app.data_loader import _deterministic_embedding, CATEGORY_MOOD_MAP, CATEGORY_ICONS


# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
CONTEXT_DIM = 32
EMBEDDING_DIM = 64
DATA_BASE = os.path.join(os.path.dirname(__file__), "..", "data")

MOOD_LIST = ["happy", "sad", "relaxed", "stressed", "focused", "energetic"]
TIME_LIST = ["Morning", "Afternoon", "Evening", "Night"]

MOOD_ENCODING = {
    "happy":     [1, 0, 0, 0, 0, 0],
    "sad":       [0, 1, 0, 0, 0, 0],
    "relaxed":   [0, 0, 1, 0, 0, 0],
    "stressed":  [0, 0, 0, 1, 0, 0],
    "focused":   [0, 0, 0, 0, 1, 0],
    "energetic": [0, 0, 0, 0, 0, 1],
}

TIME_ENCODING = {
    "Morning":   [1, 0, 0, 0],
    "Afternoon": [0, 1, 0, 0],
    "Evening":   [0, 0, 1, 0],
    "Night":     [0, 0, 0, 1],
}


# ──────────────────────────────────────────────────────────────
# 1. Load FULL news catalog
# ──────────────────────────────────────────────────────────────
def load_news_catalog(split: str = "train") -> Tuple[Dict, Dict]:
    """
    Load all articles from news.tsv into a dictionary keyed by news_id.

    Returns:
        news_dict: {news_id: {title, abstract, category, subcategory, ...}}
        news_embeddings: {news_id: np.ndarray of shape (EMBEDDING_DIM,)}
    """
    paths = {
        "train": os.path.join(DATA_BASE, "MINDlarge_train", "MINDlarge_train", "news.tsv"),
        "dev":   os.path.join(DATA_BASE, "MINDlarge_dev", "MINDlarge_dev", "news.tsv"),
        "test":  os.path.join(DATA_BASE, "MINDlarge_test", "MINDlarge_test", "news.tsv"),
    }
    news_path = paths.get(split)
    if not news_path or not os.path.exists(news_path):
        print(f"[ERROR] news.tsv not found for split '{split}' at {news_path}")
        sys.exit(1)

    print(f"[INFO] Loading news catalog from {split} split...")
    news_dict = {}
    news_embeddings = {}

    with open(news_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 4:
                continue
            news_id = row[0]
            category = row[1].lower() if row[1] else "unknown"
            subcategory = row[2].lower() if len(row) > 2 and row[2] else ""
            title = row[3].strip() if row[3] else ""
            abstract = row[4].strip() if len(row) > 4 and row[4] else ""

            if not title:
                continue

            news_dict[news_id] = {
                "news_id": news_id,
                "title": title,
                "abstract": abstract,
                "category": category,
                "subcategory": subcategory,
                "icon": CATEGORY_ICONS.get(category, ""),
            }

            embed_text = f"{title} {abstract} {category}"
            news_embeddings[news_id] = _deterministic_embedding(embed_text, EMBEDDING_DIM)

    print(f"[OK] Loaded {len(news_dict)} articles from {split} split")
    return news_dict, news_embeddings


# ──────────────────────────────────────────────────────────────
# 2. Load behaviors (real user interactions)
# ──────────────────────────────────────────────────────────────
def load_behaviors(split: str = "train", max_impressions: int = 0) -> List[dict]:
    """
    Parse behaviors.tsv into structured interaction records.

    Each record:
      {
        user_id, timestamp, hour,
        history: [news_ids user clicked before],
        impressions: [(news_id, label), ...],  # label: 1=click, 0=skip
      }
    """
    paths = {
        "train": os.path.join(DATA_BASE, "MINDlarge_train", "MINDlarge_train", "behaviors.tsv"),
        "dev":   os.path.join(DATA_BASE, "MINDlarge_dev", "MINDlarge_dev", "behaviors.tsv"),
        "test":  os.path.join(DATA_BASE, "MINDlarge_test", "MINDlarge_test", "behaviors.tsv"),
    }
    behavior_path = paths.get(split)
    if not behavior_path or not os.path.exists(behavior_path):
        print(f"[ERROR] behaviors.tsv not found for split '{split}'")
        sys.exit(1)

    print(f"[INFO] Loading behaviors from {split} split...")
    records = []
    count = 0

    with open(behavior_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 5:
                continue

            # Parse timestamp to extract hour
            timestamp_str = parts[2]
            try:
                hour = int(timestamp_str.split(" ")[1].split(":")[0])
            except (IndexError, ValueError):
                hour = 12

            # Parse click history
            history = parts[3].split(" ") if parts[3].strip() else []

            # Parse impressions: "N12345-1 N67890-0 ..."
            impressions = []
            for imp in parts[4].split(" "):
                if "-" in imp:
                    nid, label = imp.rsplit("-", 1)
                    try:
                        impressions.append((nid, int(label)))
                    except ValueError:
                        continue

            if not impressions:
                continue

            records.append({
                "user_id": parts[1],
                "timestamp": timestamp_str,
                "hour": hour,
                "history": history,
                "impressions": impressions,
            })

            count += 1
            if max_impressions > 0 and count >= max_impressions:
                break

    print(f"[OK] Loaded {len(records)} impression logs from {split} split")
    return records


# ──────────────────────────────────────────────────────────────
# 3. Build user context from their click history + timestamp
# ──────────────────────────────────────────────────────────────
def build_user_context(
    record: dict,
    news_dict: Dict,
    news_embeddings: Dict,
) -> np.ndarray:
    """
    Build a 32-dimensional context vector from a user's impression record.

    Dimensions:
      [0:6]   Inferred mood from reading history categories
      [6:10]  Time of day from timestamp
      [10:13] Reading speed estimate (based on history length)
      [13]    Normalized hour
      [14]    History length signal
      [15]    Click-through rate estimate
      [16:32] Average embedding of the user's click history (compressed)
    """
    vec = np.zeros(CONTEXT_DIM, dtype=np.float32)

    # ── Time of day ──
    hour = record["hour"]
    if 5 <= hour < 12:
        time_key = "Morning"
    elif 12 <= hour < 17:
        time_key = "Afternoon"
    elif 17 <= hour < 21:
        time_key = "Evening"
    else:
        time_key = "Night"
    vec[6:10] = TIME_ENCODING[time_key]

    # ── Infer mood from what categories the user reads ──
    history_categories = []
    for nid in record["history"]:
        if nid in news_dict:
            history_categories.append(news_dict[nid]["category"])

    # Score each mood based on what categories the user historically reads
    mood_scores = {m: 0.0 for m in MOOD_LIST}
    for cat in history_categories:
        affinities = CATEGORY_MOOD_MAP.get(cat, {})
        for m, score in affinities.items():
            mood_scores[m] += score

    if history_categories:
        # Normalize and pick dominant mood
        best_mood = max(mood_scores, key=mood_scores.get)
    else:
        best_mood = random.choice(MOOD_LIST)  # cold start

    vec[0:6] = MOOD_ENCODING[best_mood]

    # ── Reading speed estimate ──
    history_len = len(record["history"])
    if history_len > 20:
        vec[10:13] = [0, 0, 1]  # fast reader
    elif history_len > 10:
        vec[10:13] = [0, 1, 0]  # medium
    else:
        vec[10:13] = [1, 0, 0]  # slow / new user

    # ── Continuous signals ──
    vec[13] = hour / 24.0
    vec[14] = min(history_len, 50) / 50.0  # normalized history length

    # Click-through rate from this impression
    clicks = sum(1 for _, l in record["impressions"] if l == 1)
    total = len(record["impressions"])
    vec[15] = clicks / max(1, total)

    # ── User history embedding (average of clicked article embeddings) ──
    history_embeds = []
    for nid in record["history"][-20:]:  # last 20 articles
        if nid in news_embeddings:
            history_embeds.append(news_embeddings[nid])

    if history_embeds:
        avg_embed = np.mean(history_embeds, axis=0)
        # Compress 64-dim embedding into 16 dims via chunked averaging
        chunk_size = EMBEDDING_DIM // 16
        for i in range(16):
            start = i * chunk_size
            end = start + chunk_size
            vec[16 + i] = np.mean(avg_embed[start:end])

    return vec


# ──────────────────────────────────────────────────────────────
# 4. Evaluation Metrics (AUC, MRR, NDCG)
# ──────────────────────────────────────────────────────────────
def compute_auc(labels: List[int], scores: List[float]) -> float:
    """Compute Area Under ROC Curve."""
    pairs = list(zip(scores, labels))
    pairs.sort(key=lambda x: -x[0])

    pos = sum(labels)
    neg = len(labels) - pos
    if pos == 0 or neg == 0:
        return 0.5

    tp = 0
    auc = 0.0
    for score, label in pairs:
        if label == 1:
            tp += 1
        else:
            auc += tp
    return auc / (pos * neg)


def compute_mrr(labels: List[int], scores: List[float]) -> float:
    """Compute Mean Reciprocal Rank."""
    pairs = list(zip(scores, labels))
    pairs.sort(key=lambda x: -x[0])
    for rank, (_, label) in enumerate(pairs, 1):
        if label == 1:
            return 1.0 / rank
    return 0.0


def compute_ndcg(labels: List[int], scores: List[float], k: int = 5) -> float:
    """Compute Normalized Discounted Cumulative Gain @k."""
    pairs = list(zip(scores, labels))
    pairs.sort(key=lambda x: -x[0])

    dcg = 0.0
    for i, (_, label) in enumerate(pairs[:k]):
        dcg += label / math.log2(i + 2)

    # Ideal DCG
    ideal_labels = sorted(labels, reverse=True)
    idcg = 0.0
    for i, label in enumerate(ideal_labels[:k]):
        idcg += label / math.log2(i + 2)

    return dcg / idcg if idcg > 0 else 0.0


# ──────────────────────────────────────────────────────────────
# 5. Evaluate Agent on a behavior dataset
# ──────────────────────────────────────────────────────────────
def evaluate_on_behaviors(
    agent: RLAgent,
    records: List[dict],
    news_dict: Dict,
    news_embeddings: Dict,
    max_eval: int = 2000,
) -> Dict:
    """
    Evaluate the agent on real impression logs.

    For each impression:
      1. Build user context from history + timestamp
      2. Score each candidate article using the agent's Q-network
      3. Compare agent's ranking vs ground truth clicks
      4. Compute AUC, MRR, NDCG@5, NDCG@10
    """
    auc_list = []
    mrr_list = []
    ndcg5_list = []
    ndcg10_list = []
    skipped = 0

    old_eps = agent.epsilon
    agent.epsilon = 0.0  # pure exploitation during evaluation

    eval_records = records[:max_eval] if max_eval > 0 else records

    for record in eval_records:
        impressions = record["impressions"]

        # Need at least 1 click and 1 skip for meaningful evaluation
        clicks = sum(1 for _, l in impressions if l == 1)
        skips = sum(1 for _, l in impressions if l == 0)
        if clicks == 0 or skips == 0:
            skipped += 1
            continue

        # Build context
        context_vec = build_user_context(record, news_dict, news_embeddings)
        context_tensor = torch.FloatTensor(context_vec).unsqueeze(0).to(agent.device)

        # Score each impression article
        labels = []
        scores = []

        for news_id, label in impressions:
            if news_id not in news_embeddings:
                continue

            emb = torch.FloatTensor(news_embeddings[news_id]).unsqueeze(0).to(agent.device)

            with torch.no_grad():
                agent.policy_net.eval()
                q_val = agent.policy_net(context_tensor, emb).item()

            labels.append(label)
            scores.append(q_val)

        if len(labels) < 2 or sum(labels) == 0:
            skipped += 1
            continue

        auc_list.append(compute_auc(labels, scores))
        mrr_list.append(compute_mrr(labels, scores))
        ndcg5_list.append(compute_ndcg(labels, scores, k=5))
        ndcg10_list.append(compute_ndcg(labels, scores, k=10))

    agent.epsilon = old_eps

    n = max(1, len(auc_list))
    return {
        "AUC":     round(sum(auc_list) / n, 4),
        "MRR":     round(sum(mrr_list) / n, 4),
        "NDCG@5":  round(sum(ndcg5_list) / n, 4),
        "NDCG@10": round(sum(ndcg10_list) / n, 4),
        "evaluated": len(auc_list),
        "skipped": skipped,
    }


# ──────────────────────────────────────────────────────────────
# 6. Training Loop
# ──────────────────────────────────────────────────────────────
def train_on_behaviors(
    agent: RLAgent,
    records: List[dict],
    news_dict: Dict,
    news_embeddings: Dict,
    eval_records: List[dict] = None,
    eval_every: int = 2000,
    max_eval: int = 1000,
):
    """
    Train the RL agent on real MIND user interactions.

    For each impression log:
      - Build user context from click history + timestamp
      - For each article shown to the user:
          * If user clicked (label=1) -> reward = +1.0
          * If user skipped (label=0) -> reward = -0.3
      - Feed (context, article_embedding, reward) to agent.update()
    """
    print()
    print("-" * 65)
    print("  TRAINING ON REAL MIND DATA")
    print("-" * 65)

    start_time = time.time()
    total_interactions = 0
    total_reward = 0.0
    eval_results_log = []

    for i, record in enumerate(records):
        # Build context from this user's history
        context_vec = build_user_context(record, news_dict, news_embeddings)

        # Process each impression (article shown to user)
        for news_id, label in record["impressions"]:
            if news_id not in news_embeddings:
                continue

            article_emb = news_embeddings[news_id]

            # Real reward from ground truth
            if label == 1:
                reward = 1.0   # user clicked
            else:
                reward = -0.3  # user skipped

            agent.update(context_vec, article_emb, reward)
            total_interactions += 1
            total_reward += reward

        # Periodic progress + evaluation
        impression_num = i + 1
        if impression_num % eval_every == 0:
            elapsed = time.time() - start_time
            avg_reward = total_reward / max(1, total_interactions)

            msg = (
                f"  Impression {impression_num:>6d}/{len(records)} | "
                f"Interactions: {total_interactions:>7d} | "
                f"Eps: {agent.epsilon:.4f} | "
                f"Avg Reward: {avg_reward:+.4f} | "
                f"Buffer: {len(agent.replay)} | "
                f"Time: {elapsed:.1f}s"
            )

            # Run evaluation on dev set if available
            if eval_records:
                eval_res = evaluate_on_behaviors(
                    agent, eval_records, news_dict, news_embeddings, max_eval=max_eval
                )
                eval_results_log.append(eval_res)
                msg += (
                    f" | AUC: {eval_res['AUC']:.4f}"
                    f" | NDCG@5: {eval_res['NDCG@5']:.4f}"
                    f" | MRR: {eval_res['MRR']:.4f}"
                )

            print(msg)

    return {
        "total_interactions": total_interactions,
        "total_reward": total_reward,
        "eval_log": eval_results_log,
    }


# ──────────────────────────────────────────────────────────────
# 7. Main
# ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Train & evaluate the RL agent on real MIND data"
    )
    parser.add_argument(
        "--max-impressions", type=int, default=10000,
        help="Max impression logs to use for training (0=all, default 10000)"
    )
    parser.add_argument(
        "--max-eval", type=int, default=1000,
        help="Max impression logs for each evaluation round"
    )
    parser.add_argument(
        "--eval-every", type=int, default=2000,
        help="Evaluate every N impressions during training"
    )
    parser.add_argument(
        "--evaluate-only", action="store_true",
        help="Skip training, only evaluate the current model"
    )
    parser.add_argument(
        "--save", action="store_true",
        help="Save the trained model"
    )
    parser.add_argument(
        "--load", action="store_true",
        help="Load a pre-trained model before training/evaluation"
    )
    args = parser.parse_args()

    print("=" * 65)
    print("  HYPER-PERSONALIZATION ENGINE")
    print("  Training on Real MIND Dataset")
    print("=" * 65)

    # ── Load news catalog (combine train + dev for full coverage) ──
    news_dict_train, news_emb_train = load_news_catalog("train")
    news_dict_dev, news_emb_dev = load_news_catalog("dev")

    # Merge catalogs
    news_dict = {**news_dict_train, **news_dict_dev}
    news_embeddings = {**news_emb_train, **news_emb_dev}
    print(f"[OK] Total news catalog: {len(news_dict)} articles")

    categories = set(a["category"] for a in news_dict.values())
    print(f"[OK] Categories: {len(categories)} -> {sorted(categories)}")

    # ── Initialize agent ──
    agent = RLAgent(
        context_dim=CONTEXT_DIM,
        action_dim=EMBEDDING_DIM,
        lr=3e-4,
        epsilon_start=1.0,
        epsilon_min=0.05,
        epsilon_decay=0.9995,
        batch_size=64,
        replay_capacity=10000,
    )

    # ── Optionally load pre-trained model ──
    model_path = os.path.join(DATA_BASE, "..", "model", "trained_agent.pt")
    if args.load and os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=agent.device, weights_only=True)
        agent.policy_net.load_state_dict(checkpoint["policy_net"])
        agent.target_net.load_state_dict(checkpoint["target_net"])
        agent.optimizer.load_state_dict(checkpoint["optimizer"])
        agent.epsilon = checkpoint.get("epsilon", 0.1)
        print(f"[OK] Loaded pre-trained model (eps={agent.epsilon:.4f})")

    # ── Load dev behaviors for evaluation ──
    print()
    dev_records = load_behaviors("dev", max_impressions=min(args.max_eval * 3, 5000))

    # ── Baseline evaluation ──
    print()
    print("=" * 65)
    print("  BASELINE EVALUATION (Before Training)")
    print("=" * 65)
    baseline = evaluate_on_behaviors(
        agent, dev_records, news_dict, news_embeddings, max_eval=args.max_eval
    )
    print(f"  AUC:     {baseline['AUC']}")
    print(f"  MRR:     {baseline['MRR']}")
    print(f"  NDCG@5:  {baseline['NDCG@5']}")
    print(f"  NDCG@10: {baseline['NDCG@10']}")
    print(f"  Evaluated: {baseline['evaluated']} impressions")

    if args.evaluate_only:
        print("\n  --evaluate-only flag set, skipping training.")
        print("=" * 65)
        return

    # ── Load training behaviors ──
    print()
    train_records = load_behaviors("train", max_impressions=args.max_impressions)

    # ── Train ──
    train_result = train_on_behaviors(
        agent=agent,
        records=train_records,
        news_dict=news_dict,
        news_embeddings=news_embeddings,
        eval_records=dev_records,
        eval_every=args.eval_every,
        max_eval=args.max_eval,
    )

    # ── Final evaluation on dev set ──
    print()
    print("=" * 65)
    print("  FINAL EVALUATION (After Training)")
    print("=" * 65)
    final = evaluate_on_behaviors(
        agent, dev_records, news_dict, news_embeddings, max_eval=args.max_eval
    )
    print(f"  AUC:     {final['AUC']}  (was {baseline['AUC']})")
    print(f"  MRR:     {final['MRR']}  (was {baseline['MRR']})")
    print(f"  NDCG@5:  {final['NDCG@5']}  (was {baseline['NDCG@5']})")
    print(f"  NDCG@10: {final['NDCG@10']}  (was {baseline['NDCG@10']})")
    print(f"  Evaluated: {final['evaluated']} impressions")
    print(f"  Epsilon:   {agent.epsilon:.4f}")
    print(f"  Buffer:    {len(agent.replay)}")
    print(f"  Total training interactions: {train_result['total_interactions']}")

    # ── Improvement summary ──
    print()
    print("=" * 65)
    print("  IMPROVEMENT SUMMARY")
    print("=" * 65)
    for metric in ["AUC", "MRR", "NDCG@5", "NDCG@10"]:
        before = baseline[metric]
        after = final[metric]
        diff = after - before
        pct = (diff / max(0.0001, before)) * 100
        print(f"  {metric:10s}: {before:.4f} -> {after:.4f}  ({diff:+.4f}, {pct:+.1f}%)")

    # ── Save model ──
    if args.save:
        model_dir = os.path.join(DATA_BASE, "..", "model")
        os.makedirs(model_dir, exist_ok=True)
        save_path = os.path.join(model_dir, "trained_agent.pt")
        torch.save({
            "policy_net": agent.policy_net.state_dict(),
            "target_net": agent.target_net.state_dict(),
            "optimizer": agent.optimizer.state_dict(),
            "epsilon": agent.epsilon,
            "total_steps": agent.total_steps,
            "total_reward": agent.total_reward,
        }, save_path)
        print(f"\n  Model saved to: {save_path}")

    print()
    print("  Training complete!")
    print("=" * 65)


if __name__ == "__main__":
    main()
