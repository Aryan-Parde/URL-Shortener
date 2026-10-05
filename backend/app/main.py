from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.analytics import router as analytics_router
from app.routers.redirect import router as redirect_router
from app.routers.shorten import router as shorten_router

app = FastAPI(title="URL Shortener")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(shorten_router)
app.include_router(redirect_router)
app.include_router(analytics_router)

# Checks FastAPI health status like application  and routing are working fine or not
@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
