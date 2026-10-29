import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = Path(
    os.getenv(
        "DATA_PATH",
        str(BACKEND_DIR / "data" / "CLEAN - Transactions.csv"),
    )
).expanduser()
CURRENCY_CODE = os.getenv("CURRENCY_CODE") or None

configured_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
CORS_ORIGINS = [
    origin.strip() for origin in configured_origins.split(",") if origin.strip()
]
