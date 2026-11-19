"""
schemas.py
Pydantic Schemas for CapCut NLE Engine, Gemini Video Director, and Timeline Mutations.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# -------------------------------------------------------------------------
# Gemini Deep Multimodal Video Director Schemas
# -------------------------------------------------------------------------

class DeadAirSegment(BaseModel):
    start_sec: float = Field(..., description="Start timestamp of silence/filler in seconds")
    end_sec: float = Field(..., description="End timestamp of silence/filler in seconds")
    reason: str = Field(..., description="Reason for cut, e.g. 'filler word um', 'dead silence', 'hesitation'")


class BRollGap(BaseModel):
    timestamp_sec: float = Field(..., description="Timestamp in seconds where B-Roll should appear")
    duration_sec: float = Field(..., description="Duration in seconds for the overlay (e.g. 2.5s)")
    visual_prompt: str = Field(..., description="High-detail prompt for Imagen 3 generation")
    aspect_ratio: str = Field(default="9:16", description="'16:9' or '9:16'")
    purpose: str = Field(..., description="Why this B-roll elevates retention here")


class SceneItem(BaseModel):
    start_sec: float
    end_sec: float
    description: str
    energy_level: Literal["High", "Medium", "Low"]


class CaptionItem(BaseModel):
    start_sec: float
    end_sec: float
    text: str
    highlight: bool = False


class VideoDirectorAnalysis(BaseModel):
    retention_score: int = Field(..., ge=0, le=100, description="Overall audience retention rating 0-100")
    hook_critique: str = Field(..., description="Critique of the first 3-5 seconds hook")
    pacing_score: int = Field(..., ge=0, le=100, description="Editing rhythm score 0-100")
    pacing_feedback: str = Field(..., description="Recommendations for cuts and transitions")
    viral_hook_alternatives: List[str] = Field(default_factory=list, description="Alternative viral hooks")
    scenes: List[SceneItem] = Field(default_factory=list)
    dead_air_segments: List[DeadAirSegment] = Field(default_factory=list)
    b_roll_suggestions: List[BRollGap] = Field(default_factory=list)
    captions: List[CaptionItem] = Field(default_factory=list)


# -------------------------------------------------------------------------
# Timeline Actions & Mutation Schemas
# -------------------------------------------------------------------------

class CutRange(BaseModel):
    start_sec: float
    end_sec: float


class RippleDeleteRequest(BaseModel):
    cuts: List[CutRange]


class InjectCaptionsRequest(BaseModel):
    captions: List[CaptionItem]
    style_preset: Literal["hormozi", "neon", "clean"] = "hormozi"


class AddBRollRequest(BaseModel):
    media_path: str
    start_sec: float
    duration_sec: float = 3.0


class TimelineAction(BaseModel):
    action_type: Literal["RIPPLE_DELETE", "INJECT_CAPTIONS", "ADD_B_ROLL", "APPLY_PRESET"]
    description: str
    parameters: Dict[str, Any]


class CoPilotResponse(BaseModel):
    text: str
    suggested_actions: List[TimelineAction] = Field(default_factory=list)


# -------------------------------------------------------------------------
# Project & Settings Schemas
# -------------------------------------------------------------------------

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    capcut_dir: Optional[str] = None


class PresetApplyRequest(BaseModel):
    preset_name: Literal["youtube_retention", "reels_high_pacing", "podcast_cleanup"]


class GenerateImageRequest(BaseModel):
    prompt: str
    aspect_ratio: Literal["16:9", "9:16"] = "9:16"
    title: Optional[str] = None
