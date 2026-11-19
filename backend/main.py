"""
main.py
FastAPI Server & WebSocket Engine for SRII ARTS Desktop NLE Studio.
"""

import os
import sys
import json
import time
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from dotenv import load_dotenv, set_key

from capcut_engine import CapCutDraft, CapCutScanner, CapCutEngineError
from ffmpeg_utils import FFmpegEngine
from gemini_pipeline import GeminiPipeline
from schemas import (
    SettingsUpdate,
    RippleDeleteRequest,
    InjectCaptionsRequest,
    AddBRollRequest,
    PresetApplyRequest,
    GenerateImageRequest,
    VideoDirectorAnalysis
)

# Load environment
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(ENV_PATH)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("srii_arts_api")

app = FastAPI(title="SRII ARTS NLE Backend", version="1.0.0")

# CORS setup
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # allow frontend development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
ffmpeg_engine = FFmpegEngine()
gemini_pipeline = GeminiPipeline()

# Ensure directories exist
BASE_DIR = Path(__file__).parent
ASSETS_DIR = BASE_DIR / "generated_assets"
PROXIES_DIR = BASE_DIR / "proxies"
SAMPLES_DIR = BASE_DIR / "sample_drafts"

for d in (ASSETS_DIR, PROXIES_DIR, SAMPLES_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Mount static asset directories
app.mount("/generated_assets", StaticFiles(directory=str(ASSETS_DIR)), name="generated_assets")
app.mount("/proxies", StaticFiles(directory=str(PROXIES_DIR)), name="proxies")


def get_draft_by_id(draft_id: str) -> CapCutDraft:
    """Finds draft across custom dir, local samples, or CapCut desktop."""
    custom_dir = os.getenv("CAPCUT_PROJECTS_DIR")
    projects = CapCutScanner.scan_projects(custom_dir)
    for p in projects:
        if p["id"] == draft_id:
            return CapCutDraft(p["path"])
    # Also check direct sample folder
    candidate = SAMPLES_DIR / draft_id
    if candidate.exists():
        return CapCutDraft(str(candidate))
    raise HTTPException(status_code=404, detail=f"Project draft '{draft_id}' not found.")


# -------------------------------------------------------------------------
# Streaming Video Range Handler (for smooth HTML5 video scrubbing)
# -------------------------------------------------------------------------
@app.get("/media/stream")
def stream_video(path: str = Query(...), request: Request = None):
    """
    HTTP 206 Partial Content video streamer for seamless scrubbing in HTML5 player.
    """
    file_path = Path(path).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file does not exist")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(file_path, media_type="video/mp4")

    # Parse byte range header
    byte_str = range_header.replace("bytes=", "")
    parts = byte_str.split("-")
    start = int(parts[0]) if parts[0] else 0
    end = int(parts[1]) if parts[1] else file_size - 1

    length = end - start + 1

    def iter_bytes():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = length
            chunk_size = 1024 * 1024  # 1MB
            while bytes_left > 0:
                read_amount = min(chunk_size, bytes_left)
                data = f.read(read_amount)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(length),
        "Content-Type": "video/mp4",
    }
    return StreamingResponse(iter_bytes(), status_code=206, headers=headers)


# -------------------------------------------------------------------------
# Project & Draft Endpoints
# -------------------------------------------------------------------------

@app.get("/api/projects")
def list_projects():
    custom_dir = os.getenv("CAPCUT_PROJECTS_DIR")
    projects = CapCutScanner.scan_projects(custom_dir)
    return {"projects": projects, "count": len(projects)}


@app.get("/api/projects/{draft_id}")
def get_project_details(draft_id: str):
    draft = get_draft_by_id(draft_id)
    summary = draft.to_summary_dict()

    # Look for existing proxy
    proxy_filename = f"proxy_{draft_id}.mp4"
    proxy_path = PROXIES_DIR / proxy_filename
    summary["proxy_url"] = f"/proxies/{proxy_filename}" if proxy_path.exists() else None

    # Waveform file
    wf_path = PROXIES_DIR / f"waveform_{draft_id}.json"
    summary["has_waveform"] = wf_path.exists()

    return summary


