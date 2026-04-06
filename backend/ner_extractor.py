# backend/ner_extractor.py
# MediSimple — Medical Lab Report Extraction Pipeline
# Uses pdfplumber for text extraction + robust multi-strategy regex NER.
# NO HuggingFace / transformers dependency — works 100% offline.

import re
import pdfplumber

# ────────────────────────────────────────────────
# TARGET METRIC PROFILES (pre-classified)
# ────────────────────────────────────────────────
METRIC_PROFILES = {
    "Blood Sugar": {
        "id": "sugar",
        "icon": "🍬",
        "unit": "mg/dL",
        "range": "70–99 (fasting)",
        "normal_min": 70,
        "normal_max": 99,
        "borderline_max": 125,
        "aliases": [
            "blood sugar", "blood glucose", "glucose", "fasting glucose",
            "fbs", "rbs", "fasting blood sugar", "random blood sugar",
            "plasma glucose", "serum glucose", "sugar", "blood sugar level",
            "f. blood sugar", "f.blood sugar", "fbg", "fpg"
        ],
        "description_templates": {
            "normal":     "Your fasting blood glucose is within the normal range — excellent metabolic health indicator.",
            "borderline": "Your fasting blood glucose is slightly above normal (pre-diabetic range). Monitor carbohydrate intake and increase physical activity.",
            "high":       "Your blood sugar is significantly elevated. This requires dietary changes, increased activity, and follow-up with your physician.",
            "low":        "Your blood sugar is below normal. Watch for symptoms of hypoglycemia and consult your doctor."
        }
    },
    "Blood Pressure": {
        "id": "bp",
        "icon": "❤️",
        "unit": "mmHg",
        "range": "< 120/80 normal",
        "aliases": [
            "blood pressure", "bp", "systolic", "diastolic",
            "systolic pressure", "diastolic pressure", "arterial pressure",
            "b.p", "b.p.", "bp:", "s.b.p", "d.b.p", "sbp", "dbp"
        ],
        "description_templates": {
            "normal":     "Blood pressure is within healthy limits. Continue maintaining a balanced diet and regular exercise.",
            "borderline": "Blood pressure is in the elevated range. Reducing sodium intake and stress management are recommended.",
            "high":       "Blood pressure is significantly elevated (hypertension). This requires medical attention and lifestyle modifications.",
            "low":        "Blood pressure is below normal (hypotension). Stay hydrated and consult your doctor if symptomatic."
        }
    },
    "HCT": {
        "id": "hct",
        "icon": "🩸",
        "unit": "%",
        "range": "37–52%",
        "normal_min": 37,
        "normal_max": 52,
        "borderline_max": 56,
        "aliases": [
            "hct", "hematocrit", "packed cell volume", "pcv",
            "haematocrit", "red cell volume", "haemtocrit", "hematocrite"
        ],
        "description_templates": {
            "normal":     "Hematocrit is within normal limits — healthy oxygen-carrying capacity and adequate red blood cell volume.",
            "borderline": "Hematocrit is slightly outside the normal range. Stay hydrated and monitor with follow-up tests.",
            "high":       "Hematocrit is elevated. This can indicate dehydration or a blood disorder. Consult your doctor.",
            "low":        "Hematocrit is low, which may indicate anemia. Iron supplementation and dietary changes may be recommended."
        }
    },
    "ALT": {
        "id": "alt",
        "icon": "🫀",
        "unit": "U/L",
        "range": "7–56 U/L",
        "normal_min": 7,
        "normal_max": 56,
        "borderline_max": 70,
        "aliases": [
            "alt", "alanine aminotransferase", "sgpt", "alanine transaminase",
            "alanine amino transferase", "serum glutamic pyruvic transaminase",
            "s.g.p.t", "s.g.p.t.", "alt (sgpt)", "sgpt (alt)"
        ],
        "description_templates": {
            "normal":     "ALT is within the normal range, indicating healthy liver enzyme levels.",
            "borderline": "ALT is mildly elevated — possible mild liver stress. Reduce alcohol and discuss medications with your doctor.",
            "high":       "ALT is significantly elevated above normal. This indicates liver stress. Avoid alcohol, review medications, and follow up with your doctor.",
            "low":        "ALT is within a healthy low-normal range."
        }
    },
    "Creatinine": {
        "id": "creatinine",
        "icon": "🫘",
        "unit": "mg/dL",
        "range": "0.6–1.2 mg/dL",
        "normal_min": 0.6,
        "normal_max": 1.2,
        "borderline_max": 1.5,
        "aliases": [
            "creatinine", "serum creatinine", "creat", "s.creatinine",
            "s creatinine", "creatinine serum", "s. creatinine",
            "creatine", "creatinine (serum)", "crea"
        ],
        "description_templates": {
            "normal":     "Creatinine is within the normal range — healthy kidney filtration function. Stay well-hydrated.",
            "borderline": "Creatinine is slightly elevated. This may indicate mild kidney stress. Increase water intake and follow up.",
            "high":       "Creatinine is significantly elevated, suggesting impaired kidney function. Immediate medical evaluation recommended.",
            "low":        "Creatinine is below normal range, which can be associated with low muscle mass."
        }
    },
    "BUN": {
        "id": "bun",
        "icon": "💧",
        "unit": "mg/dL",
        "range": "7–25 mg/dL",
        "normal_min": 7,
        "normal_max": 25,
        "borderline_max": 30,
        "aliases": [
            "bun", "blood urea nitrogen", "urea nitrogen", "urea",
            "blood urea", "serum urea", "su", "s.urea", "s urea",
            "urea (blood)", "b.u.n", "blood urea nit"
        ],
        "description_templates": {
            "normal":     "Blood Urea Nitrogen is normal — adequate protein metabolism and kidney function.",
            "borderline": "BUN is slightly elevated. Ensure adequate hydration and follow up if persistent.",
            "high":       "BUN is significantly elevated. This may indicate kidney dysfunction or dehydration. Consult your doctor.",
            "low":        "BUN is below normal, which may reflect low protein intake or liver issues."
        }
    }
}


