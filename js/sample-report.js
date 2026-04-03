// js/sample-report.js
// Realistic dummy health data for MediSimple User

const SAMPLE_REPORT = {
  patientName: "MediSimple User",
  patientId: "PAT-2025-001",
  reportDate: "April 2025",
  reportType: "Comprehensive Blood Panel",

  metrics: [
    {
      id: "sugar",
      name: "Blood Sugar",
      value: 118,
      unit: "mg/dL",
      range: "70–99 (fasting)",
      status: "borderline",
      trend: "up",
      icon: "🍬",
      description: "Your fasting blood glucose is slightly above the normal range. This is classified as pre-diabetic territory. Monitor carbohydrate intake and increase physical activity."
    },
    {
      id: "bp",
      name: "Blood Pressure",
      value: "128/82",
      unit: "mmHg",
      range: "< 120/80 normal",
      status: "borderline",
      trend: "up",
      icon: "❤️",
      description: "Blood pressure is in the elevated range (Stage 1 hypertension boundary). Reducing sodium intake and stress management are recommended."
    },
    {
      id: "hct",
      name: "HCT",
      value: 44,
      unit: "%",
      range: "37–52%",
      status: "normal",
      trend: "stable",
      icon: "🩸",
      description: "Hematocrit is within normal limits. This indicates adequate red blood cell volume relative to total blood volume — healthy oxygen-carrying capacity."
    },
    {
      id: "alt",
      name: "ALT",
      value: 68,
      unit: "U/L",
      range: "7–56 U/L",
      status: "high",
      trend: "up",
      icon: "🫀",
      description: "Alanine Aminotransferase is elevated above normal. This liver enzyme can indicate mild liver stress. Avoid alcohol, review medications, and follow up with your doctor."
    },
    {
      id: "creatinine",
      name: "Creatinine",
      value: 1.1,
      unit: "mg/dL",
      range: "0.6–1.2 mg/dL",
      status: "normal",
      trend: "stable",
      icon: "🫘",
      description: "Creatinine is within the normal range, indicating healthy kidney filtration function. Stay well-hydrated to maintain kidney health."
    },
    {
      id: "bun",
      name: "BUN",
      value: 22,
      unit: "mg/dL",
      range: "7–25 mg/dL",
      status: "normal",
      trend: "down",
      icon: "💧",
      description: "Blood Urea Nitrogen is normal, reflecting adequate protein metabolism and kidney function. Current values suggest no significant renal concerns."
    }
  ],

  aiExplanation: `Your latest lab results show a generally healthy profile with a few areas that need your attention.

🔴 Key Concern — Liver Enzymes (ALT): Your ALT level is slightly elevated at 68 U/L (normal is up to 56 U/L). This may indicate mild liver stress. It's important to reduce alcohol consumption and discuss any medications with your doctor.

🟡 Watch — Blood Sugar: At 118 mg/dL fasting, you're in the pre-diabetic range. A healthy diet lower in refined sugars and regular 30-minute walks can help bring this back to normal.

🟡 Watch — Blood Pressure: Slightly elevated at 128/82 mmHg. Reducing salt, managing stress, and light exercise can make a meaningful difference.

✅ Great News — Kidneys & Blood: Your HCT, Creatinine, and BUN values are all in healthy ranges. Your kidneys and red blood cells are functioning well.

Overall, with a few lifestyle adjustments — especially around diet and liver health — you can improve your health score significantly within 3 months.`,

  recommendations: [
    { emoji: "🥗", title: "Improve Diet", text: "Reduce refined carbs and sugar intake. Add more leafy greens and lean proteins to lower blood sugar and support liver health." },
    { emoji: "🏃", title: "Exercise Regularly", text: "Aim for 30 minutes of moderate activity 5 days/week. Walking, swimming, or cycling can help normalize blood sugar and blood pressure." },
    { emoji: "💧", title: "Stay Hydrated", text: "Drink at least 8 glasses of water daily to support kidney function and overall blood health." },
    { emoji: "🚫", title: "Limit Alcohol", text: "With elevated ALT, it's critical to reduce or eliminate alcohol to allow your liver enzymes to normalize." },
    { emoji: "🩺", title: "Follow-Up Check", text: "Schedule a follow-up blood panel in 3 months. Specifically recheck ALT and fasting glucose to monitor progress." },
    { emoji: "😴", title: "Prioritize Sleep", text: "7–9 hours of quality sleep helps regulate blood pressure and supports metabolic health." }
  ],

  chartData: {
    sugar: { values: [105, 110, 115, 112, 118], labels: ["Nov", "Dec", "Jan", "Feb", "Mar"] },
    hct: { values: [43, 44, 45, 43, 44], labels: ["Nov", "Dec", "Jan", "Feb", "Mar"] },
    alt: { values: [42, 48, 55, 60, 68], labels: ["Nov", "Dec", "Jan", "Feb", "Mar"] },
    creatinine: { values: [1.0, 1.0, 1.1, 1.1, 1.1], labels: ["Nov", "Dec", "Jan", "Feb", "Mar"] }
  }
};

// Calculate health score dynamically
function calculateHealthScore(metrics) {
  const scores = metrics.map(m => {
    if (m.status === 'normal') return 100;
    if (m.status === 'borderline') return 65;
    if (m.status === 'high') return 35;
    return 70;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

SAMPLE_REPORT.healthScore = calculateHealthScore(SAMPLE_REPORT.metrics);
