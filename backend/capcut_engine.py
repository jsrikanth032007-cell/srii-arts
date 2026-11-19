"""
capcut_engine.py
Precision Microsecond JSON Mutator & Project Manager for CapCut Desktop.
Handles draft_content.json & draft_meta_info.json with microsecond precision (1s = 1,000,000µs).
"""

import os
import json
import time
import uuid
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import psutil

logger = logging.getLogger("capcut_engine")

MICROSECONDS_PER_SECOND = 1_000_000


def generate_uuid() -> str:
    return str(uuid.uuid4()).upper()


class CapCutEngineError(Exception):
    pass


class CapCutDraft:
    """
    Precision parser and mutator for a CapCut Desktop project draft.
    """

    def __init__(self, draft_dir: str):
        self.draft_dir = Path(draft_dir).resolve()
        self.content_file = self.draft_dir / "draft_content.json"
        self.meta_file = self.draft_dir / "draft_meta_info.json"
        self.backups_dir = self.draft_dir / "backups"
        self.backups_dir.mkdir(parents=True, exist_ok=True)

        self.content: Dict[str, Any] = {}
        self.meta: Dict[str, Any] = {}
        self.reload()

    def reload(self):
        """Loads or reloads JSON files from disk."""
        if not self.content_file.exists():
            raise CapCutEngineError(f"draft_content.json not found in {self.draft_dir}")
        
        try:
            with open(self.content_file, "r", encoding="utf-8") as f:
                self.content = json.load(f)
        except Exception as e:
            raise CapCutEngineError(f"Failed to parse draft_content.json: {e}")

        if self.meta_file.exists():
            try:
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    self.meta = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load draft_meta_info.json: {e}")
                self.meta = {"draft_name": self.draft_dir.name}
        else:
            self.meta = {"draft_name": self.draft_dir.name}

    @property
    def name(self) -> str:
        return self.meta.get("draft_name") or self.meta.get("name") or self.draft_dir.name

    @property
    def duration_us(self) -> int:
        return int(self.content.get("duration", 0))

    @property
    def duration_seconds(self) -> float:
        return self.duration_us / MICROSECONDS_PER_SECOND

    @property
    def fps(self) -> float:
        return float(self.content.get("fps", 30.0))

    def check_file_lock(self) -> Dict[str, Any]:
        """
        Detects if CapCut Desktop is running and whether draft_content.json is locked.
        """
        capcut_running = False
        pids = []
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                pname = proc.info['name'].lower()
                if 'capcut' in pname or 'lveditor' in pname:
                    capcut_running = True
                    pids.append(proc.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        locked = False
        lock_error = None
        try:
            # Test exclusive append/write access
            with open(self.content_file, "r+", encoding="utf-8") as f:
                pass
        except IOError as e:
            locked = True
            lock_error = str(e)

        return {
            "locked": locked,
            "capcut_running": capcut_running,
            "running_pids": pids,
            "error": lock_error,
            "status": "LOCKED" if (locked or capcut_running) else "READY"
        }

    def create_snapshot(self, label: str = "auto_snapshot") -> Dict[str, Any]:
        """
        Creates a versioned backup before any mutation.
        """
        timestamp = int(time.time())
        existing = list(self.backups_dir.glob("v*_*_*.json"))
        version = len(existing) + 1
        safe_label = "".join(c if c.isalnum() else "_" for c in label)
        filename = f"v{version}_{timestamp}_{safe_label}.json"
        snapshot_path = self.backups_dir / filename

        snapshot_data = {
            "version": version,
            "timestamp": timestamp,
            "label": label,
            "draft_name": self.name,
            "content": self.content
        }

        with open(snapshot_path, "w", encoding="utf-8") as f:
            json.dump(snapshot_data, f, indent=2, ensure_ascii=False)

        return {
            "version": version,
            "timestamp": timestamp,
            "label": label,
            "filename": filename,
            "path": str(snapshot_path)
        }

    def list_snapshots(self) -> List[Dict[str, Any]]:
        """Lists all snapshots available for rollback."""
        snapshots = []
        for p in sorted(self.backups_dir.glob("v*.json"), key=os.path.getmtime, reverse=True):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    snapshots.append({
                        "version": data.get("version"),
                        "timestamp": data.get("timestamp"),
                        "label": data.get("label"),
                        "filename": p.name,
                        "path": str(p),
                        "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(data.get("timestamp", 0)))
                    })
            except Exception:
                continue
        return snapshots

    def rollback_snapshot(self, filename_or_version: Any) -> bool:
        """
        Restores draft_content.json from a specified snapshot.
        """
        target_file = None
        if isinstance(filename_or_version, int) or str(filename_or_version).isdigit():
            v_int = int(filename_or_version)
            for p in self.backups_dir.glob(f"v{v_int}_*.json"):
                target_file = p
                break
        else:
            candidate = self.backups_dir / str(filename_or_version)
            if candidate.exists():
                target_file = candidate

        if not target_file or not target_file.exists():
            raise CapCutEngineError(f"Snapshot not found: {filename_or_version}")

        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.content = data.get("content", data)

        self.save(create_backup=False)
        return True

    def get_tracks(self) -> List[Dict[str, Any]]:
        return self.content.setdefault("tracks", [])

    def get_materials(self) -> Dict[str, Any]:
        return self.content.setdefault("materials", {})

    def get_primary_video_track(self) -> Optional[Dict[str, Any]]:
        """Finds main video track (usually first track of type 'video')."""
        for track in self.get_tracks():
            if track.get("type") == "video":
                return track
        return None

    def get_main_video_file_path(self) -> Optional[str]:
        """Resolves the raw video file path used in the main track."""
        v_track = self.get_primary_video_track()
        if not v_track or not v_track.get("segments"):
            return None

        first_seg = v_track["segments"][0]
        mat_id = first_seg.get("material_id")
        videos = self.get_materials().get("videos", [])
        for v in videos:
            if v.get("id") == mat_id:
                path = v.get("path")
                if path and os.path.exists(path):
                    return path
        return None

    def ripple_delete(self, cut_ranges: List[Tuple[int, int]]) -> Dict[str, Any]:
        """
        Non-destructive ripple delete around filler words/silence.
        cut_ranges: list of (start_us, end_us) in timeline coordinates.
        Shifts all subsequent segments left so zero black-frame gaps remain.
        """
        if not cut_ranges:
            return {"status": "no_cuts_applied", "segments_modified": 0}

        # Normalize and merge overlapping cut ranges
        sorted_cuts = sorted(cut_ranges, key=lambda x: x[0])
        merged_cuts: List[Tuple[int, int]] = []
        for start, end in sorted_cuts:
            if start < 0:
                start = 0
            if end <= start:
                continue
            if not merged_cuts:
                merged_cuts.append((start, end))
            else:
                last_s, last_e = merged_cuts[-1]
                if start <= last_e:
                    merged_cuts[-1] = (last_s, max(last_e, end))
                else:
                    merged_cuts.append((start, end))

        self.create_snapshot("before_ripple_delete")

        # Process each track that contains segments (video, audio, text)
        tracks = self.get_tracks()
        total_time_saved = sum(end - start for start, end in merged_cuts)

        for track in tracks:
            old_segments = track.get("segments", [])
            if not old_segments:
                continue

            new_segments = []
            for seg in old_segments:
                tgt = seg.get("target_timerange", {})
                src = seg.get("source_timerange", {})
                seg_start = tgt.get("start", 0)
                seg_dur = tgt.get("duration", 0)
                seg_end = seg_start + seg_dur

                src_start = src.get("start", 0)
                src_dur = src.get("duration", 0)

                # Find overlap with cuts
                # Calculate preserved intervals within [seg_start, seg_end]
                preserved = []
                cur = seg_start
                for c_start, c_end in merged_cuts:
                    if c_end <= cur:
                        continue
                    if c_start >= seg_end:
                        break
                    if c_start > cur:
                        preserved.append((cur, min(c_start, seg_end)))
                    cur = max(cur, c_end)
                if cur < seg_end:
                    preserved.append((cur, seg_end))

                # Create new sub-segments for each preserved interval
                for p_start, p_end in preserved:
                    p_dur = p_end - p_start
                    if p_dur <= 1000: # skip microscopic slices (<1ms)
                        continue
                    
                    # Calculate new source range proportionally
                    offset_from_seg_start = p_start - seg_start
                    ratio = (src_dur / seg_dur) if seg_dur > 0 else 1.0
                    sub_src_start = int(src_start + offset_from_seg_start * ratio)
                    sub_src_dur = int(p_dur * ratio)

                    sub_seg = json.loads(json.dumps(seg))
                    sub_seg["id"] = generate_uuid()
                    sub_seg["source_timerange"] = {
                        "start": sub_src_start,
                        "duration": sub_src_dur
                    }
                    sub_seg["target_timerange"] = {
                        "start": p_start, # temporarily set
                        "duration": p_dur
                    }
                    new_segments.append(sub_seg)

            # Now perform ripple left shift: re-pack target_timerange start sequentially
            # to remove all dead air gaps!
            current_timeline_cursor = 0
            for seg in new_segments:
                dur = seg["target_timerange"]["duration"]
                seg["target_timerange"]["start"] = current_timeline_cursor
                current_timeline_cursor += dur

            track["segments"] = new_segments

        # Recalculate global draft duration
        max_duration = 0
        for track in self.get_tracks():
            for seg in track.get("segments", []):
                tgt = seg.get("target_timerange", {})
                end_pos = tgt.get("start", 0) + tgt.get("duration", 0)
                if end_pos > max_duration:
                    max_duration = end_pos

        self.content["duration"] = max_duration
        self.save(create_backup=False)

        return {
            "status": "success",
            "cuts_count": len(merged_cuts),
            "time_saved_us": total_time_saved,
            "time_saved_seconds": round(total_time_saved / MICROSECONDS_PER_SECOND, 2),
            "new_duration_seconds": round(max_duration / MICROSECONDS_PER_SECOND, 2)
        }

    def inject_captions(self, captions: List[Dict[str, Any]], style_preset: str = "hormozi") -> Dict[str, Any]:
        """
        Injects a dynamic subtitle track with styled text templates.
        captions: list of dicts: {"start_us": int, "duration_us": int, "text": str, "highlight": bool}
        style_preset: "hormozi" (bold uppercase yellow/white), "neon" (cyan glow), "clean" (minimal white)
        """
        self.create_snapshot(f"before_captions_{style_preset}")

        materials = self.get_materials()
        texts = materials.setdefault("texts", [])
        tracks = self.get_tracks()

        # Find or create a dedicated caption track
        caption_track = None
        for track in tracks:
            if track.get("type") == "text" and track.get("name") == "AI Subtitles":
                caption_track = track
                break

        if not caption_track:
            caption_track = {
                "id": generate_uuid(),
                "type": "text",
                "attribute": 0,
                "flag": 0,
                "name": "AI Subtitles",
                "segments": []
            }
            tracks.append(caption_track)
        else:
            caption_track["segments"] = []

        # Color schemes
        if style_preset == "hormozi":
            default_color = [1.0, 1.0, 1.0, 1.0]     # White
            highlight_color = [1.0, 0.9, 0.0, 1.0]   # Bold Yellow
            font_size = 14.0
            stroke_color = [0.0, 0.0, 0.0, 1.0]
            stroke_width = 2.0
        elif style_preset == "neon":
            default_color = [0.0, 0.9, 1.0, 1.0]     # Neon Cyan
            highlight_color = [1.0, 0.0, 0.6, 1.0]   # Neon Magenta
            font_size = 12.0
            stroke_color = [0.05, 0.05, 0.15, 1.0]
            stroke_width = 1.5
        else:
            default_color = [1.0, 1.0, 1.0, 1.0]
            highlight_color = [0.2, 0.6, 1.0, 1.0]
            font_size = 10.0
            stroke_color = [0.0, 0.0, 0.0, 0.8]
            stroke_width = 1.0

        injected_count = 0
        for cap in captions:
            text_str = str(cap.get("text", "")).strip()
            if not text_str:
                continue

            start_us = int(cap.get("start_us", 0))
            duration_us = int(cap.get("duration_us", 1_000_000))
            is_highlight = cap.get("highlight", False)

            if style_preset == "hormozi":
                text_str = text_str.upper()

            chosen_color = highlight_color if is_highlight else default_color

            mat_id = generate_uuid()
            text_material = {
                "id": mat_id,
                "type": "text",
                "content": json.dumps({
                    "text": text_str,
                    "styles": [{
                        "fill": {"alpha": chosen_color[3], "content": {"render_type": "solid", "solid": {"color": chosen_color[:3]}}},
                        "font": {"id": "", "path": ""},
                        "size": font_size,
                        "bold": True if style_preset == "hormozi" else False,
                        "strokes": [{"alpha": stroke_color[3], "color": stroke_color[:3], "width": stroke_width}]
                    }]
                }),
                "font_size": font_size,
                "text_color": chosen_color,
                "typesetting": 0,
                "alignment": 1  # Centered
            }
            texts.append(text_material)

            seg_id = generate_uuid()
            segment = {
                "id": seg_id,
                "material_id": mat_id,
                "render_index": 1000,
                "speed": 1.0,
                "source_timerange": {"start": 0, "duration": duration_us},
                "target_timerange": {"start": start_us, "duration": duration_us},
                "volume": 1.0
            }
            caption_track["segments"].append(segment)
            injected_count += 1

        self.save(create_backup=False)
        return {"status": "success", "injected_count": injected_count, "preset": style_preset}

    def add_b_roll_overlay(self, media_path: str, start_us: int, duration_us: int, is_photo: bool = True) -> Dict[str, Any]:
        """
        Inserts an AI-generated B-roll or overlay onto an upper video track (V2+).
        """
        media_abs = os.path.abspath(media_path)
        if not os.path.exists(media_abs):
            raise CapCutEngineError(f"Media file does not exist: {media_abs}")

        self.create_snapshot("before_broll_overlay")

        materials = self.get_materials()
        videos = materials.setdefault("videos", [])
        tracks = self.get_tracks()

        # Find or create upper overlay video track
        overlay_track = None
        video_track_count = 0
        for track in tracks:
            if track.get("type") == "video":
                video_track_count += 1
                if track.get("name") == "AI B-Roll Overlays" or video_track_count > 1:
                    overlay_track = track
                    break

        if not overlay_track:
            overlay_track = {
                "id": generate_uuid(),
                "type": "video",
                "attribute": 0,
                "flag": 0,
                "name": "AI B-Roll Overlays",
                "segments": []
            }
            # Insert before audio/text tracks, or at top
            tracks.insert(1 if len(tracks) > 1 else len(tracks), overlay_track)

        mat_id = generate_uuid()
        video_material = {
            "id": mat_id,
            "type": "photo" if is_photo else "video",
            "path": media_abs,
            "material_name": os.path.basename(media_abs),
            "duration": duration_us,
            "width": 1920,
            "height": 1080
        }
        videos.append(video_material)

        seg_id = generate_uuid()
        segment = {
            "id": seg_id,
            "material_id": mat_id,
            "render_index": 200,
            "speed": 1.0,
            "source_timerange": {"start": 0, "duration": duration_us},
            "target_timerange": {"start": start_us, "duration": duration_us},
            "volume": 1.0
        }
        overlay_track["segments"].append(segment)
        overlay_track["segments"].sort(key=lambda s: s.get("target_timerange", {}).get("start", 0))

        self.save(create_backup=False)
        return {
            "status": "success",
            "material_id": mat_id,
            "segment_id": seg_id,
            "start_us": start_us,
            "duration_us": duration_us
        }

    def save(self, create_backup: bool = True):
        """Atomically saves content back to draft_content.json."""
        if create_backup:
            self.create_snapshot("pre_save")

        temp_path = self.content_file.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(self.content, f, indent=2, ensure_ascii=False)
        
        # Replace atomically
        shutil.move(temp_path, self.content_file)

    def to_summary_dict(self) -> Dict[str, Any]:
        """Provides high-level timeline and track schema for frontend visualization."""
        tracks_summary = []
        for i, t in enumerate(self.get_tracks()):
            t_type = t.get("type", "unknown")
            t_name = t.get("name") or f"{t_type.capitalize()} Track {i + 1}"
            segments_summary = []
            for seg in t.get("segments", []):
                tgt = seg.get("target_timerange", {})
                src = seg.get("source_timerange", {})
                mat_id = seg.get("material_id")
                
                # Resolve material name or text content
                content_preview = ""
                if t_type == "text":
                    for m in self.get_materials().get("texts", []):
                        if m.get("id") == mat_id:
                            try:
                                parsed = json.loads(m.get("content", "{}"))
                                content_preview = parsed.get("text", "")
                            except Exception:
                                content_preview = str(m.get("content", ""))
                            break
                elif t_type == "video":
                    for m in self.get_materials().get("videos", []):
                        if m.get("id") == mat_id:
                            content_preview = m.get("material_name") or os.path.basename(m.get("path", ""))
                            break

                segments_summary.append({
                    "id": seg.get("id"),
                    "material_id": mat_id,
                    "target_start_us": tgt.get("start", 0),
                    "target_duration_us": tgt.get("duration", 0),
                    "target_start_sec": tgt.get("start", 0) / MICROSECONDS_PER_SECOND,
                    "target_duration_sec": tgt.get("duration", 0) / MICROSECONDS_PER_SECOND,
                    "source_start_us": src.get("start", 0),
                    "source_duration_us": src.get("duration", 0),
                    "content_preview": content_preview,
                    "is_cut": False # UI state
                })

            tracks_summary.append({
                "id": t.get("id"),
                "type": t_type,
                "name": t_name,
                "attribute": t.get("attribute", 0),
                "segments": segments_summary
            })

        lock_info = self.check_file_lock()

        return {
            "draft_id": self.draft_dir.name,
            "draft_name": self.name,
            "duration_us": self.duration_us,
            "duration_seconds": self.duration_seconds,
            "fps": self.fps,
            "tracks": tracks_summary,
            "raw_video_path": self.get_main_video_file_path(),
            "lock_info": lock_info,
            "snapshots_count": len(self.list_snapshots())
        }


class CapCutScanner:
    """
    Auto-discovers CapCut projects on Windows, allows custom project paths,
    and scaffolds sample realistic projects when CapCut is not installed.
    """

    @staticmethod
    def get_default_capcut_path() -> Path:
        local_app_data = os.getenv("LOCALAPPDATA", "")
        if local_app_data:
            return Path(local_app_data) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
        return Path.home() / "AppData" / "Local" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"

    @classmethod
    def scan_projects(cls, custom_dir: Optional[str] = None) -> List[Dict[str, Any]]:
        search_dirs = []
        
        # 1. Custom directory if provided
        if custom_dir and os.path.exists(custom_dir):
            search_dirs.append(Path(custom_dir))

        # 2. Local backend sample drafts (always accessible)
        local_samples = Path(__file__).parent / "sample_drafts"
        if local_samples.exists():
            search_dirs.append(local_samples)

        # 3. Standard Windows CapCut directory (if accessible)
        default_capcut = cls.get_default_capcut_path()
        try:
            if default_capcut.exists():
                search_dirs.append(default_capcut)
        except Exception as e:
            logger.debug(f"CapCut default dir inaccessible: {e}")

        found_projects = []
        seen_paths = set()

        for base_dir in search_dirs:
            try:
                for item in base_dir.iterdir():
                    if item.is_dir() and (item / "draft_content.json").exists():
                        abs_str = str(item.resolve())
                        if abs_str not in seen_paths:
                            seen_paths.add(abs_str)
                            try:
                                draft = CapCutDraft(abs_str)
                                found_projects.append({
                                    "id": item.name,
                                    "name": draft.name,
                                    "path": abs_str,
                                    "duration_seconds": draft.duration_seconds,
                                    "fps": draft.fps,
                                    "status": draft.check_file_lock()["status"],
                                    "is_sample": "sample_drafts" in abs_str
                                })
                            except Exception as e:
                                logger.warning(f"Could not load draft at {item}: {e}")
            except Exception as e:
                logger.debug(f"Error scanning {base_dir}: {e}")

        # If no projects exist, generate a realistic sample draft automatically!
        if not found_projects:
            sample = cls.create_sample_draft()
            found_projects.append(sample)

        return found_projects

    @classmethod
    def create_sample_draft(cls, name: str = "Demo_Viral_Reel") -> Dict[str, Any]:
        """
        Creates a realistic, complete CapCut Desktop sample project
        ready for instant testing and demonstration.
        """
        sample_dir = Path(__file__).parent / "sample_drafts" / name
        sample_dir.mkdir(parents=True, exist_ok=True)

        content_file = sample_dir / "draft_content.json"
        meta_file = sample_dir / "draft_meta_info.json"

        # Mock media id
        v_mat_id = generate_uuid()
        t_mat_id1 = generate_uuid()
        t_mat_id2 = generate_uuid()

        # 45 seconds sample: 45_000_000 microseconds
        duration_us = 45_000_000

        content = {
            "canvas_config": {"height": 1920, "ratio": "9:16", "width": 1080},
            "duration": duration_us,
            "fps": 30.0,
            "materials": {
                "videos": [
                    {
                        "id": v_mat_id,
                        "type": "video",
                        "path": str((sample_dir / "demo_talking_head.mp4").resolve()),
                        "material_name": "demo_talking_head.mp4",
                        "duration": duration_us,
                        "width": 1080,
                        "height": 1920
                    }
                ],
                "texts": [
                    {
                        "id": t_mat_id1,
                        "type": "text",
                        "content": json.dumps({
                            "text": "STOP WASTING TIME!",
                            "styles": [{
                                "fill": {"alpha": 1.0, "content": {"render_type": "solid", "solid": {"color": [1.0, 0.9, 0.0]}}},
                                "size": 14.0,
                                "bold": True
                            }]
                        }),
                        "font_size": 14.0
                    },
                    {
                        "id": t_mat_id2,
                        "type": "text",
                        "content": json.dumps({
                            "text": "USE AI EDITING",
                            "styles": [{
                                "fill": {"alpha": 1.0, "content": {"render_type": "solid", "solid": {"color": [1.0, 1.0, 1.0]}}},
                                "size": 14.0,
                                "bold": True
                            }]
                        }),
                        "font_size": 14.0
                    }
                ]
            },
            "tracks": [
                {
                    "id": generate_uuid(),
                    "type": "video",
                    "attribute": 0,
                    "flag": 0,
                    "name": "Main Video (V1)",
                    "segments": [
                        # 3 realistic segments with filler pauses between them
                        {
                            "id": generate_uuid(),
                            "material_id": v_mat_id,
                            "render_index": 0,
                            "speed": 1.0,
                            "source_timerange": {"start": 0, "duration": 12_000_000},
                            "target_timerange": {"start": 0, "duration": 12_000_000},
                            "volume": 1.0
                        },
                        {
                            "id": generate_uuid(),
                            "material_id": v_mat_id,
                            "render_index": 0,
                            "speed": 1.0,
                            "source_timerange": {"start": 14_000_000, "duration": 15_000_000},
                            "target_timerange": {"start": 12_000_000, "duration": 15_000_000},
                            "volume": 1.0
                        },
                        {
                            "id": generate_uuid(),
                            "material_id": v_mat_id,
                            "render_index": 0,
                            "speed": 1.0,
                            "source_timerange": {"start": 31_000_000, "duration": 18_000_000},
                            "target_timerange": {"start": 27_000_000, "duration": 18_000_000},
                            "volume": 1.0
                        }
                    ]
                },
                {
                    "id": generate_uuid(),
                    "type": "text",
                    "attribute": 0,
                    "flag": 0,
                    "name": "AI Subtitles",
                    "segments": [
                        {
                            "id": generate_uuid(),
                            "material_id": t_mat_id1,
                            "render_index": 1000,
                            "speed": 1.0,
                            "source_timerange": {"start": 0, "duration": 3_000_000},
                            "target_timerange": {"start": 0, "duration": 3_000_000},
                            "volume": 1.0
                        },
                        {
                            "id": generate_uuid(),
                            "material_id": t_mat_id2,
                            "render_index": 1000,
                            "speed": 1.0,
                            "source_timerange": {"start": 0, "duration": 3_000_000},
                            "target_timerange": {"start": 3_000_000, "duration": 3_000_000},
                            "volume": 1.0
                        }
                    ]
                }
            ]
        }

        meta = {
            "draft_id": generate_uuid(),
            "draft_name": name,
            "draft_root_path": str(sample_dir.resolve()),
            "tm_draft_create": int(time.time()),
            "tm_draft_modified": int(time.time())
        }

        with open(content_file, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2)

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return {
            "id": name,
            "name": name,
            "path": str(sample_dir.resolve()),
            "duration_seconds": duration_us / MICROSECONDS_PER_SECOND,
            "fps": 30.0,
            "status": "READY",
            "is_sample": True
        }
