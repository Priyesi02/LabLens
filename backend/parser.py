# backend/parser.py
import json
import re
from config import get_llm
from langchain_core.prompts import PromptTemplate
from backend.reference_links import get_reference_link


def _parse_json(text):
    try:
        text = text.strip()

        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        # Try direct JSON
        try:
            return json.loads(text)
        except Exception:
            pass

        # Extract JSON object even if LLM writes: "Here is the extracted JSON:"
        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1 and end > start:
            json_text = text[start:end + 1]
            return json.loads(json_text)

        return None

    except Exception as e:
        print(f"[Parser] JSON parse failed: {e}")
        return None


def _to_float(value):
    if value is None:
        return None

    value = str(value).replace(",", "").strip()
    match = re.search(r"-?\d+(\.\d+)?", value)

    if not match:
        return None

    return float(match.group())


def _extract_range_numbers(normal_range):
    if not normal_range or normal_range == "Not specified":
        return []

    text = str(normal_range).replace(",", "").lower()
    return [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", text)]


def calculate_status(value, normal_range):
    """
    Calculates NORMAL/HIGH/LOW using Python, not LLM.
    """
    numeric_value = _to_float(value)

    if numeric_value is None:
        return "UNKNOWN"

    if not normal_range or normal_range == "Not specified":
        return "UNKNOWN"

    text = str(normal_range).lower().strip()
    numbers = _extract_range_numbers(text)

    if not numbers:
        return "UNKNOWN"

    # Examples: "Below 5.7", "< 200", "less than 100"
    if any(word in text for word in ["below", "less than", "<", "up to"]):
        upper = numbers[0]
        return "NORMAL" if numeric_value <= upper else "HIGH"

    # Examples: "Above 40", "> 60", "greater than 50"
    if any(word in text for word in ["above", "greater than", ">"]):
        lower = numbers[0]
        return "NORMAL" if numeric_value >= lower else "LOW"

    # Examples: "0.4-4.0", "13.0 - 17.0"
    if len(numbers) >= 2:
        lower = min(numbers[0], numbers[1])
        upper = max(numbers[0], numbers[1])

        if numeric_value < lower:
            return "LOW"
        if numeric_value > upper:
            return "HIGH"
        return "NORMAL"

    return "UNKNOWN"


def normalize_tests(tests):
    cleaned_tests = []

    for test in tests:
        name = test.get("name", "Unknown")
        value = test.get("value", "")
        unit = test.get("unit", "")
        normal_range = test.get("normal_range", "Not specified")

        status = calculate_status(value, normal_range)

        cleaned_tests.append({
            "name": name,
            "value": value,
            "unit": unit,
            "normal_range": normal_range,
            "status": status,
            "reference_link": get_reference_link(name)
        })

    return cleaned_tests


def parse_lab_values(raw_text):
    """
    Extracts lab test values from raw text.
    LLM extracts values only. Python calculates status safely.
    """
    llm = get_llm()

    prompt = PromptTemplate(
        input_variables=["raw_text"],
        template="""
You are a medical data extraction assistant.

Extract ALL lab test values from this report text.

Return ONLY valid JSON, no explanation, no markdown.

JSON format:
{{
    "patient_name": "name or Unknown",
    "report_date": "date or Unknown",
    "tests": [
        {{
            "name": "test name",
            "value": "numeric value as string",
            "unit": "unit of measurement",
            "normal_range": "normal range as string"
        }}
    ]
}}

Rules:
- Do not return a list.
- Always return one JSON object with patient_name, report_date, and tests.
- Extract every single test mentioned.
- If normal range is not mentioned, write "Not specified".
- Do NOT decide HIGH, LOW, NORMAL, or CRITICAL.
- Do NOT include status.
- Do not write comments, explanations, or trailing commas.

Report text:
{raw_text}
        """
    )

    chain = prompt | llm

    try:
        result = chain.invoke({"raw_text": raw_text})
        text = result.content.strip()

        print("RAW LLM OUTPUT:")
        print(text)

        parsed = _parse_json(text)

        if parsed is None:
         print("[Parser] Could not parse JSON")
         return {
        "patient_name": "Unknown",
        "report_date": "Unknown",
        "tests": []
    }

        if isinstance(parsed, list):
            parsed = {
                "patient_name": "Unknown",
                "report_date": "Unknown",
                "tests": parsed
            }

        parsed["patient_name"] = parsed.get("patient_name") or "Unknown"
        parsed["report_date"] = parsed.get("report_date") or "Unknown"
        parsed["tests"] = normalize_tests(parsed.get("tests", []))

        print(f"[Parser] Extracted {len(parsed.get('tests', []))} test values")
        return parsed

    except Exception as e:
        print(f"[Parser] Error: {e}")
        return None


if __name__ == "__main__":
    sample = """
    Patient: Rahul Sharma | Date: 15/06/2024
    HbA1c: 7.8% (Normal: Below 5.7%)
    TSH: 8.2 mIU/L (Normal: 0.4-4.0)
    Hemoglobin: 11.2 g/dL (Normal: 13.0-17.0)
    Vitamin D: 18 ng/mL (Normal: 20-50)
    WBC: 7500 cells/mcL (Normal: 4500-11000)
    """

    result = parse_lab_values(sample)
    print(json.dumps(result, indent=2))