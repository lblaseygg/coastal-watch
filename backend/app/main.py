from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.admin import router as admin_router
from app.api.public import router as public_router
from app.core.config import settings
from app.schemas import error_payload, success_payload


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_router, prefix=settings.api_prefix)
app.include_router(admin_router, prefix=settings.api_prefix)


@app.get("/health")
def healthcheck() -> dict:
    return success_payload({"status": "ok", "environment": settings.app_env})


@app.exception_handler(HTTPException)
def http_exception_handler(_, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    code = "not_found" if exc.status_code == 404 else "request_error"
    return JSONResponse(status_code=exc.status_code, content=error_payload(code, detail))


@app.exception_handler(404)
def not_found_handler(_, exc: Exception) -> JSONResponse:
    detail = getattr(exc, "detail", "Resource not found")
    return JSONResponse(status_code=404, content=error_payload("not_found", str(detail)))
