// js/jargon-data.js
// Medical jargon explanations for MediSimple tooltips

const JARGON = {
  sugar: {
    term: "Blood Sugar (Glucose)",
    plain: "The amount of sugar in your blood. High levels over time can lead to diabetes.",
    normal: "70–99 mg/dL (fasting)",
    tip: "Eat less processed sugar and walk more to keep this in check."
  },
  bp: {
    term: "Blood Pressure",
    plain: "The force your blood exerts on artery walls. High BP strains your heart and vessels.",
    normal: "Below 120/80 mmHg",
    tip: "Reduce salt, manage stress, and exercise regularly."
  },
  hct: {
    term: "Hematocrit (HCT)",
    plain: "The percentage of your blood made up of red blood cells. Shows how well your blood carries oxygen.",
    normal: "37–52%",
    tip: "Eat iron-rich foods like spinach and lean meats to support healthy levels."
  },
  alt: {
    term: "Alanine Aminotransferase (ALT)",
    plain: "A liver enzyme. High levels mean your liver may be stressed or damaged.",
    normal: "7–56 U/L",
    tip: "Limit alcohol and fatty foods. Discuss medications with your doctor."
  },
  creatinine: {
    term: "Creatinine",
    plain: "A waste product filtered by your kidneys. High levels can signal kidney problems.",
    normal: "0.6–1.2 mg/dL",
    tip: "Stay hydrated and avoid excessive protein supplements."
  },
  bun: {
    term: "Blood Urea Nitrogen (BUN)",
    plain: "Measures how well your kidneys are filtering waste from your blood.",
    normal: "7–25 mg/dL",
    tip: "Stay hydrated and maintain a balanced protein intake."
  }
};

// Helper: get tooltip HTML for a metric
function getTooltip(metricId) {
  const j = JARGON[metricId];
  if (!j) return '';
  return `<strong>${j.plain}</strong><br/>Normal: ${j.normal}`;
}
