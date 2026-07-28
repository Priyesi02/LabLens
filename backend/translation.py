import json
from langchain_core.prompts import PromptTemplate
from config import get_llm


def _parse_json(text):
    try:
        text = text.strip()

        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                return None

        return None


def translate_to_hindi(summary, specialist_reason, questions):
    """
    Translates the AI-generated analysis text (summary, specialist reasoning,
    doctor-prep questions) into Hindi for elderly/non-English-reading users.

    Falls back to the original English text per-field if the model call
    fails or returns malformed JSON, so the UI never ends up with missing
    text — worst case it silently stays in English for that field.
    """
    llm = get_llm()
    questions = questions or []

    prompt = PromptTemplate(
        input_variables=["summary", "specialist_reason", "questions"],
        template="""
Translate the following medical report text from English to simple, clear
Hindi (Devanagari script) suitable for an elderly patient. Use everyday
Hindi words for medical terms where possible rather than overly literal or
technical translations. Do NOT change any numbers, units, or lab values.

Return ONLY valid JSON, no explanation, no markdown, in this exact shape:
{{
    "summary": "Hindi translation of the summary",
    "specialist_reason": "Hindi translation of the specialist reason",
    "questions": ["Hindi translation of question 1", "Hindi translation of question 2"]
}}

The "questions" array in your response must have exactly the same number
of items, in the same order, as the questions given below.

Summary:
{summary}

Specialist reason:
{specialist_reason}

Questions (translate each one):
{questions}
"""
    )

    chain = prompt | llm

    try:
        result = chain.invoke({
            "summary": summary or "",
            "specialist_reason": specialist_reason or "",
            "questions": json.dumps(questions),
        })
        parsed = _parse_json(result.content)
    except Exception as e:
        print(f"[Translation] LLM call failed: {e}")
        parsed = None

    if not isinstance(parsed, dict):
        parsed = {}

    translated_questions = parsed.get("questions")
    if not isinstance(translated_questions, list) or len(translated_questions) != len(questions):
        translated_questions = questions

    return {
        "summary": parsed.get("summary") or summary or "",
        "specialist_reason": parsed.get("specialist_reason") or specialist_reason or "",
        "questions": translated_questions,
    }
