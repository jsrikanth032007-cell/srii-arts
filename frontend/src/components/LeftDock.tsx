import React, { useState } from 'react';
import {
  FolderOpen,
  Image as ImageIcon,
  Sparkles,
  Zap,
  Play,
  Plus,
  RefreshCw,
  Video,
  Clock,
  Flame,
  Mic,
  SlidersHorizontal
} from 'lucide-react';
import { ProjectSummary, AssetRecord } from '../types';
import { formatDurationHuman } from '../utils/timecode';

interface LeftDockProps {
  project: ProjectSummary | null;
  assets: AssetRecord[];
  onGenerateProxy: () => void;
  isGeneratingProxy: boolean;
  onGenerateAssetPrompt: (prompt: string, aspectRatio: '16:9' | '9:16') => void;
  isGeneratingAsset: boolean;
  onInsertBRollAtPlayhead: (assetPath: string) => void;
  onApplyPreset: (preset: 'youtube_retention' | 'reels_high_pacing' | 'podcast_cleanup') => void;
  isApplyingPreset: boolean;
}

export const LeftDock: React.FC<LeftDockProps> = ({
  project,
  assets,
  onGenerateProxy,
  isGeneratingProxy,
  onGenerateAssetPrompt,
  isGeneratingAsset,
  onInsertBRollAtPlayhead,
  onApplyPreset,
  isApplyingPreset
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'broll' | 'presets'>('media');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('9:16');

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    onGenerateAssetPrompt(customPrompt.trim(), aspectRatio);
    setCustomPrompt('');
    setShowPromptModal(false);
  };

  return (
    <aside className="w-80 bg-nle-surface border-r border-nle-border flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Dock Tabs Header */}
      <div className="flex items-center border-b border-nle-border bg-nle-header/50">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'media'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Media Bin</span>
        </button>

        <button
          onClick={() => setActiveTab('broll')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'broll'
              ? 'border-purple-500 text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>AI Assets</span>
          {assets.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
              {assets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border-b-2 ${
            activeTab === 'presets'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Presets</span>
        </button>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TAB 1: MEDIA BIN */}
        {activeTab === 'media' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Primary Clip & Proxy</span>
              <span className="font-mono text-[11px] text-slate-500">{project?.fps || 30} FPS</span>
            </div>

            {/* Video File Card */}
            <div className="p-3 rounded-lg bg-nle-bg border border-nle-border space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-200 truncate" title={project?.raw_video_path || 'Main Video Clip'}>
                    {project?.raw_video_path ? project.raw_video_path.split(/[\\/]/).pop() : 'Demo Talking Head Clip'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {formatDurationHuman(project?.duration_seconds || 0)} • {project?.tracks.length || 0} Tracks
                  </div>
                </div>
              </div>

              {/* Proxy Generator Button */}
              <button
                onClick={onGenerateProxy}
                disabled={isGeneratingProxy}
                className="w-full py-1.5 px-3 rounded-md bg-nle-surface hover:bg-nle-hover text-slate-200 text-xs font-medium border border-nle-border flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingProxy ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                <span>{isGeneratingProxy ? 'Encoding 480p Proxy...' : project?.proxy_url ? 'Regenerate 480p Web Proxy' : 'Generate 480p Web Proxy'}</span>
              </button>

              {project?.proxy_url && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>480p Web Proxy Active & Cached</span>
                </div>
              )}
            </div>

            {/* Track Breakdown list */}
            <div className="pt-2">
              <div className="text-xs text-slate-400 px-1 mb-2">Timeline Tracks Breakdown</div>
              <div className="space-y-1.5">
                {project?.tracks.map((t, idx) => (
                  <div key={t.id || idx} className="p-2 rounded bg-nle-bg/70 border border-nle-border/60 text-xs flex items-center justify-between">
                    <span className="text-slate-300 font-medium truncate max-w-[170px]">{t.name}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {t.segments.length} segs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI ASSETS & B-ROLL */}
        {activeTab === 'broll' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-400">Imagen 3 Overlays</span>
              <button
                onClick={() => setShowPromptModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 text-[11px] font-medium border border-purple-500/30 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>Generate</span>
              </button>
            </div>

            {/* Asset Cards Grid */}
            {assets.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed border-nle-border text-slate-500 text-xs space-y-2">
                <Sparkles className="w-6 h-6 mx-auto text-slate-600" />
                <p>No AI overlays generated yet.</p>
                <p className="text-[11px] text-slate-600">Click Generate or use the Gemini Director suggestions to create visual B-roll.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {assets.map((asset, idx) => (
                  <div
                    key={asset.filename || idx}
                    className="group relative rounded-lg overflow-hidden border border-nle-border bg-nle-bg hover:border-purple-500/50 transition-all cursor-pointer"
                    onClick={() => onInsertBRollAtPlayhead(asset.file_path)}
                  >
                    <img
                      src={asset.url}
                      alt={asset.filename}
                      className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                      <span className="text-[10px] font-medium text-white truncate">{asset.filename}</span>
                      <span className="text-[9px] text-purple-300 font-semibold flex items-center gap-1">
                        <Plus className="w-2.5 h-2.5" /> Insert to V2
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUICK-ACTION PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 px-1">One-Click Editing Automations</div>

            {/* YouTube Retention Cut */}
            <div className="p-3 rounded-lg bg-nle-bg border border-nle-border hover:border-blue-500/40 transition-all space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">YouTube Retention Cut</div>
                  <div className="text-[11px] text-slate-400">Trims pauses &gt;0.5s + bold 3-word captions</div>
                </div>
              </div>
              <button
                onClick={() => onApplyPreset('youtube_retention')}
                disabled={isApplyingPreset}
                className="w-full py-1.5 rounded-md bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Zap className="w-3 h-3" /> Apply Preset
              </button>
            </div>

            {/* Instagram Reels High-Pacing */}
            <div className="p-3 rounded-lg bg-nle-bg border border-nle-border hover:border-amber-500/40 transition-all space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Reels High-Pacing</div>
                  <div className="text-[11px] text-slate-400">2.5s cut rhythm + Neon glow titles</div>
                </div>
              </div>
              <button
                onClick={() => onApplyPreset('reels_high_pacing')}
                disabled={isApplyingPreset}
                className="w-full py-1.5 rounded-md bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Zap className="w-3 h-3" /> Apply Preset
              </button>
            </div>

            {/* Podcast Clean-Up */}
            <div className="p-3 rounded-lg bg-nle-bg border border-nle-border hover:border-emerald-500/40 transition-all space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">Podcast Clean-Up</div>
                  <div className="text-[11px] text-slate-400">Strips hesitations, breath gaps & 'ums'</div>
                </div>
              </div>
              <button
                onClick={() => onApplyPreset('podcast_cleanup')}
                disabled={isApplyingPreset}
                className="w-full py-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Zap className="w-3 h-3" /> Apply Preset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Generate AI Asset */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-nle-surface border border-nle-border rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>AI B-Roll Generator (Imagen 3)</span>
              </div>
              <button
                onClick={() => setShowPromptModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Visual Prompt</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Cinematic close-up of high-speed editing timeline with neon glowing cyber particles, 8k..."
                  rows={3}
                  className="w-full bg-nle-bg border border-nle-border rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('9:16')}
                    className={`py-1.5 text-xs font-medium rounded border ${
                      aspectRatio === '9:16'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-nle-border text-slate-400'
                    }`}
                  >
                    9:16 (Vertical Reels)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`py-1.5 text-xs font-medium rounded border ${
                      aspectRatio === '16:9'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-nle-border text-slate-400'
                    }`}
                  >
                    16:9 (Landscape)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingAsset || !customPrompt.trim()}
                  className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGeneratingAsset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate Overlay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
