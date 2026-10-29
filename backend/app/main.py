from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.config import CORS_ORIGINS

app = FastAPI(
    title="Retail Pulse Analytics API",
    description="API phân tích dữ liệu bán hàng lịch sử cho đồ án ISV3010.",
    version="1.0.0"
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
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
