# Hyper-Personalization Engine

An interactive recommendation demo built with a React frontend and a FastAPI backend. The app combines user context, personas, history, and reinforcement-learning-based ranking to produce personalized news recommendations.

## Stack

- Frontend: React, Vite, CSS, MediaPipe Tasks Vision
- Backend: FastAPI, Uvicorn, PyTorch, NumPy
- Containerization: Docker, Docker Compose, Nginx
- Free cloud deployment: Render for backend, Vercel for frontend

## Features

- Context-aware recommendations using mood, BPM, ambient noise, time of day, and reading speed
- Persona-based warm starts
- Feedback loop with `like`, `read`, `skip`, and `dislike`
- User history and category preference tracking
- Optional webcam-based attention and mood tracking
- Dockerized local development and deployment workflow

## Project Structure

```text
backend/    FastAPI API and recommendation logic
frontend/   React + Vite UI
tools/      Helper scripts for data/demo workflows
```

## Run Locally

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Then open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8001`
- Backend docs: `http://localhost:8001/docs`

## Run with Docker

From the repository root:

```powershell
docker compose up --build -d
```

Then open:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8001`
- Backend docs: `http://localhost:8001/docs`

Stop the stack with:

```powershell
docker compose down
```

## Free Deployment

### Backend on Render

This repo includes [render.yaml](render.yaml) for a free Render web service.

Steps:

1. Push the repo to GitHub.
2. In Render, choose `New > Blueprint`.
3. Select this repository.
4. Deploy the backend service.
5. Copy the resulting backend URL, such as:

```text
https://hyper-personalization-backend.onrender.com
```

Notes:

- Render free web services spin down after 15 minutes of inactivity.
- The first request after idle can take around a minute.

### Frontend on Vercel

Deploy the `frontend` directory as a separate Vercel project.

Required Vercel setting:

- Root Directory: `frontend`

Required environment variable:

```text
VITE_API_BASE=https://your-render-backend.onrender.com
```

Expected Vercel build settings:

- Build Command: `npm run build`
- Output Directory: `dist`

## Important Repo Notes

- The large raw dataset under `backend/data` is intentionally not tracked in Git.
- The portable runtime article bundle `backend/data/runtime_bundle_250_64.pkl` is tracked so the app can run after clone and during Docker/Render deploys.
- Local virtual environments are intentionally ignored and should not be committed.
