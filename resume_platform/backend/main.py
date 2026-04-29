"""FastAPI backend for Resume Intelligence Platform V2."""

from __future__ import annotations

import json
import os
import tempfile
import time
import uuid
from typing import Any, Dict

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from engine.resume_builder import build_final_docx
from orchestrator import Orchestrator
from parser import parse_resume


app = FastAPI(title="Resume Intelligence Platform V2")
job_store: Dict[str, Dict[str, Any]] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GapCloseRequest(BaseModel):
    """Gap close request payload."""

    job_id: str
    jd_text: str = ""
    style: str = "balanced"


def _json_event(payload: dict) -> str:
    """Serialize one SSE data event."""
    return f"data: {json.dumps(payload, default=str)}\n\n"


def run_pipeline_task(job_id: str, temp_path: str, jd_text: str, run_sim: bool) -> None:
    """Run the full pipeline in a background task and update job_store."""
    try:
        resume_text = parse_resume(temp_path)
        job_store[job_id]["resume_text"] = resume_text

        def progress_cb(event: dict) -> None:
            event = {**event, "status": "running"}
            job_store[job_id]["progress"].append(event)

        result = Orchestrator(user_id=job_id).run_full_evaluation(
            resume_text=resume_text,
            jd_text=jd_text,
            run_sim=run_sim,
            progress_cb=progress_cb,
        )
        job_store[job_id]["result"] = result
        job_store[job_id]["status"] = "complete"
        job_store[job_id]["progress"].append({
            "step": 4,
            "label": "Analysis complete",
            "pct": 100,
            "status": "complete",
            "result": result,
        })
    except Exception as exc:
        job_store[job_id]["status"] = "error"
        job_store[job_id]["error"] = str(exc)
        job_store[job_id]["progress"].append({
            "step": 0,
            "label": str(exc),
            "pct": 100,
            "status": "error",
        })
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@app.post("/api/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    resume: UploadFile = File(...),
    jd_text: str = Form(""),
    run_sim: bool = Form(False),
) -> dict:
    """Accept a resume upload and start analysis."""
    suffix = os.path.splitext(resume.filename or "resume.txt")[1] or ".txt"
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as tmp:
        tmp.write(await resume.read())

    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "status": "running",
        "progress": [{"step": 1, "label": "Queued", "pct": 1, "status": "running"}],
        "result": None,
        "error": None,
        "resume_text": "",
    }
    background_tasks.add_task(run_pipeline_task, job_id, temp_path, jd_text, run_sim)
    return {"job_id": job_id}


@app.get("/api/stream/{job_id}")
def stream(job_id: str):
    """Stream job progress as Server-Sent Events."""
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail="Job not found")

    def event_generator():
        index = 0
        while True:
            job = job_store[job_id]
            events = job.get("progress", [])
            while index < len(events):
                yield _json_event(events[index])
                index += 1
            if job.get("status") in {"complete", "error"}:
                break
            time.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/result/{job_id}")
def result(job_id: str) -> dict:
    """Return current job status and result for polling fallback."""
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail="Job not found")
    job = job_store[job_id]
    return {
        "status": job.get("status"),
        "result": job.get("result"),
        "error": job.get("error"),
        "progress": job.get("progress", [])[-1] if job.get("progress") else None,
    }


@app.post("/api/gap-close")
def gap_close(req: GapCloseRequest) -> dict:
    """Run gap-close rewrite for an existing job and cache rewrites."""
    if req.job_id not in job_store:
        raise HTTPException(status_code=404, detail="Job not found")
    job = job_store[req.job_id]
    resume_text = job.get("resume_text")
    if not resume_text:
        raise HTTPException(status_code=400, detail="Resume text not available")

    result = Orchestrator(user_id=req.job_id).run_full_evaluation(
        resume_text=resume_text,
        jd_text=req.jd_text,
        run_sim=False,
        skip_rewrite=False,
    )
    job["gap_result"] = result.get("gap")
    job["rewrites"] = result.get("rewrites")
    job["result"] = {**(job.get("result") or {}), **result}
    return {"gap": result.get("gap"), "rewrites": result.get("rewrites")}


@app.get("/api/download/{job_id}")
def download(job_id: str, style: str = "balanced") -> Response:
    """Download a generated resume docx for a completed job."""
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail="Job not found")
    job = job_store[job_id]
    result = job.get("result") or {}
    structured = result.get("resume") or {}
    rewrites = job.get("rewrites") or (result.get("rewrites") or {}).get("rewrites") or {}
    docx = build_final_docx(structured=structured, rewrites=rewrites, style=style)
    return Response(
        content=docx,
        media_type="application/octet-stream",
        headers={"Content-Disposition": 'attachment; filename="resume.docx"'},
    )
