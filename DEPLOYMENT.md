# Docker Deployment

## Services

- `backend`: FastAPI recommendation service on port `8001`
- `frontend`: Nginx-served React app on port `8080`

## Run

From the repository root:

```powershell
docker compose up --build -d
```

## Access

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8001`
- Backend docs: `http://localhost:8001/docs`

## Stop

```powershell
docker compose down
```

## Notes

- The frontend uses `/api` in Docker and Nginx proxies those requests to the backend container.
- The backend image copies only the compact runtime article bundle instead of the full raw dataset tree.
- The first backend build may still take time because PyTorch is a large dependency.

## Free Cloud Deployment

### Recommended split

- Deploy the backend to Render
- Deploy the frontend to Vercel

This project already supports that split:

- the frontend reads `VITE_API_BASE`
- the backend container can bind to Render's `PORT` environment variable

### Render backend

The repository includes a Render Blueprint at `render.yaml`.

To deploy:

1. Push this repository to GitHub.
2. In Render, choose `New > Blueprint`.
3. Select the repository and branch.
4. Render will detect `render.yaml` and create the backend web service.
5. After deploy, copy the public backend URL, for example:

```text
https://hyper-personalization-backend.onrender.com
```

Notes:

- Render free web services spin down after 15 minutes of inactivity.
- The first request after idle can take around a minute while the service wakes up.

### Vercel frontend

Deploy the `frontend/` directory as a separate Vercel project.

Dashboard flow:

1. Import the same GitHub repository into Vercel.
2. Set the project's Root Directory to `frontend`.
3. Framework preset should detect Vite automatically.
4. Add environment variable:

```text
VITE_API_BASE=https://your-render-backend.onrender.com
```

5. Deploy.

Expected values if Vercel asks:

- Build Command: `npm run build`
- Output Directory: `dist`

### Result

- Frontend URL: your `*.vercel.app` domain
- Backend URL: your `*.onrender.com` domain

The browser will call the Render backend directly using `VITE_API_BASE`.
