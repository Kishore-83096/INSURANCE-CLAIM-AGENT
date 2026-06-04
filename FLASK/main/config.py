import os
from dotenv import load_dotenv

load_dotenv()


def get_cors_origins():
    configured_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    origins = [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]

    flask_env = os.getenv("FLASK_ENV", "").lower()
    flask_debug = os.getenv("FLASK_DEBUG", "").lower()
    is_development = flask_env != "production" or flask_debug in {"1", "true", "yes"}

    if is_development:
        origins.extend([
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ])

    return list(dict.fromkeys(origins))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {"pdf", "txt"}

    NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
    NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL","https://integrate.api.nvidia.com/v1")
    NVIDIA_MODEL = os.getenv("NVIDIA_MODEL","google/gemma-3-27b-it")

    # Optional: CORS settings for development
    CORS_ORIGINS = get_cors_origins()
