import re

"""
Curated, static mapping from lab test names to trustworthy consumer-health
reference pages (MedlinePlus, part of the U.S. National Library of Medicine).

Every URL below was verified to resolve directly against MedlinePlus's own
lab-tests index before being added here. This module never asks an LLM to
produce a link — it only does plain string matching against this table — so
it cannot hallucinate a URL. If a test isn't in the table, it returns None
and the UI simply omits the link instead of guessing.
"""

_SOURCE = "MedlinePlus (National Library of Medicine)"

# Checked first, as whole-word abbreviations. Order matters only within
# a tier: nothing here overlaps, but abbreviations must win over the
# generic phrase tier below (e.g. "CRP" must not fall through to "protein").
_ABBREVIATIONS = [
    (r"\bhba1c\b", "Hemoglobin A1c (HbA1c) Test", "https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/"),
    (r"\btsh\b", "TSH (Thyroid Stimulating Hormone) Test", "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/"),
    (r"\bt3\b", "Triiodothyronine (T3) Test", "https://medlineplus.gov/lab-tests/triiodothyronine-t3-tests/"),
    (r"\bt4\b", "Thyroxine (T4) Test", "https://medlineplus.gov/lab-tests/thyroxine-t4-test/"),
    (r"\bldl\b", "Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
    (r"\bhdl\b", "Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
    (r"\bwbc\b", "White Blood Count (WBC) Test", "https://medlineplus.gov/lab-tests/white-blood-count-wbc/"),
    (r"\brbc\b", "Red Blood Cell (RBC) Count", "https://medlineplus.gov/lab-tests/red-blood-cell-rbc-count/"),
    (r"\bmcv\b", "Mean Corpuscular Volume (MCV) Test", "https://medlineplus.gov/lab-tests/mcv-mean-corpuscular-volume/"),
    (r"\bmpv\b", "Mean Platelet Volume (MPV) Test", "https://medlineplus.gov/lab-tests/mpv-blood-test/"),
    (r"\brdw\b", "Red Cell Distribution Width (RDW) Test", "https://medlineplus.gov/lab-tests/rdw-red-cell-distribution-width/"),
    (r"\be\.?s\.?r\.?\b", "Erythrocyte Sedimentation Rate (ESR) Test", "https://medlineplus.gov/lab-tests/erythrocyte-sedimentation-rate-esr/"),
    (r"\bbun\b", "Blood Urea Nitrogen (BUN) Test", "https://medlineplus.gov/lab-tests/bun-blood-urea-nitrogen/"),
    (r"\begfr\b|\bgfr\b", "Glomerular Filtration Rate (GFR) Test", "https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/"),
    (r"\bsgot\b|\bast\b", "AST Blood Test", "https://medlineplus.gov/lab-tests/ast-test/"),
    (r"\bsgpt\b|\balt\b", "ALT Blood Test", "https://medlineplus.gov/lab-tests/alt-blood-test/"),
    (r"\bpsa\b", "PSA (Prostate-Specific Antigen) Test", "https://medlineplus.gov/lab-tests/prostate-specific-antigen-psa-test/"),
    (r"\binr\b|\bprothrombin\b", "Prothrombin Time / INR Test", "https://medlineplus.gov/lab-tests/prothrombin-time-test-and-inr-ptinr/"),
    (r"\bggt\b", "GGT Test", "https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/"),
    (r"\bcrp\b|c[\s-]?reactive protein", "C-Reactive Protein (CRP) Test", "https://medlineplus.gov/lab-tests/c-reactive-protein-crp-test/"),
    (r"\bd[\s-]?dimer\b", "D-dimer Test", "https://medlineplus.gov/lab-tests/d-dimer-test/"),
    (r"\bpcv\b", "Hematocrit Test", "https://medlineplus.gov/lab-tests/hematocrit-test/"),
]

# Checked second, as substrings of the normalized test name.
_PHRASES = [
    ("hemoglobin", "Hemoglobin Test", "https://medlineplus.gov/lab-tests/hemoglobin-test/"),
    ("hematocrit", "Hematocrit Test", "https://medlineplus.gov/lab-tests/hematocrit-test/"),
    ("packed cell volume", "Hematocrit Test", "https://medlineplus.gov/lab-tests/hematocrit-test/"),
    ("vitamin d", "Vitamin D Test", "https://medlineplus.gov/lab-tests/vitamin-d-test/"),
    ("vitamin b", "Vitamin B Test", "https://medlineplus.gov/lab-tests/vitamin-b-test/"),
    ("vitamin e", "Vitamin E Test", "https://medlineplus.gov/lab-tests/vitamin-e-tocopherol-test/"),
    ("folate", "Vitamin B Test", "https://medlineplus.gov/lab-tests/vitamin-b-test/"),
    ("triglycerides", "Triglycerides Test", "https://medlineplus.gov/lab-tests/triglycerides-test/"),
    ("cholesterol", "Cholesterol Levels", "https://medlineplus.gov/lab-tests/cholesterol-levels/"),
    ("creatinine", "Creatinine Test", "https://medlineplus.gov/lab-tests/creatinine-test/"),
    ("uric acid", "Uric Acid Test", "https://medlineplus.gov/lab-tests/uric-acid-test/"),
    ("urea", "Blood Urea Nitrogen (BUN) Test", "https://medlineplus.gov/lab-tests/bun-blood-urea-nitrogen/"),
    ("bilirubin", "Bilirubin Test", "https://medlineplus.gov/lab-tests/bilirubin-blood-test/"),
    ("alkaline phosphatase", "Alkaline Phosphatase (ALP) Test", "https://medlineplus.gov/lab-tests/alkaline-phosphatase/"),
    ("albumin", "Albumin Blood Test", "https://medlineplus.gov/lab-tests/albumin-blood-test/"),
    ("mean platelet volume", "Mean Platelet Volume (MPV) Test", "https://medlineplus.gov/lab-tests/mpv-blood-test/"),
    ("platelet", "Platelet Tests", "https://medlineplus.gov/lab-tests/platelet-tests/"),
    ("thyroid", "TSH (Thyroid Stimulating Hormone) Test", "https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/"),
    ("sodium", "Sodium Blood Test", "https://medlineplus.gov/lab-tests/sodium-blood-test/"),
    ("potassium", "Potassium Blood Test", "https://medlineplus.gov/lab-tests/potassium-blood-test/"),
    ("chloride", "Chloride Blood Test", "https://medlineplus.gov/lab-tests/chloride-blood-test/"),
    ("calcium", "Calcium Blood Test", "https://medlineplus.gov/lab-tests/calcium-blood-test/"),
    ("ferritin", "Ferritin Blood Test", "https://medlineplus.gov/lab-tests/ferritin-blood-test/"),
    ("iron", "Iron Tests", "https://medlineplus.gov/lab-tests/iron-tests/"),
    ("glucose", "Blood Glucose Test", "https://medlineplus.gov/lab-tests/blood-glucose-test/"),
    ("insulin", "Insulin Test", "https://medlineplus.gov/lab-tests/insulin-in-blood/"),
    ("homocysteine", "Homocysteine Test", "https://medlineplus.gov/lab-tests/homocysteine-test/"),
    ("magnesium", "Magnesium Blood Test", "https://medlineplus.gov/lab-tests/magnesium-blood-test/"),
    ("phosphate", "Phosphate Blood Test", "https://medlineplus.gov/lab-tests/phosphate-in-blood/"),
    ("phosphorus", "Phosphate Blood Test", "https://medlineplus.gov/lab-tests/phosphate-in-blood/"),
    ("lymphocytes", "Blood Differential Test", "https://medlineplus.gov/lab-tests/blood-differential/"),
    ("neutrophils", "Blood Differential Test", "https://medlineplus.gov/lab-tests/blood-differential/"),
    ("eosinophils", "Blood Differential Test", "https://medlineplus.gov/lab-tests/blood-differential/"),
    ("basophils", "Blood Differential Test", "https://medlineplus.gov/lab-tests/blood-differential/"),
    ("monocytes", "Blood Differential Test", "https://medlineplus.gov/lab-tests/blood-differential/"),
    ("total protein", "Total Protein and Albumin/Globulin Ratio", "https://medlineplus.gov/lab-tests/total-protein-and-albumin-globulin-a-g-ratio/"),
]


def get_reference_link(test_name):
    """
    Looks up a trustworthy consumer-health reference for a lab test name
    using only static string matching (no LLM). Returns None when there is
    no confident match rather than guessing.
    """
    if not test_name:
        return None

    normalized = re.sub(r"[^a-z0-9\s.-]", " ", test_name.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()

    for pattern, label, url in _ABBREVIATIONS:
        if re.search(pattern, normalized):
            return {"label": label, "url": url, "source": _SOURCE}

    for phrase, label, url in _PHRASES:
        if phrase in normalized:
            return {"label": label, "url": url, "source": _SOURCE}

    return None