# ────────────────────────────────────────────────
# PDF TEXT EXTRACTION (pdfplumber)
# ────────────────────────────────────────────────
def extract_text_from_pdf(filepath: str) -> str:
    """
    Extract all text from a PDF using pdfplumber.
    Handles both plain text and tabular lab reports.
    """
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            # ── Plain text extraction ──
            text = page.extract_text()
            if text:
                pages.append(text.strip())

            # ── Table extraction ──
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if row:
                        row_text = "  ".join(str(cell) for cell in row if cell)
                        if row_text.strip():
                            pages.append(row_text.strip())

    return "\n".join(pages)
# ────────────────────────────────────────────────
# MULTI-STRATEGY REGEX EXTRACTION
# ────────────────────────────────────────────────
def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, remove noise characters."""
    text = text.lower()
    text = re.sub(r'[^\w\s./:\-|%]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def _extract_numeric_near_alias(text: str, aliases: list) -> str | None:
    """
    Multi-strategy numeric value extraction near any alias.
    Tries 4 increasingly loose patterns:
      1. alias: <number>  (most specific, allows up to 3 words between alias and colon)
      2. alias  <spaces>  <number>
      3. <number> anywhere on the same line *after* the alias
    """
    norm = _normalize(text)

    # Sort longest alias first — avoids short aliases matching inside longer ones
    sorted_aliases = sorted(aliases, key=len, reverse=True)

    for alias in sorted_aliases:
        # Require word boundaries matching only (prevents 'su' matching inside 'pressure')
        alias_escaped = r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])'

        # Strategy 1 — alias (optional words) colon/dash/pipe numeric (e.g. "ALT (SGPT): 68", "Blood Sugar Fasting: 110")
        m = re.search(
            rf'{alias_escaped}(?:\s+[a-z]+){{0,3}}\s*[:\-|=\|]?\s*(\d+\.?\d*)',
            norm
        )
        if m:
            return m.group(1)

        # Strategy 2 — alias then whitespace then number (tabular, e.g. "ALT  68  U/L")
        m = re.search(
            rf'{alias_escaped}\s+(\d+\.?\d*)\s*(?:u/l|mg/dl|%|mmhg|iu/l|g/dl|bpm|f|c)?',
            norm
        )
        if m:
            return m.group(1)

        # Strategy 3 — number anywhere on the SAME LINE as alias, *after* the alias
        match = re.search(alias_escaped, norm)
        if match:
            idx = match.start()
            line_end = norm.find('\n', idx)
            # Look only at the portion of the line *after* the alias
            line_after = norm[idx + len(alias): line_end if line_end != -1 else idx + 200]
            m = re.search(r'(\d+\.?\d*)', line_after)
            if m:
                candidate = float(m.group(1))
                # Sanity check: ignore obviously wrong values (e.g. years like 2025)
                if candidate < 2000:
                    return m.group(1)

    return None


def _extract_bp_near_alias(text: str, aliases: list) -> str | None:
    """
    Extract a blood-pressure string (e.g. '128/82') near any BP alias.
    """
    norm = _normalize(text)
    sorted_aliases = sorted(aliases, key=len, reverse=True)

    for alias in sorted_aliases:
        # Require word boundaries matching only
        alias_escaped = r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])'

        # Pattern: alias (optional words) then NN/NN
        m = re.search(
            rf'{alias_escaped}(?:\s+[a-z]+){{0,3}}\s*[:\-|=\|]?\s*(\d{{2,3}}/\d{{2,3}})',
            norm
        )
        if m:
            return m.group(1)

        # Line-based: NN/NN anywhere on same line *after* alias
        match = re.search(alias_escaped, norm)
        if match:
            idx = match.start()
            line_end = norm.find('\n', idx)
            line_after = norm[idx + len(alias): line_end if line_end != -1 else idx + 200]
            m = re.search(r'(\d{2,3}/\d{2,3})', line_after)
            if m:
                return m.group(1)

    # Global fallback: any NN/NN near "pressure" or "bp"
    m = re.search(r'(?:pressure|bp)[^\d]{0,30}(\d{2,3}/\d{2,3})', norm)
    if m:
        return m.group(1)

    # Absolute fallback: any NN/NN in the whole text
    m = re.search(r'(\d{2,3}/\d{2,3})', norm)
    if m:
        val = m.group(1)
        parts = val.split('/')
        if 70 <= int(parts[0]) <= 220 and 40 <= int(parts[1]) <= 130:
            return val

    return None


# ────────────────────────────────────────────────
# STATUS CLASSIFICATION
# ────────────────────────────────────────────────
def _classify_status(metric_name: str, value_str: str) -> str:
    profile = METRIC_PROFILES[metric_name]

    if metric_name == "Blood Pressure":
        try:
            parts = str(value_str).split("/")
            systolic  = float(parts[0])
            diastolic = float(parts[1]) if len(parts) > 1 else 0
            if systolic < 90 or diastolic < 60:
                return "low"
            elif systolic < 120 and diastolic < 80:
                return "normal"
            elif systolic < 130 and diastolic < 80:
                return "borderline"
            else:
                return "high"
        except Exception:
            return "borderline"

    try:
        val = float(str(value_str).replace(",", "."))
    except Exception:
        return "normal"

    n_min = profile.get("normal_min", 0)
    n_max = profile.get("normal_max", 9999)
    b_max = profile.get("borderline_max", n_max * 1.2)

    if val < n_min * 0.9:
        return "low"
    elif val <= n_max:
        return "normal"
    elif val <= b_max:
        return "borderline"
    else:
        return "high"


# ────────────────────────────────────────────────
# TREND HEURISTIC
# ────────────────────────────────────────────────
def _infer_trend(metric_name: str, value_str: str) -> str:
    status = _classify_status(metric_name, value_str)
    if status in ("high", "borderline"):
        return "up"
    elif status == "low":
        return "down"
    return "stable"


# ────────────────────────────────────────────────
# AI EXPLANATION BUILDER
# ────────────────────────────────────────────────
def _build_ai_explanation(metrics: list, score: int) -> str:
    high      = [m for m in metrics if m["_found"] and m["status"] == "high"]
    border    = [m for m in metrics if m["_found"] and m["status"] == "borderline"]
    normal    = [m for m in metrics if m["_found"] and m["status"] == "normal"]
    not_found = [m for m in metrics if not m["_found"]]

    lines = [f"📋 Health Score: {score}/100\n"]

    if high:
        names = ", ".join(
            f"{m['icon']} {m['name']} ({m['value']} {m['unit']})" for m in high
        )
        lines.append(
            f"🔴 Elevated — {names}: These values are above the normal range "
            f"and should be discussed with your doctor."
        )

    if border:
        names = ", ".join(
            f"{m['icon']} {m['name']} ({m['value']} {m['unit']})" for m in border
        )
        lines.append(
            f"🟡 Watch — {names}: These values are slightly outside the normal range. "
            f"Monitor with lifestyle adjustments."
        )

    if normal:
        names = ", ".join(f"{m['icon']} {m['name']}" for m in normal)
        lines.append(f"✅ Normal — {names}: These markers are within healthy ranges.")

    if not_found:
        names = ", ".join(m["name"] for m in not_found)
        lines.append(
            f"ℹ️ Not detected — {names}: These markers were not found in the uploaded report."
        )

    lines.append(
        "\nWith regular monitoring and any recommended lifestyle changes, "
        "you can maintain or improve your health score."
    )

    return "\n\n".join(lines)


# ────────────────────────────────────────────────
# MAIN EXTRACTION FUNCTION
# ────────────────────────────────────────────────
def extract_metrics_from_text(raw_text: str) -> dict:
    """
    Core extraction pipeline given raw extracted text string.
    """
    if not raw_text.strip():
        return {
            "error":   "Could not extract text. The file may be scanned/image-only.",
            "metrics": [],
            "raw_text_preview": ""
        }

    print(f"[ner_extractor] Extracted {len(raw_text)} characters.")
    safe_preview = raw_text[:400].encode("ascii", errors="replace").decode("ascii")
    print(f"[ner_extractor] Preview:\n{safe_preview}\n---")

    # ── Step 2: Extract each metric ──
    extracted_metrics = []
    found_count = 0

    for metric_name, profile in METRIC_PROFILES.items():
        value = None

        if metric_name == "Blood Pressure":
            value = _extract_bp_near_alias(raw_text, profile["aliases"])
        else:
            value = _extract_numeric_near_alias(raw_text, profile["aliases"])

        if value is not None:
            found_count += 1
            status      = _classify_status(metric_name, value)
            trend       = _infer_trend(metric_name, value)
            description = profile["description_templates"].get(status, "Value extracted from report.")

            # Coerce to int/float where possible
            if metric_name != "Blood Pressure":
                try:
                    num = float(str(value).replace(",", "."))
                    value = int(num) if num == int(num) else round(num, 2)
                except Exception:
                    pass

            print(f"[ner_extractor] [OK] {metric_name}: {value} -> {status}")
            extracted_metrics.append({
                "id":          profile["id"],
                "name":        metric_name,
                "value":       value,
                "unit":        profile["unit"],
                "range":       profile["range"],
                "status":      status,
                "trend":       trend,
                "icon":        profile["icon"],
                "description": description,
                "_found":      True
            })
        else:
            print(f"[ner_extractor] [MISS] {metric_name}: not found")
            extracted_metrics.append({
                "id":          profile["id"],
                "name":        metric_name,
                "value":       "N/A",
                "unit":        profile["unit"],
                "range":       profile["range"],
                "status":      "normal",
                "trend":       "stable",
                "icon":        profile["icon"],
                "description": "This marker was not detected in the uploaded report.",
                "_found":      False
            })

    # ── Step 3: Health score ──
    found_metrics = [m for m in extracted_metrics if m["_found"]]
    if found_metrics:
        score_map    = {"normal": 100, "borderline": 65, "high": 35, "low": 50}
        health_score = round(
            sum(score_map.get(m["status"], 70) for m in found_metrics) / len(found_metrics)
        )
    else:
        health_score = 70

    # ── Step 4: AI explanation ──
    ai_explanation = _build_ai_explanation(extracted_metrics, health_score)

    # ── Strip internal _found flag before returning ──
    clean_metrics = []
    for m in extracted_metrics:
        cm = {k: v for k, v in m.items() if k != '_found'}
        clean_metrics.append(cm)

    print(f"[ner_extractor] Done - {found_count}/6 metrics found. Health score: {health_score}")

    return {
        "patientName":      "MediSimple User",
        "reportDate":       "Extracted Report",
        "healthScore":      health_score,
        "aiExplanation":    ai_explanation,
        "metrics":          clean_metrics,
        "foundCount":       found_count,
        "raw_text_preview": raw_text[:500]
    }


def extract_metrics_from_pdf(filepath: str) -> dict:
    """
    Full pipeline from PDF:
      1. Extract text (+ tables) with pdfplumber
      2. Pass to extract_metrics_from_text
    """
    try:
        raw_text = extract_text_from_pdf(filepath)
    except Exception as e:
        print(f"[ner_extractor] PDF extraction error: {e}")
        raw_text = ""
        
    return extract_metrics_from_text(raw_text)
