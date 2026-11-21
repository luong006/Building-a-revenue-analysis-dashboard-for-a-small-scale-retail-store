import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = BACKEND_DIR / "data" / "CLEAN - Transactions.csv"
if not DEFAULT_DATA_PATH.is_file():
    DEFAULT_DATA_PATH = BACKEND_DIR / "data" / "Coffee Shop Sales.csv"
DATA_PATH = Path(
    os.getenv("DATA_PATH", str(DEFAULT_DATA_PATH))
).expanduser()
CURRENCY_CODE = os.getenv("CURRENCY_CODE") or "USD"

configured_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,https://retail-pulse-dashboard-eight.vercel.app",
)
CORS_ORIGINS = [
    origin.strip() for origin in configured_origins.split(",") if origin.strip()
]
