# MediSimple Deployment Details & Requirements

This document outlines everything needed to deploy the MediSimple project to a production server.

## 1. Environment & Server Requirements
- **OS**: Linux (Ubuntu 22.04 LTS recommended) / Windows Server / macOS
- **Python**: v3.9+ (v3.10 recommended)
- **Node/NPM**: (Optional) Only if you plan to introduce Webpack/Vite later. The current app is Vanilla JS, meaning it does not require a build step.
- **Minimum Specs**: 1 vCPU, 1 GB RAM (The AI processing runs smoothly via HuggingFace's cloud inference endpoint, so local heavy GPU compute is not required).

## 2. Tech Stack Overview
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+). No build step required. Uses `Chart.js` via CDN.
- **Backend API**: Python Flask. 
- **Database**: SQLite3 (automatically initialized inside `medisimple.db` on launch).
- **Core Integrations**:
  - `pdfplumber` for secure, on-device parsing of uploaded health records.
  - `requests` to interact with inference endpoints dynamically.
  - **HuggingFace Inference API**: Meta-Llama-3.1-8B-Instruct (via `Chatbot.py`).

## 3. Environment Variables (.env)
Create a `.env` file in the `Main_App` root if you wish to decouple hardcoded secrets (highly recommended). Example:
```env
FLASK_ENV=production
FLASK_APP=app.py
PORT=5000
SECRET_KEY=your_secure_flask_secret_key
# The Chatbot.py uses a token. Set yours here so you can migrate it.
HUGGINGFACE_API_KEY=hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## 4. Dependencies
All Python dependencies are tracked in `Main_App/requirements.txt`:
- `Flask==3.0.0`
- `flask-cors==4.0.0`
- `python-dotenv==1.0.0`
- `pdfplumber==0.10.3`
- `requests==2.31.0`
- `gunicorn==21.2.0` (for Linux-based deployment WSGI serving)
