from main.services import home, health_check, upload_claim_file,extract_claim_text,extract_claim_fields_api,validate_claim_fields,route_claim_api,nvidia_ai_health_check,ai_extract_claim_fields,ai_validate_claim_fields,ai_explain_route


def register_routes(app):
    app.add_url_rule("/", view_func=home, methods=["GET"])
    app.add_url_rule("/api/health", view_func=health_check, methods=["GET"])
    app.add_url_rule("/api/claims/upload",view_func=upload_claim_file,methods=["POST"])
    app.add_url_rule("/api/claims/extract-text",view_func=extract_claim_text,methods=["POST"])
    app.add_url_rule("/api/claims/extract-fields", view_func=extract_claim_fields_api, methods=["POST"])
    app.add_url_rule("/api/claims/validate", view_func=validate_claim_fields, methods=["POST"])
    app.add_url_rule("/api/claims/route", view_func=route_claim_api, methods=["POST"])
    app.add_url_rule("/api/nvidia/health", view_func=nvidia_ai_health_check, methods=["GET"])
    app.add_url_rule("/api/claims/ai/extract-fields",view_func=ai_extract_claim_fields,methods=["POST"])
    app.add_url_rule( "/api/claims/ai/validate",view_func=ai_validate_claim_fields,methods=["POST"])
    app.add_url_rule("/api/claims/ai/explain-route",view_func=ai_explain_route,methods=["POST"])