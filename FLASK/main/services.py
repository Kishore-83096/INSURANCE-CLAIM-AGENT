import os
import re
import json
import fitz  # PyMuPDF

from flask import request, jsonify, current_app
from openai import OpenAI


# =========================
# BASIC API SERVICES
# =========================

def home():
    return jsonify({
        "message": "Welcome to Insurance Claims Agent API",
        "availableRoutes": [
            "GET /api/health",
            "GET /api/nvidia/health",
            "POST /api/claims/upload",
            "POST /api/claims/extract-text",
            "POST /api/claims/extract-fields",
            "POST /api/claims/ai/extract-fields",
            "POST /api/claims/validate",
            "POST /api/claims/ai/validate",
            "POST /api/claims/route",
            "POST /api/claims/ai/explain-route"
        ]
    }), 200


def health_check():
    return jsonify({
        "status": "ok",
        "message": "Insurance Claims Agent API is running"
    }), 200


# =========================
# NVIDIA AI SERVICES
# =========================

def get_nvidia_client():
    api_key = current_app.config.get("NVIDIA_API_KEY")
    base_url = current_app.config.get(
        "NVIDIA_BASE_URL",
        "https://integrate.api.nvidia.com/v1"
    )

    if not api_key:
        raise ValueError("NVIDIA_API_KEY is missing. Please set it in .env.")

    return OpenAI(
        api_key=api_key,
        base_url=base_url
    )


def get_nvidia_model():
    return current_app.config.get(
        "NVIDIA_MODEL",
        "meta/llama-3.1-8b-instruct"
    )


def nvidia_ai_health_check():
    model = get_nvidia_model()

    try:
        client = get_nvidia_client()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": "Reply with OK only."
                }
            ],
            temperature=0,
            max_tokens=5,
            timeout=20
        )

        ai_text = response.choices[0].message.content.strip()

        return jsonify({
            "success": True,
            "connected": True,
            "provider": "NVIDIA NIM",
            "model": model,
            "message": "NVIDIA AI connection successful.",
            "response": ai_text
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "connected": False,
            "provider": "NVIDIA NIM",
            "model": model,
            "message": "Failed to connect to NVIDIA AI.",
            "error": str(error)
        }), 500


def extract_json_from_ai_response(ai_text: str) -> dict:
    """
    Extract JSON safely from AI response.
    Handles normal JSON and markdown JSON blocks.
    """

    if not ai_text:
        raise ValueError("AI returned an empty response.")

    cleaned_text = ai_text.strip()

    if cleaned_text.startswith("```json"):
        cleaned_text = cleaned_text.replace("```json", "", 1).strip()

    if cleaned_text.startswith("```"):
        cleaned_text = cleaned_text.replace("```", "", 1).strip()

    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3].strip()

    start_index = cleaned_text.find("{")
    end_index = cleaned_text.rfind("}")

    if start_index == -1 or end_index == -1:
        raise ValueError("No valid JSON object found in AI response.")

    json_text = cleaned_text[start_index:end_index + 1]

    return json.loads(json_text)


# =========================
# FILE UPLOAD / TEXT EXTRACTION
# =========================

def allowed_file(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in current_app.config["ALLOWED_EXTENSIONS"]
    )


def save_uploaded_file(uploaded_file):
    if uploaded_file.filename == "":
        raise ValueError("No selected file.")

    if not allowed_file(uploaded_file.filename):
        raise ValueError("Invalid file type. Only PDF and TXT files are allowed.")

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    extension = uploaded_file.filename.rsplit(".", 1)[1].lower()
    filename = f"current_claim.{extension}"
    file_path = os.path.join(upload_folder, filename)

    for allowed_extension in current_app.config["ALLOWED_EXTENSIONS"]:
        previous_path = os.path.join(upload_folder, f"current_claim.{allowed_extension}")

        if previous_path != file_path and os.path.exists(previous_path):
            os.remove(previous_path)

    uploaded_file.save(file_path)

    return {
        "filename": filename,
        "originalFilename": uploaded_file.filename,
        "filePath": file_path,
        "fileType": extension
    }


