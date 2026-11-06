import os
from pathlib import Path
from dotenv import load_dotenv

# Load env file
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class Settings:
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # LM Studio Hybrid AI settings
    LM_STUDIO_BASE_URL: str = os.getenv("LM_STUDIO_BASE_URL", os.getenv("LM_STUDIO_URL", "http://127.0.0.1:1234/v1"))
    PHI_MODEL: str = os.getenv("PHI_MODEL", "qwen3.5-9b")
    GEMMA_MODEL: str = os.getenv("GEMMA_MODEL", "qwen3.5-9b")
    REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", 120))
    CONCURRENT_LLM_INFERENCE: bool = os.getenv("CONCURRENT_LLM_INFERENCE", "False").lower() in ["true", "1", "yes"]

    # Gemini API key rotation (comma-separated in .env)
    GEMINI_API_KEYS: list = [
        k.strip() for k in os.getenv("GEMINI_API_KEYS", "").split(",") if k.strip()
    ]
    
    # Filesystem directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "uploads")
    EXTRACT_DIR: Path = BASE_DIR / os.getenv("EXTRACT_DIR", "extracted")

    def __init__(self):
        # Create directories if they do not exist
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.EXTRACT_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings()
