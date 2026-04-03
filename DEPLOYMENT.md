# MediSimple Deployment Guide

This guide walks you through deploying the application to a cloud provider like **Render**, **Heroku**, **DigitalOcean App Platform**, or a standard VPS.

## Preparing the Codebase for Production

1. **Move Chatbot.py**: Right now, `Chatbot.py` is in the root directory. Ensure that when you push to production, the root directory structure is maintained so that `app.py` can resolve `ROOT_DIR` up one level.
2. **Remove Hardcoded Tokens**: Move the HuggingFace token from `Chatbot.py` into an Environment Variable (`os.getenv("HUGGINGFACE_API_KEY")`) before public distribution.

## Method 1: Deploying to Render (Recommended / Free Tier)

Render natively supports Flask apps and serves static files easily.

1. Create a `render.yaml` file in the root directory (optional) or use the Render Web Dashboard.
2. Connect your GitHub repository.
3. Use the following settings:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r Main_App/requirements.txt`
   - **Start Command**: `gunicorn --chdir Main_App app:app`
4. Add your Environment Variables (`HUGGINGFACE_API_KEY`) via the Render Dashboard.
5. Click **Deploy**. Render will automatically serve your API and static files!

## Method 2: Deploying to a Ubuntu Server (VPS) via Nginx & Gunicorn

If you prefer deploying on an AWS EC2 instance or DigitalOcean Droplet:

### 1. Install System Dependencies
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx
```

### 2. Clone the Repository & Setup Virtual Environment
```bash
git clone <your-repo-url> medisimple
cd medisimple/Main_App
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Setup Gunicorn Systemd Service
Create a file at `/etc/systemd/system/medisimple.service`:
```ini
[Unit]
Description=Gunicorn daemon for MediSimple
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/medisimple/Main_App
Environment="PATH=/home/ubuntu/medisimple/Main_App/venv/bin"
ExecStart=/home/ubuntu/medisimple/Main_App/venv/bin/gunicorn --workers 3 --bind unix:medisimple.sock -m 007 app:app

[Install]
WantedBy=multi-user.target
```
Start the service:
```bash
sudo systemctl start medisimple
sudo systemctl enable medisimple
```

### 4. Setup Nginx Reverse Proxy
Create a new Nginx config `/etc/nginx/sites-available/medisimple`:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    # Serve the frontend directly
    location / {
        root /home/ubuntu/medisimple;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to Gunicorn
    location /upload {
        include proxy_params;
        proxy_pass http://unix:/home/ubuntu/medisimple/Main_App/medisimple.sock;
    }
    
    location /api {
        include proxy_params;
        proxy_pass http://unix:/home/ubuntu/medisimple/Main_App/medisimple.sock;
    }
}
```
Link and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/medisimple /etc/nginx/sites-enabled
sudo systemctl restart nginx
```

## Post-Deployment Checklist
- [ ] Are PDF uploads parsing successfully? Check permissions on the `uploads` directory.
- [ ] Is SQLite keeping memory states properly? (Ensure `medisimple.db` exists in `Main_App` and directory has write permissions).
- [ ] Has the DNS resolved properly? Test Chatbot API.