@app.post("/api/projects/{draft_id}/lock-check")
def check_project_lock(draft_id: str):
    draft = get_draft_by_id(draft_id)
    lock_info = draft.check_file_lock()
    return lock_info


@app.post("/api/projects/{draft_id}/sync-capcut")
def sync_and_write(draft_id: str):
    draft = get_draft_by_id(draft_id)
    lock_info = draft.check_file_lock()
    if lock_info["locked"]:
        return JSONResponse(
            status_code=409,
            content={"message": "CapCut currently has an exclusive lock on this project. Please close or pause CapCut before syncing.", "lock_info": lock_info}
        )

    snapshot = draft.create_snapshot("pre_sync_write")
    draft.save(create_backup=False)
    return {
        "status": "synchronized",
        "message": "All AI edits, captions, cuts, and B-roll tracks written safely to CapCut draft_content.json",
        "snapshot": snapshot
    }


# -------------------------------------------------------------------------
# Snapshots & Rollback Endpoints
# -------------------------------------------------------------------------

@app.get("/api/projects/{draft_id}/snapshots")
def list_snapshots(draft_id: str):
    draft = get_draft_by_id(draft_id)
    return {"snapshots": draft.list_snapshots()}


@app.post("/api/projects/{draft_id}/rollback")
def rollback_project(draft_id: str, version: str = Query(...)):
    draft = get_draft_by_id(draft_id)
    try:
        draft.rollback_snapshot(version)
        return {"status": "success", "message": f"Rolled back to snapshot {version}", "summary": draft.to_summary_dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------------------------------------------------------
# Proxy & Waveform Generation
# -------------------------------------------------------------------------

@app.post("/api/projects/{draft_id}/generate-proxy")
def generate_proxy(draft_id: str):
    draft = get_draft_by_id(draft_id)
    video_path = draft.get_main_video_file_path()

    # If no raw video path exists, create a synthetic test video
    if not video_path or not os.path.exists(video_path):
        demo_video = draft.draft_dir / "demo_talking_head.mp4"
        video_path = ffmpeg_engine.create_synthetic_demo_video(str(demo_video), duration_sec=int(draft.duration_seconds or 30))

    proxy_file = PROXIES_DIR / f"proxy_{draft_id}.mp4"
    wf_file = PROXIES_DIR / f"waveform_{draft_id}.json"

    # 1. Generate 480p proxy
    proxy_abs = ffmpeg_engine.generate_proxy(video_path, str(proxy_file))

    # 2. Extract 800 peak points for audio canvas
    peaks = ffmpeg_engine.extract_waveform_peaks(video_path, samples_count=800)
    with open(wf_file, "w", encoding="utf-8") as f:
        json.dump(peaks, f)

    # 3. Detect silence dead-air
    silences = ffmpeg_engine.detect_silence(video_path)

    return {
        "status": "success",
        "proxy_url": f"/proxies/{proxy_file.name}",
        "waveform_peaks_count": len(peaks),
        "silences_detected_count": len(silences),
        "silences": silences
    }


@app.get("/api/projects/{draft_id}/waveform")
def get_waveform(draft_id: str):
    wf_file = PROXIES_DIR / f"waveform_{draft_id}.json"
    if wf_file.exists():
        with open(wf_file, "r", encoding="utf-8") as f:
            peaks = json.load(f)
            return {"peaks": peaks}
    else:
        # Fallback synthetic peaks
        peaks = ffmpeg_engine._generate_synthetic_peaks(800)
        return {"peaks": peaks}


# -------------------------------------------------------------------------
# Timeline Mutations Endpoints
# -------------------------------------------------------------------------

@app.post("/api/projects/{draft_id}/ripple-delete")
def execute_ripple_delete(draft_id: str, req: RippleDeleteRequest):
    draft = get_draft_by_id(draft_id)
    # Convert seconds to microseconds
    cut_ranges_us = [(int(c.start_sec * 1_000_000), int(c.end_sec * 1_000_000)) for c in req.cuts]
    result = draft.ripple_delete(cut_ranges_us)
    result["summary"] = draft.to_summary_dict()
    return result


@app.post("/api/projects/{draft_id}/inject-captions")
def execute_inject_captions(draft_id: str, req: InjectCaptionsRequest):
    draft = get_draft_by_id(draft_id)
    caption_dicts = []
    for cap in req.captions:
        caption_dicts.append({
            "start_us": int(cap.start_sec * 1_000_000),
            "duration_us": int((cap.end_sec - cap.start_sec) * 1_000_000),
            "text": cap.text,
            "highlight": cap.highlight
        })
    result = draft.inject_captions(caption_dicts, style_preset=req.style_preset)
    result["summary"] = draft.to_summary_dict()
    return result


@app.post("/api/projects/{draft_id}/add-b-roll")
def execute_add_b_roll(draft_id: str, req: AddBRollRequest):
    draft = get_draft_by_id(draft_id)
    start_us = int(req.start_sec * 1_000_000)
    dur_us = int(req.duration_sec * 1_000_000)
    result = draft.add_b_roll_overlay(req.media_path, start_us=start_us, duration_us=dur_us)
    result["summary"] = draft.to_summary_dict()
    return result


@app.post("/api/projects/{draft_id}/apply-preset")
def apply_preset(draft_id: str, req: PresetApplyRequest):
    draft = get_draft_by_id(draft_id)
    preset = req.preset_name

    if preset == "youtube_retention":
        # Ripple cuts around 4.5s and 16s, inject bold captions
        cuts = [(int(4.2 * 1_000_000), int(5.0 * 1_000_000))]
        draft.ripple_delete(cuts)
        captions = [
            {"start_us": 0, "duration_us": 2_500_000, "text": "THE #1 EDITING SECRET", "highlight": True},
            {"start_us": 2_500_000, "duration_us": 3_000_000, "text": "BOOST YOUR RETENTION", "highlight": False},
            {"start_us": 5_500_000, "duration_us": 3_500_000, "text": "SRII ARTS STUDIO AI", "highlight": True}
        ]
        draft.inject_captions(captions, "hormozi")

    elif preset == "reels_high_pacing":
        cuts = [
            (int(3.8 * 1_000_000), int(4.6 * 1_000_000)),
            (int(12.0 * 1_000_000), int(13.2 * 1_000_000))
        ]
        draft.ripple_delete(cuts)
        captions = [
            {"start_us": 0, "duration_us": 2_000_000, "text": "STOP SCROLLING!", "highlight": True},
            {"start_us": 2_000_000, "duration_us": 2_200_000, "text": "WATCH THIS CUT", "highlight": False},
            {"start_us": 4_200_000, "duration_us": 2_500_000, "text": "INSTANT HIGH PACING", "highlight": True}
        ]
        draft.inject_captions(captions, "neon")

    elif preset == "podcast_cleanup":
        cuts = [
            (int(2.0 * 1_000_000), int(3.2 * 1_000_000)),
            (int(8.5 * 1_000_000), int(9.8 * 1_000_000))
        ]
        draft.ripple_delete(cuts)

    return {
        "status": "success",
        "preset_applied": preset,
        "summary": draft.to_summary_dict()
    }


# -------------------------------------------------------------------------
# Gemini Deep Multimodal Director Endpoint
# -------------------------------------------------------------------------

@app.post("/api/projects/{draft_id}/analyze-director")
def analyze_director(draft_id: str):
    draft = get_draft_by_id(draft_id)
    video_path = draft.get_main_video_file_path()

    if not video_path or not os.path.exists(video_path):
        demo_video = draft.draft_dir / "demo_talking_head.mp4"
        video_path = ffmpeg_engine.create_synthetic_demo_video(str(demo_video), duration_sec=int(draft.duration_seconds or 30))

    silences = ffmpeg_engine.detect_silence(video_path)
    analysis = gemini_pipeline.analyze_video_director(
        video_path=video_path,
        duration_sec=draft.duration_seconds,
        detected_silences=silences
    )
    return analysis.model_dump()


# -------------------------------------------------------------------------
# AI B-Roll & Thumbnail Asset Endpoints
# -------------------------------------------------------------------------

@app.post("/api/assets/generate")
def generate_asset(req: GenerateImageRequest):
    result = gemini_pipeline.generate_b_roll_image(
        prompt=req.prompt,
        aspect_ratio=req.aspect_ratio
    )
    return result


@app.get("/api/assets")
def list_assets():
    assets = []
    for p in sorted(ASSETS_DIR.glob("*.jpg"), key=os.path.getmtime, reverse=True):
        assets.append({
            "filename": p.name,
            "url": f"/generated_assets/{p.name}",
            "file_path": str(p),
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(p.stat().st_mtime))
        })
    return {"assets": assets, "count": len(assets)}


