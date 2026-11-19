/**
 * api.ts
 * API Client for SRII ARTS Desktop NLE Backend.
 */

import {
  ProjectListItem,
  ProjectSummary,
  SnapshotItem,
  DirectorAnalysis,
  SettingsData,
  AssetRecord,
  CaptionItem
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL.startsWith('http') ? import.meta.env.VITE_API_URL : `https://${import.meta.env.VITE_API_URL}`)
  : '';
const API_BASE = `${BASE_URL}/api`;

export async function fetchProjects(): Promise<{ projects: ProjectListItem[]; count: number }> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function fetchProjectDetails(draftId: string): Promise<ProjectSummary> {
  const res = await fetch(`${API_BASE}/projects/${draftId}`);
  if (!res.ok) throw new Error('Failed to fetch project details');
  return res.json();
}

export async function checkProjectLock(draftId: string) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/lock-check`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to check project lock');
  return res.json();
}

export async function syncAndWriteToCapCut(draftId: string) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/sync-capcut`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to sync with CapCut');
  return data;
}

export async function fetchSnapshots(draftId: string): Promise<SnapshotItem[]> {
  const res = await fetch(`${API_BASE}/projects/${draftId}/snapshots`);
  if (!res.ok) throw new Error('Failed to fetch snapshots');
  const data = await res.json();
  return data.snapshots;
}

export async function rollbackSnapshot(draftId: string, version: string) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/rollback?version=${version}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to rollback snapshot');
  return res.json();
}

export async function generateProxy(draftId: string) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/generate-proxy`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to generate proxy video');
  return res.json();
}

export async function fetchWaveform(draftId: string): Promise<number[]> {
  const res = await fetch(`${API_BASE}/projects/${draftId}/waveform`);
  if (!res.ok) throw new Error('Failed to fetch waveform');
  const data = await res.json();
  return data.peaks;
}

export async function executeRippleDelete(
  draftId: string,
  cuts: Array<{ start_sec: number; end_sec: number }>
) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/ripple-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cuts })
  });
  if (!res.ok) throw new Error('Failed to execute ripple delete');
  return res.json();
}

export async function executeInjectCaptions(
  draftId: string,
  captions: CaptionItem[],
  stylePreset: 'hormozi' | 'neon' | 'clean'
) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/inject-captions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captions, style_preset: stylePreset })
  });
  if (!res.ok) throw new Error('Failed to inject captions');
  return res.json();
}

export async function executeAddBRoll(
  draftId: string,
  mediaPath: string,
  startSec: number,
  durationSec: number = 3.0
) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/add-b-roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_path: mediaPath,
      start_sec: startSec,
      duration_sec: durationSec
    })
  });
  if (!res.ok) throw new Error('Failed to add B-roll overlay');
  return res.json();
}

export async function applyPreset(
  draftId: string,
  presetName: 'youtube_retention' | 'reels_high_pacing' | 'podcast_cleanup'
) {
  const res = await fetch(`${API_BASE}/projects/${draftId}/apply-preset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset_name: presetName })
  });
  if (!res.ok) throw new Error('Failed to apply preset');
  return res.json();
}

export async function runDirectorAnalysis(draftId: string): Promise<DirectorAnalysis> {
  const res = await fetch(`${API_BASE}/projects/${draftId}/analyze-director`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Director analysis failed');
  return res.json();
}

export async function generateAsset(prompt: string, aspectRatio: '16:9' | '9:16' = '9:16') {
  const res = await fetch(`${API_BASE}/assets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio })
  });
  if (!res.ok) throw new Error('Failed to generate AI asset');
  return res.json();
}

export async function fetchAssets(): Promise<{ assets: AssetRecord[]; count: number }> {
  const res = await fetch(`${API_BASE}/assets`);
  if (!res.ok) throw new Error('Failed to fetch assets');
  return res.json();
}

export async function fetchSettings(): Promise<SettingsData> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: { gemini_api_key?: string; capcut_dir?: string }) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}
