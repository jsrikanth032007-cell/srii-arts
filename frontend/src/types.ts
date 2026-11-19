/**
 * types.ts
 * Type definitions for SRII ARTS Desktop NLE Studio.
 */

export interface Segment {
  id: string;
  material_id: string;
  target_start_us: number;
  target_duration_us: number;
  target_start_sec: number;
  target_duration_sec: number;
  source_start_us: number;
  source_duration_us: number;
  content_preview: string;
  is_cut?: boolean; // UI state for Keep (false) vs Cut (true)
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'effect' | string;
  name: string;
  attribute: number;
  segments: Segment[];
}

export interface LockInfo {
  locked: boolean;
  capcut_running: boolean;
  running_pids: number[];
  error: string | null;
  status: 'LOCKED' | 'READY';
}

export interface ProjectSummary {
  draft_id: string;
  draft_name: string;
  duration_us: number;
  duration_seconds: number;
  fps: number;
  tracks: Track[];
  raw_video_path: string | null;
  lock_info: LockInfo;
  snapshots_count: number;
  proxy_url?: string | null;
  has_waveform?: boolean;
}

export interface ProjectListItem {
  id: string;
  name: string;
  path: string;
  duration_seconds: number;
  fps: number;
  status: 'LOCKED' | 'READY';
  is_sample?: boolean;
}

export interface SnapshotItem {
  version: number;
  timestamp: number;
  label: string;
  filename: string;
  path: string;
  created_at: string;
}

export interface DeadAirSegment {
  start_sec: floatNumber;
  end_sec: floatNumber;
  reason: string;
}

export interface BRollGap {
  timestamp_sec: floatNumber;
  duration_sec: floatNumber;
  visual_prompt: string;
  aspect_ratio: '16:9' | '9:16';
  purpose: string;
}

export interface SceneItem {
  start_sec: floatNumber;
  end_sec: floatNumber;
  description: string;
  energy_level: 'High' | 'Medium' | 'Low';
}

export interface CaptionItem {
  start_sec: floatNumber;
  end_sec: floatNumber;
  text: string;
  highlight: boolean;
}

export interface DirectorAnalysis {
  retention_score: number;
  hook_critique: string;
  pacing_score: number;
  pacing_feedback: string;
  viral_hook_alternatives: string[];
  scenes: SceneItem[];
  dead_air_segments: DeadAirSegment[];
  b_roll_suggestions: BRollGap[];
  captions: CaptionItem[];
}

export interface TimelineAction {
  action_type: 'RIPPLE_DELETE' | 'INJECT_CAPTIONS' | 'ADD_B_ROLL' | 'APPLY_PRESET';
  description: string;
  parameters: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  suggestedAction?: TimelineAction;
}

export interface AssetRecord {
  filename: string;
  url: string;
  file_path: string;
  created_at: string;
}

export interface SettingsData {
  gemini_api_key_configured: boolean;
  capcut_dir: string;
  ffmpeg_path: string;
  models: {
    director: string;
    copilot: string;
    image_gen: string;
  };
}

type floatNumber = number;
