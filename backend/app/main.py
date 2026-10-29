from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.user_routes import router as user_router
from app.core.config import CORS_ORIGINS
from app.core.persistence import initialize_database

app = FastAPI(
    title="Retail Pulse Analytics API",
    description="API phân tích dữ liệu bán hàng với dataset riêng theo tài khoản.",
    version="2.0.0",
)

# CORS setup for Vercel, Render and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(user_router)


@app.on_event("startup")
def startup_database():
    initialize_database()

@app.get("/healthz", include_in_schema=False)
def platform_health_check():
    return {"status": "healthy"}

@app.get("/")
def root():
    return {
        "message": "Welcome to Retail Pulse Analytics API",
        "docs_url": "/docs",
        "health_check": "/healthz",
        "dataset_status": "/api/health",
        "account_dataset_api": "/api/datasets",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
