import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {"pdf", "txt"}

    NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
    NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL","https://integrate.api.nvidia.com/v1")
    NVIDIA_MODEL = os.getenv("NVIDIA_MODEL","google/gemma-3-27b-it")

    # Optional: CORS settings for development
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")