# -------------------------------------------------------------------------
# Settings Endpoints
# -------------------------------------------------------------------------

@app.get("/api/settings")
def get_settings():
    return {
        "gemini_api_key_configured": gemini_pipeline.is_configured(),
        "capcut_dir": os.getenv("CAPCUT_PROJECTS_DIR", ""),
        "ffmpeg_path": ffmpeg_engine.ffmpeg_exe,
        "models": {
            "director": "gemini-2.5-pro",
            "copilot": "gemini-2.5-flash",
            "image_gen": "imagen-3.0-generate-002"
        }
    }


@app.post("/api/settings")
def update_settings(settings: SettingsUpdate):
    if settings.gemini_api_key is not None:
        gemini_pipeline.update_api_key(settings.gemini_api_key)
        try:
            set_key(str(ENV_PATH), "GEMINI_API_KEY", settings.gemini_api_key)
        except Exception:
            pass

    if settings.capcut_dir is not None:
        os.environ["CAPCUT_PROJECTS_DIR"] = settings.capcut_dir
        try:
            set_key(str(ENV_PATH), "CAPCUT_PROJECTS_DIR", settings.capcut_dir)
        except Exception:
            pass

    return {
        "status": "updated",
        "gemini_api_key_configured": gemini_pipeline.is_configured(),
        "capcut_dir": os.getenv("CAPCUT_PROJECTS_DIR", "")
    }


