# Insurance Claim Agent

A full-stack insurance claims processing app for FNOL documents. The app accepts PDF claim files, extracts claim text, converts it into structured key-value fields, validates required information, routes the claim, and automatically generates an AI explanation after routing.

The final routing decision is rule-based and deterministic. AI is optional for key-value extraction and validation review, while the route explanation is called automatically after routing.

## Live Links

- Frontend: https://insurance-claim-agent-react.onrender.com
- Backend API: https://insurance-claim-agent-zrm1.onrender.com
- Backend health: https://insurance-claim-agent-zrm1.onrender.com/api/health

## Tech Stack

- Frontend: React, Vite, Axios, Nginx
- Backend: Flask, Gunicorn, PyMuPDF
- AI: NVIDIA NIM API
- Deployment: Docker, Docker Compose, Render

## Main Flow

1. Upload a PDF claim document.
2. Extract raw text from the file.
3. Extract key-value claim fields using rule-based logic or optional AI.
4. Validate required claim fields using rule-based logic or optional AI.
5. Route the claim using fixed business rules.
6. Automatically generate an AI explanation for the route.

## Testing PDFs

For testing purposes, I created sample PDFs in `PDF_FILES(For testing)`. The same test files are also available on Google Drive: [sample test files](https://drive.google.com/drive/folders/1NMWDtYzOZNDaaS4-9l68Rps46H0UdAzJ?usp=sharing).

I did not use the PDF provided with the assessment as the main test file because its internal text formatting caused incorrect extraction results and wrong answers. Instead, I used simple PDFs with clear text formatting and the required fields/cases mentioned in the assessment brief, so the extraction and routing flow can be tested reliably.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Shows a basic API welcome response. |
| GET | `/api/health` | Checks if the Flask backend is running. |
| GET | `/api/nvidia/health` | Checks if NVIDIA AI is configured and reachable. |
| POST | `/api/claims/upload` | Uploads a PDF claim file. |
| POST | `/api/claims/extract-text` | Extracts raw text from the uploaded PDF file. |
| POST | `/api/claims/extract-fields` | Extracts key-value claim fields using rule-based logic. |
| POST | `/api/claims/ai/extract-fields` | Optionally extracts key-value claim fields using NVIDIA AI. |
| POST | `/api/claims/validate` | Checks missing required fields using backend rules. |
| POST | `/api/claims/ai/validate` | Optionally uses AI to assist with validation and inconsistency review. |
| POST | `/api/claims/route` | Routes the claim using deterministic business rules. |
| POST | `/api/claims/ai/explain-route` | Automatically generates an AI explanation for the selected route. |

## Routing Rules

- Missing mandatory fields: Manual review
- Suspicious description words like `fraud`, `staged`, or `inconsistent`: Investigation Flag
- Claim type `injury`: Specialist Queue
- Estimated damage below `25000` with all required fields present: Fast-track
- High or invalid estimated damage: Manual review

## Get The Project

Clone the repository:

```powershell
git clone <https://github.com/Kishore-83096/INSURANCE-CLAIM-AGENT>
cd "INSURANCE CLAIM AGENT"
```

If you already have the repository, pull the latest changes:

```powershell
git pull origin main
```

Replace `main` with your branch name if you use a different branch.

## Environment Setup

Create `FLASK/.env`:

```env
FLASK_ENV=development
FLASK_DEBUG=True
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=10485760
SECRET_KEY=change-this-secret
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
```

For local React, create `REACT/.env.local` only when you want to point React to a specific backend:

```env
VITE_API_BASE_URL=http://localhost:5000
```

For deployed React on Render, set:

```env
VITE_API_BASE_URL=https://insurance-claim-agent-zrm1.onrender.com
```

Do not add `/api` at the end of `VITE_API_BASE_URL`.

## Run With Docker

From the project root:

```powershell
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:5000/api/health
```

To use `REACT/.env.local` with Docker Compose:

```powershell
docker compose --env-file REACT/.env.local up --build
```

Stop containers:

```powershell
docker compose down
```

## Run Locally Without Docker

Start Flask:

```powershell
cd FLASK
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Start React in a second terminal:

```powershell
cd REACT
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Render Deployment

This repo can be deployed as two separate Render services.

Flask service:

```text
Root Directory: FLASK
Runtime: Docker
Health Check Path: /api/health
```

React service:

```text
Root Directory: REACT
Runtime: Docker
Environment: VITE_API_BASE_URL=https://insurance-claim-agent-zrm1.onrender.com
```

Also update Flask `CORS_ORIGINS` on Render to include the deployed React URL:

```env
CORS_ORIGINS=https://insurance-claim-agent-react.onrender.com
```

## More Details

See `RUN_INSTRUCTIONS.txt` for longer local, Docker, and Render setup notes.