def upload_claim_file():
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file uploaded. Please upload a PDF or TXT file using key 'file'."
        }), 400

    try:
        uploaded_file = request.files["file"]
        file_data = save_uploaded_file(uploaded_file)

        return jsonify({
            "success": True,
            "message": "File uploaded successfully.",
            "file": file_data
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 400


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts:
    1. Normal visible PDF text
    2. Fillable PDF form/widget values
    """

    text = ""

    with fitz.open(file_path) as document:
        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text()

            if page_text:
                text += f"\n--- Page {page_number} Text ---\n"
                text += page_text + "\n"

            widgets = page.widgets()

            if widgets:
                text += f"\n--- Page {page_number} Form Fields ---\n"

                for widget in widgets:
                    field_name = widget.field_name or ""
                    field_value = widget.field_value or ""

                    field_name = str(field_name).strip()
                    field_value = str(field_value).strip()

                    if field_name or field_value:
                        text += f"{field_name}: {field_value}\n"

    return text.strip()


def extract_text_from_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
        return file.read().strip()


def extract_text_from_file(file_path: str) -> str:
    extension = file_path.rsplit(".", 1)[1].lower()

    if extension == "pdf":
        return extract_text_from_pdf(file_path)

    if extension == "txt":
        return extract_text_from_txt(file_path)

    raise ValueError("Unsupported file format.")


def extract_claim_text():
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file uploaded. Please upload a PDF or TXT file using key 'file'."
        }), 400

    try:
        uploaded_file = request.files["file"]

        file_data = save_uploaded_file(uploaded_file)
        raw_text = extract_text_from_file(file_data["filePath"])

        return jsonify({
            "success": True,
            "message": "Text extracted successfully.",
            "file": file_data,
            "textLength": len(raw_text),
            "rawTextPreview": raw_text[:1000],
            "rawText": raw_text
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 400


# =========================
# RULE-BASED FIELD EXTRACTION
# =========================

FNOL_FIELD_LABELS = {
    "policyNumber": [
        "policyNumber",
        "Policy Number"
    ],
    "policyholderName": [
        "policyholderName",
        "Policyholder Name",
        "Policy Holder Name"
    ],
    "effectiveDates": [
        "effectiveDates",
        "Effective Dates",
        "Policy Effective Dates"
    ],
    "incidentDate": [
        "incidentDate",
        "Incident Date",
        "Date"
    ],
    "incidentTime": [
        "incidentTime",
        "Incident Time",
        "Time"
    ],
    "incidentLocation": [
        "incidentLocation",
        "Incident Location",
        "Location"
    ],
    "description": [
        "description",
        "Description",
        "Incident Description"
    ],
    "claimant": [
        "claimant",
        "Claimant",
        "Claimant Name"
    ],
    "thirdParties": [
        "thirdParties",
        "Third Parties",
        "Third Party"
    ],
    "contactDetails": [
        "contactDetails",
        "Contact Details",
        "Contact"
    ],
    "assetType": [
        "assetType",
        "Asset Type"
    ],
    "assetId": [
        "assetId",
        "Asset ID",
        "Asset Id"
    ],
    "estimatedDamage": [
        "estimatedDamage",
        "Estimated Damage",
        "Damage Estimate"
    ],
    "claimType": [
        "claimType",
        "Claim Type"
    ],
    "attachments": [
        "attachments",
        "Attachments",
        "Attached Documents"
    ],
    "initialEstimate": [
        "initialEstimate",
        "Initial Estimate"
    ]
}


def normalize_empty_value(value: str) -> str:
    if value is None:
        return ""

    cleaned_value = str(value).strip()

    invalid_values = [
        "",
        "none",
        "n/a",
        "na",
        "not available",
        "missing",
        "null",
        "-",
        "off"
    ]

    if cleaned_value.lower() in invalid_values:
        return ""

    if cleaned_value.startswith("--- Page"):
        return ""

    return cleaned_value


def get_value_by_labels(raw_text: str, labels: list) -> str:
    """
    Extracts clean key-value pairs like:
    Policy Number: POL-2026-0001
    policyNumber: POL-2026-0001
    """

    for label in labels:
        escaped_label = re.escape(label)

        pattern = rf"^{escaped_label}\s*:\s*(.*)$"
        match = re.search(pattern, raw_text, re.IGNORECASE | re.MULTILINE)

        if match:
            value = match.group(1).strip()
            value = normalize_empty_value(value)

            if value:
                return value

    return ""


def split_to_list(value: str) -> list:
    value = normalize_empty_value(value)

    if not value:
        return []

    # Important:
    # "No third parties involved" should be treated as a valid filled answer.
    # But plain "None" is treated as empty.
    if value.lower() in ["none", "no", "nil"]:
        return []

    return [item.strip() for item in value.split(",") if item.strip()]


def parse_contact_details(value: str) -> dict:
    value = normalize_empty_value(value)

    if not value:
        return {}

    contact_details = {}

    parts = [part.strip() for part in value.split(",") if part.strip()]

    for part in parts:
        if "@" in part:
            contact_details["email"] = part
        elif any(char.isdigit() for char in part):
            contact_details["phone"] = part
        else:
            contact_details.setdefault("other", part)

    if not contact_details:
        contact_details["value"] = value

    return contact_details


def extract_fnol_fields(raw_text: str) -> dict:
    third_parties_raw = get_value_by_labels(
        raw_text,
        FNOL_FIELD_LABELS["thirdParties"]
    )

    attachments_raw = get_value_by_labels(
        raw_text,
        FNOL_FIELD_LABELS["attachments"]
    )

    contact_details_raw = get_value_by_labels(
        raw_text,
        FNOL_FIELD_LABELS["contactDetails"]
    )

    extracted_fields = {
        "policyNumber": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["policyNumber"]),
        "policyholderName": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["policyholderName"]),
        "effectiveDates": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["effectiveDates"]),

        "incidentDate": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["incidentDate"]),
        "incidentTime": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["incidentTime"]),
        "incidentLocation": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["incidentLocation"]),
        "description": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["description"]),

        "claimant": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["claimant"]),
        "thirdParties": split_to_list(third_parties_raw),
        "contactDetails": parse_contact_details(contact_details_raw),

        "assetType": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["assetType"]),
        "assetId": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["assetId"]),
        "estimatedDamage": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["estimatedDamage"]),

        "claimType": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["claimType"]),
        "attachments": split_to_list(attachments_raw),
        "initialEstimate": get_value_by_labels(raw_text, FNOL_FIELD_LABELS["initialEstimate"]),
    }

    return extracted_fields


def extract_claim_fields(raw_text: str) -> dict:
    return extract_fnol_fields(raw_text)


def extract_claim_fields_api():
    data = request.get_json()

    if not data or "rawText" not in data:
        return jsonify({
            "success": False,
            "error": "rawText is required."
        }), 400

    raw_text = data["rawText"]
    extracted_fields = extract_claim_fields(raw_text)

    return jsonify({
        "success": True,
        "message": "FNOL claim fields extracted successfully.",
        "extractedFields": extracted_fields
    }), 200


# =========================
# VALIDATION
# =========================

MANDATORY_FIELDS = [
    "policyNumber",
    "policyholderName",
    "effectiveDates",
    "incidentDate",
    "incidentTime",
    "incidentLocation",
    "description",
    "claimant",
    "thirdParties",
    "contactDetails",
    "assetType",
    "assetId",
    "estimatedDamage",
    "claimType",
    "attachments",
    "initialEstimate",
]


def find_missing_fields(extracted_fields: dict) -> list:
    missing_fields = []

    for field in MANDATORY_FIELDS:
        value = extracted_fields.get(field)

        if value is None:
            missing_fields.append(field)
        elif isinstance(value, str) and value.strip() == "":
            missing_fields.append(field)
        elif isinstance(value, list) and len(value) == 0:
            missing_fields.append(field)
        elif isinstance(value, dict) and len(value) == 0:
            missing_fields.append(field)

    return missing_fields


def validate_claim_fields():
    data = request.get_json()

    if not data or "extractedFields" not in data:
        return jsonify({
            "success": False,
            "error": "extractedFields is required."
        }), 400

    extracted_fields = data["extractedFields"]
    missing_fields = find_missing_fields(extracted_fields)

    return jsonify({
        "success": True,
        "message": "Claim fields validated successfully.",
        "missingFields": missing_fields
    }), 200


# =========================
# ROUTING
# =========================

def parse_amount(value):
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    cleaned = (
        str(value)
        .replace(",", "")
        .replace("₹", "")
        .replace("$", "")
        .strip()
    )

    try:
        return float(cleaned)
    except ValueError:
        return None


def route_claim(extracted_fields: dict, missing_fields: list) -> dict:
    description = str(extracted_fields.get("description", "")).lower()
    claim_type = str(extracted_fields.get("claimType", "")).lower()
    estimated_damage = parse_amount(extracted_fields.get("estimatedDamage"))

    suspicious_words = ["fraud", "inconsistent", "staged"]

    # Priority 1: Missing mandatory fields
    if missing_fields:
        return {
            "recommendedRoute": "Manual review",
            "reasoning": f"Mandatory fields are missing: {', '.join(missing_fields)}."
        }

    # Priority 2: Suspicious description
    if any(word in description for word in suspicious_words):
        return {
            "recommendedRoute": "Investigation Flag",
            "reasoning": "The claim description contains suspicious terms such as fraud, inconsistent, or staged."
        }

    # Priority 3: Injury claim
    if claim_type == "injury":
        return {
            "recommendedRoute": "Specialist Queue",
            "reasoning": "The claim type is injury, so it must be handled by a specialist queue."
        }

    # Priority 4: Fast-track
    if estimated_damage is not None and estimated_damage < 25000:
        return {
            "recommendedRoute": "Fast-track",
            "reasoning": "Estimated damage is below 25,000 and all mandatory fields are present."
        }

    # Default
    return {
        "recommendedRoute": "Manual review",
        "reasoning": "Claim does not qualify for fast-track and requires manual review."
    }


def route_claim_api():
    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "error": "Request body is required."
        }), 400

    if "extractedFields" not in data:
        return jsonify({
            "success": False,
            "error": "extractedFields is required."
        }), 400

    extracted_fields = data["extractedFields"]

    # Important:
    # Recalculate missing fields in backend.
    # Do not trust missingFields from frontend.
    missing_fields = find_missing_fields(extracted_fields)

    route_result = route_claim(extracted_fields, missing_fields)

    return jsonify({
        "success": True,
        "message": "Claim routed successfully.",
        "extractedFields": extracted_fields,
        "missingFields": missing_fields,
        "recommendedRoute": route_result["recommendedRoute"],
        "reasoning": route_result["reasoning"]
    }), 200


# =========================
# AI FIELD EXTRACTION
# =========================

def ai_extract_claim_fields():
    data = request.get_json()

    if not data or "rawText" not in data:
        return jsonify({
            "success": False,
            "error": "rawText is required."
        }), 400

    raw_text = data["rawText"]

    if not raw_text or not raw_text.strip():
        return jsonify({
            "success": False,
            "error": "rawText cannot be empty."
        }), 400

    model = get_nvidia_model()

    prompt = f"""
You are an insurance FNOL claim extraction assistant.

Extract the required fields from the provided FNOL document text.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation.

Required JSON format:
{{
  "policyNumber": "",
  "policyholderName": "",
  "effectiveDates": "",
  "incidentDate": "",
  "incidentTime": "",
  "incidentLocation": "",
  "description": "",
  "claimant": "",
  "thirdParties": [],
  "contactDetails": {{}},
  "assetType": "",
  "assetId": "",
  "estimatedDamage": "",
  "claimType": "",
  "attachments": [],
  "initialEstimate": ""
}}

Rules:
- If a field is not found, return an empty string "".
- thirdParties must be a list.
- attachments must be a list.
- contactDetails must be an object.
- Do not guess values that are not present.
- estimatedDamage and initialEstimate should contain only the amount if available.
- claimType can be vehicle_damage, property_damage, injury, theft, or other.
- If the text says no third parties are involved, return ["No third parties involved"].

FNOL document text:
{raw_text}
"""

    try:
        client = get_nvidia_client()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_tokens=1200,
            timeout=45
        )

        ai_text = response.choices[0].message.content.strip()
        extracted_fields = extract_json_from_ai_response(ai_text)

        return jsonify({
            "success": True,
            "message": "FNOL fields extracted using NVIDIA AI.",
            "provider": "NVIDIA NIM",
            "model": model,
            "extractedFields": extracted_fields
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": "AI field extraction failed.",
            "provider": "NVIDIA NIM",
            "model": model,
            "error": str(error)
        }), 500


# =========================
# AI VALIDATION
# =========================
def ai_validate_claim_fields():
    data = request.get_json()

    if not data or "extractedFields" not in data:
        return jsonify({
            "success": False,
            "error": "extractedFields is required."
        }), 400

    extracted_fields = data["extractedFields"]

    # Backend missing-field check is always source of truth
    missing_fields = find_missing_fields(extracted_fields)

    # If mandatory fields are missing, return immediately.
    # Do not call NVIDIA AI because the claim is already incomplete.
    if missing_fields:
        return jsonify({
            "success": True,
            "message": "Claim fields validated using mandatory-field rules.",
            "provider": "Rule-based validation",
            "model": None,
            "validation": {
                "missingFields": missing_fields,
                "inconsistentFields": [],
                "validationIssues": [
                    "One or more mandatory fields are missing."
                ],
                "isValidForRouting": False,
                "summary": (
                    "The claim has missing mandatory fields and should be routed to Manual review."
                )
            }
        }), 200

    model = get_nvidia_model()

    prompt = f"""
You are an insurance FNOL claim validation assistant.

Validate the extracted FNOL claim fields for inconsistencies and data quality issues.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation outside JSON.

Required JSON format:
{{
  "missingFields": [],
  "inconsistentFields": [],
  "validationIssues": [],
  "isValidForRouting": true,
  "summary": "One short sentence explaining the validation result."
}}

Validation rules:
- Missing mandatory fields are already checked by backend.
- Do not invent missing values.
- inconsistentFields must include fields that conflict with each other.
- validationIssues should include suspicious or unclear data quality problems.
- summary is mandatory.
- summary must never be empty.
- summary must be one short sentence.
- If all fields are valid, summary should say: "All mandatory fields are present and no inconsistencies were found."

Extracted fields:
{json.dumps(extracted_fields, indent=2)}
"""

    try:
        client = get_nvidia_client()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_tokens=1000,
            timeout=45
        )

        ai_text = response.choices[0].message.content.strip()
        ai_validation = extract_json_from_ai_response(ai_text)

        # Backend is still source of truth
        ai_validation["missingFields"] = []
        ai_validation["isValidForRouting"] = True

        if not ai_validation.get("summary"):
            if ai_validation.get("inconsistentFields"):
                ai_validation["summary"] = (
                    "The claim has inconsistencies that should be reviewed before routing."
                )
            elif ai_validation.get("validationIssues"):
                ai_validation["summary"] = (
                    "The claim has validation issues that may require review."
                )
            else:
                ai_validation["summary"] = (
                    "All mandatory fields are present and no inconsistencies were found."
                )

        return jsonify({
            "success": True,
            "message": "Claim fields validated using NVIDIA AI.",
            "provider": "NVIDIA NIM",
            "model": model,
            "validation": ai_validation
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": "AI validation failed.",
            "provider": "NVIDIA NIM",
            "model": model,
            "error": str(error)
        }), 500

# =========================
# AI ROUTE EXPLANATION
# =========================

def ai_explain_route():
    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "error": "Request body is required."
        }), 400

    required_keys = [
        "extractedFields",
        "missingFields",
        "recommendedRoute",
        "reasoning"
    ]

    for key in required_keys:
        if key not in data:
            return jsonify({
                "success": False,
                "error": f"{key} is required. First call /api/claims/route, then pass its result here."
            }), 400

    extracted_fields = data["extractedFields"]
    missing_fields = data["missingFields"]
    recommended_route = data["recommendedRoute"]
    reasoning = data["reasoning"]

    model = get_nvidia_model()

    prompt = f"""
You are an insurance FNOL claim routing explanation assistant.

The final routing decision has already been made by deterministic business rules.
Do NOT change the route.
Only explain the given route clearly.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanation outside JSON.

Required JSON format:
{{
  "route": "",
  "summary": "",
  "keyFactors": [],
  "nextAction": ""
}}

Rules:
- route must exactly match the recommendedRoute provided.
- summary must be one short sentence explaining why this route was selected.
- keyFactors must be a list of short bullet-style reasons.
- nextAction must be one practical next step for the claims team.
- Do not invent new facts.
- Use only the extracted fields, missing fields, recommended route, and reasoning provided.

Input:
{{
  "extractedFields": {json.dumps(extracted_fields, indent=2)},
  "missingFields": {json.dumps(missing_fields, indent=2)},
  "recommendedRoute": {json.dumps(recommended_route)},
  "reasoning": {json.dumps(reasoning)}
}}
"""

    try:
        client = get_nvidia_client()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0,
            max_tokens=700,
            timeout=45
        )

        ai_text = response.choices[0].message.content.strip()
        explanation = extract_json_from_ai_response(ai_text)

        # Safety: force route to match backend decision
        explanation["route"] = recommended_route

        if not explanation.get("summary"):
            explanation["summary"] = reasoning

        if not explanation.get("keyFactors"):
            key_factors = []

            if missing_fields:
                key_factors.append(
                    f"Missing mandatory fields: {', '.join(missing_fields)}"
                )

            estimated_damage = extracted_fields.get("estimatedDamage")
            claim_type = extracted_fields.get("claimType")
            description = str(extracted_fields.get("description", "")).lower()

            if estimated_damage:
                key_factors.append(f"Estimated damage: {estimated_damage}")

            if claim_type:
                key_factors.append(f"Claim type: {claim_type}")

            if any(word in description for word in ["fraud", "inconsistent", "staged"]):
                key_factors.append("Description contains suspicious terms.")

            if not key_factors:
                key_factors.append(reasoning)

            explanation["keyFactors"] = key_factors

        if not explanation.get("nextAction"):
            if recommended_route == "Manual review":
                explanation["nextAction"] = "Send the claim to a reviewer for manual verification."
            elif recommended_route == "Investigation Flag":
                explanation["nextAction"] = "Send the claim to the investigation team for further review."
            elif recommended_route == "Specialist Queue":
                explanation["nextAction"] = "Send the claim to a specialist handler."
            elif recommended_route == "Fast-track":
                explanation["nextAction"] = "Proceed with fast-track claim processing."
            else:
                explanation["nextAction"] = "Proceed according to the selected claim workflow."

        return jsonify({
            "success": True,
            "message": "Route explanation generated using NVIDIA AI.",
            "provider": "NVIDIA NIM",
            "model": model,
            "explanation": explanation
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": "AI route explanation failed.",
            "provider": "NVIDIA NIM",
            "model": model,
            "error": str(error)
        }), 500