# -------------------------------------------------------------------------
# WebSockets & HTTP Streaming: Real-Time Timeline Co-Pilot
# -------------------------------------------------------------------------

@app.post("/api/copilot/chat")
async def http_copilot_chat(req: Request):
    """
    HTTP Streaming fallback for environments/clouds without persistent WebSockets.
    """
    body = await req.json()
    user_msg = body.get("message", "")
    timeline_ctx = body.get("timeline_context", {})

    async def stream_generator():
        async for chunk in gemini_pipeline.stream_timeline_copilot(user_msg, timeline_ctx):
            yield chunk

    return StreamingResponse(stream_generator(), media_type="text/plain")


@app.websocket("/ws/copilot")
async def websocket_copilot(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket Co-Pilot connected.")

    try:
        while True:
            raw_msg = await websocket.receive_text()
            data = json.loads(raw_msg)
            user_msg = data.get("message", "")
            timeline_ctx = data.get("timeline_context", {})

            # Stream response chunk by chunk
            action_payload = None
            async for chunk in gemini_pipeline.stream_timeline_copilot(user_msg, timeline_ctx):
                await websocket.send_json({"type": "token", "content": chunk})

            # Check if there was an embedded timeline_action to trigger in UI
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("WebSocket Co-Pilot client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket Co-Pilot error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Keepalive ping
            data = await websocket.receive_text()
            await websocket.send_json({"status": "connected", "echo": data})
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=False)
