# backend/app.py
# MediSimple — Flask API
# Accepts PDF uploads, runs pdfplumber text extraction + multi-strategy regex NER,
# and returns structured metric data to the dashboard.

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sqlite3
import json
from ner_extractor import extract_metrics_from_pdf

# ── Resolve absolute paths ──────────────────────────────────────────────────
# ignition2/app.py  →  parent is the medisimple root (where index.html lives)
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))   # …/ignition2
ROOT_DIR   = os.path.dirname(BASE_DIR)                    # …/medisimple(static root)
import sys
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)
from Chatbot import get_therapist_response_simple
app = Flask(__name__, static_folder=ROOT_DIR, static_url_path='')
CORS(app)
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# ── Database Setup ────────────────────────────────────────────────────────
DB_FILE = os.path.join(BASE_DIR, 'medisimple.db')
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        address TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS medical_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        report_date TEXT,
        health_score INTEGER,
        ai_explanation TEXT,
        metrics_json TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )''')
    # Create demo user if not exists
    c.execute("SELECT * FROM users WHERE email='demo@medisimple.ai'")
    if not c.fetchone():
        c.execute("INSERT INTO users (first_name, last_name, email, password, address) VALUES (?, ?, ?, ?, ?)",
                  ("Dr. Demo", "User", "demo@medisimple.ai", "demo1234", "123 Sample St, Wellness City"))
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn
# ── Fallback demo data ──────────────────────────────────────────────────────
DUMMY_ANALYSIS = {
    "patientName": "MediSimple User",
    "reportDate":  "April 2025",
    "healthScore": 72,
    "aiExplanation": (
        "Your latest lab results show a generally healthy profile with a few areas to watch. "
        "Your ALT is slightly elevated, indicating mild liver stress. Blood sugar is in the pre-diabetic "
        "range and blood pressure is borderline high. Kidney function and hematocrit are both normal. "
        "With minor lifestyle adjustments — reduced sugar intake, limited alcohol, and regular exercise "
        "— you can expect meaningful improvements within 3 months."
    ),
    "metrics": [
        {"id": "sugar",      "name": "Blood Sugar",    "value": 118,    "unit": "mg/dL",  "status": "borderline", "range": "70–99 (fasting)", "trend": "up",     "icon": "🍬", "description": "Fasting blood glucose is slightly above normal (pre-diabetic range)."},
        {"id": "bp",         "name": "Blood Pressure", "value": "128/82","unit": "mmHg",   "status": "borderline", "range": "< 120/80 normal", "trend": "up",     "icon": "❤️", "description": "Blood pressure is in the elevated range. Reducing sodium intake is recommended."},
        {"id": "hct",        "name": "HCT",            "value": 44,     "unit": "%",      "status": "normal",     "range": "37–52%",          "trend": "stable", "icon": "🩸", "description": "Hematocrit is within normal limits — healthy oxygen-carrying capacity."},
        {"id": "alt",        "name": "ALT",            "value": 68,     "unit": "U/L",    "status": "high",       "range": "7–56 U/L",        "trend": "up",     "icon": "🫀", "description": "ALT is elevated. Avoid alcohol and discuss medications with your doctor."},
        {"id": "creatinine", "name": "Creatinine",     "value": 1.1,    "unit": "mg/dL",  "status": "normal",     "range": "0.6–1.2 mg/dL",  "trend": "stable", "icon": "🫘", "description": "Creatinine is within normal range — healthy kidney filtration function."},
        {"id": "bun",        "name": "BUN",            "value": 22,     "unit": "mg/dL",  "status": "normal",     "range": "7–25 mg/dL",      "trend": "down",   "icon": "💧", "description": "BUN is normal — adequate protein metabolism and kidney function."}
    ]
}
# ──────────────────────────────────────────────────────────────────────────────
# STATIC FILE SERVING
# Flask's static_folder=ROOT_DIR means it will serve /css/style.css, /js/app.js
# etc. directly from the medisimple root directory.
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/')
def serve_index():
    return send_from_directory(ROOT_DIR, 'index.html')

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(ROOT_DIR, 'dashboard.html')

@app.route('/dashboard.html')
def serve_dashboard_html():
    return send_from_directory(ROOT_DIR, 'dashboard.html')

@app.route('/login')
def serve_login():
    return send_from_directory(ROOT_DIR, 'login.html')

@app.route('/login.html')
def serve_login_html():
    return send_from_directory(ROOT_DIR, 'login.html')

@app.route('/signup')
def serve_signup():
    return send_from_directory(ROOT_DIR, 'signup.html')

@app.route('/signup.html')
def serve_signup_html():
    return send_from_directory(ROOT_DIR, 'signup.html')


# ──────────────────────────────────────────────────────────────────────────────
# POST /upload
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/upload', methods=['POST'])
def upload():
    """
    1. Accept a PDF from the dashboard upload strip.
    2. Save to disk.
    3. Run pdfplumber text extraction.
    4. Pass extracted text through multi-strategy regex NER.
    5. Map entities → 6 pre-classified metrics.
    6. Return structured JSON for the dashboard.
    """
    file = request.files.get('file')
    user_id = request.form.get('user_id')

    if not file or not file.filename.lower().endswith('.pdf'):
        return jsonify({
            "success": False,
            "error":   "Please upload a valid PDF file."
        }), 400

    import uuid
    safe_name = os.path.basename(file.filename)
    unique_filename = f"{uuid.uuid4().hex}_{safe_name}"
    filepath  = os.path.join(UPLOAD_FOLDER, unique_filename)
    file.save(filepath)
    print(f"[app] Saved uploaded file → {filepath}")

    try:
        # ── Run full extraction pipeline ──
        result = extract_metrics_from_pdf(filepath)

        if result.get("error"):
            print(f"[app] Extraction returned error: {result['error']}")
            return jsonify({
                "success": True,
                "mode":    "demo",
                "data":    DUMMY_ANALYSIS,
                "message": result["error"]
            })

        analysis = {
            "patientName":      result["patientName"],
            "reportDate":       result["reportDate"],
            "healthScore":      result["healthScore"],
            "aiExplanation":    result["aiExplanation"],
            "metrics":          result["metrics"],
            "foundCount":       result["foundCount"],
            "raw_text_preview": result.get("raw_text_preview", "")
        }

        found = result["foundCount"]
        print(f"[app] Extraction complete — {found}/6 metrics found.")

        # Save to DB if user_id is present
        if user_id and found > 0:
            conn = get_db()
            c = conn.cursor()
            c.execute("INSERT INTO medical_history (user_id, report_date, health_score, ai_explanation, metrics_json) VALUES (?, ?, ?, ?, ?)",
                      (user_id, result["reportDate"], result["healthScore"], result["aiExplanation"], json.dumps(result["metrics"])))
            conn.commit()
            conn.close()

        return jsonify({
            "success": True,
            "mode":    "live" if found > 0 else "demo",
            "data":    analysis if found > 0 else DUMMY_ANALYSIS,
            "message": f"{found}/6 metrics extracted from PDF." if found > 0
                       else "No metrics found — showing demo data."
        })

    except Exception as e:
        print(f"[app] Pipeline error: {e}")
        return jsonify({
            "success": True,
            "mode":    "demo",
            "data":    DUMMY_ANALYSIS,
            "message": f"Extraction error — showing demo data. ({str(e)[:200]})"
        })


# ──────────────────────────────────────────────────────────────────────────────
# POST /upload-demo   (Try Demo button on landing page)
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/upload-demo', methods=['POST'])
def upload_demo():
    return jsonify({
        "success": True,
        "mode":    "demo",
        "data":    DUMMY_ANALYSIS
    })


# ──────────────────────────────────────────────────────────────────────────────
# GET /health
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "MediSimple API"})


# ──────────────────────────────────────────────────────────────────────────────
# API: Auth and History
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.json
    first_name = data.get('firstName')
    last_name = data.get('lastName')
    email = data.get('email')
    password = data.get('password')
    address = data.get('address', '123 Health Ave, Wellness City, WC 12345')

    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (first_name, last_name, email, password, address) VALUES (?, ?, ?, ?, ?)",
                  (first_name, last_name, email, password, address))
        conn.commit()
        user_id = c.lastrowid
        return jsonify({"success": True, "user": {"id": user_id, "name": f"{first_name} {last_name}", "email": email, "address": address}})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Email already exists"}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password))
    user = c.fetchone()
    conn.close()
    
    if user:
        return jsonify({"success": True, "user": {
            "id": user['id'],
            "name": f"{user['first_name']} {user['last_name']}",
            "email": user['email'],
            "address": user['address']
        }})
    return jsonify({"success": False, "message": "Invalid email or password"}), 401

@app.route('/api/history/<int:user_id>', methods=['GET'])
def get_user_history(user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM medical_history WHERE user_id = ? ORDER BY id ASC", (user_id,))
    rows = c.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        history.append({
            "id": r['id'],
            "reportDate": r['report_date'],
            "healthScore": r['health_score'],
            "aiExplanation": r['ai_explanation'],
            "metrics": json.loads(r['metrics_json'])
        })
    return jsonify({"success": True, "history": history})

@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.json
    user_id = data.get('user_id')
    question = data.get('question')
    frontend_context = data.get('context')

    if not question:
        return jsonify({"success": False, "message": "Question is required"}), 400

    context_str = "No specific medical context provided or found in the database. Please answer generally based on your knowledge."
    
    if frontend_context:
        valid_metrics = [f"{m.get('name')}: {m.get('value')} {m.get('unit')} (Status: {m.get('status')})" for m in frontend_context if m.get('value') != 'N/A' and m.get('name')]
        if valid_metrics:
            context_str = "User's Recent Lab Results: " + ", ".join(valid_metrics)
    elif user_id:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT * FROM medical_history WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,))
        row = c.fetchone()
        conn.close()
        
        if row:
            try:
                metrics = json.loads(row['metrics_json'])
                valid_metrics = [f"{m['name']}: {m['value']} {m['unit']} (Status: {m['status']})" for m in metrics if m.get('value') != 'N/A' and 'value' in m]
                if valid_metrics:
                    context_str = "User's Recent Lab Results: " + ", ".join(valid_metrics)
            except Exception as e:
                print(f"[app] Error parsing metrics for chat context: {e}")

    try:
        response = get_therapist_response_simple(user_input=question, medical_context=context_str)
        return jsonify({"success": True, "answer": response})
    except Exception as e:
        print(f"[app] Chatbot API error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == '__main__':
    print(f"[app] Serving static files from: {ROOT_DIR}")
    print(f"[app] Upload folder: {UPLOAD_FOLDER}")
    app.run(debug=True, port=5000)
