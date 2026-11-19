import React, { useRef, useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scissors,
  Check,
  X,
  Layers,
  Volume2,
  Type,
  Video
} from 'lucide-react';
import { ProjectSummary, Track, Segment, CaptionItem } from '../types';
import { formatTimecode } from '../utils/timecode';

interface TimelineProps {
  project: ProjectSummary | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  waveformPeaks: number[];
  activeCaptions: CaptionItem[];
  cutZones: Array<{ start_sec: number; end_sec: number; is_cut: boolean }>;
  onToggleCutZone: (index: number) => void;
  onApplyPendingCuts: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  onTimeUpdate,
  waveformPeaks,
  activeCaptions,
  cutZones,
  onToggleCutZone,
  onApplyPendingCuts
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1.0); // 1.0 = fit, up to 4.0
  const [isScrubbing, setIsScrubbing] = useState(false);

  const duration = Math.max(1, project?.duration_seconds || 30);

  // Ruler tick marks (e.g. every 1s or 5s depending on zoom)
  const tickInterval = zoom > 2 ? 1 : zoom > 1.2 ? 2 : 5;
  const totalTicks = Math.ceil(duration / tickInterval);

  // Render waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (waveformPeaks.length === 0) return;

    const barWidth = width / waveformPeaks.length;
    const midY = height / 2;

    waveformPeaks.forEach((peak, i) => {
      const barHeight = Math.max(2, peak * (height * 0.85));
      const x = i * barWidth;
      const y = midY - barHeight / 2;

      // Color gradient: cyan to emerald
      const timeAtBar = (i / waveformPeaks.length) * duration;
      const isCut = cutZones.some(
        (cz) => cz.is_cut && timeAtBar >= cz.start_sec && timeAtBar <= cz.end_sec
      );

      ctx.fillStyle = isCut ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.8)';
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
    });
  }, [waveformPeaks, duration, cutZones, zoom]);

  // Scrubbing calculations
  const calculateTimeFromX = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    const totalWidth = rect.width * zoom;
    const pct = Math.max(0, Math.min(1, x / totalWidth));
    return pct * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    onTimeUpdate(calculateTimeFromX(e.clientX));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScrubbing) return;
    onTimeUpdate(calculateTimeFromX(e.clientX));
  };

  const handleMouseUp = () => {
    setIsScrubbing(false);
  };

  // Find tracks
  const vTrack = project?.tracks.find((t) => t.type === 'video');
  const overlayTrack = project?.tracks.find(
    (t) => t.type === 'video' && t.name.includes('Overlay')
  );

  const pendingCutsCount = cutZones.filter((c) => c.is_cut).length;

  return (
    <div
      className="h-64 bg-nle-surface flex flex-col select-none border-t border-nle-border"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Timeline Controls Header */}
      <div className="h-9 px-4 bg-nle-header border-b border-nle-border flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-emerald-400 bg-black/40 px-2 py-0.5 rounded border border-emerald-500/20">
            <span>{formatTimecode(currentTime, project?.fps || 30)}</span>
          </div>

          {/* Pending Cut Indicator */}
          {pendingCutsCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-rose-400 font-medium">
                {pendingCutsCount} cut zones queued
              </span>
              <button
                onClick={onApplyPendingCuts}
                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[10px] flex items-center gap-1 shadow-sm transition-all"
              >
                <Scissors className="w-2.5 h-2.5" /> Ripple Delete
              </button>
            </div>
          )}
        </div>

        {/* Zoom Slider & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(1, zoom - 0.4))}
            title="Zoom Out"
            className="p-1 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-200"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono w-9 text-center text-slate-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(4, zoom + 0.4))}
            title="Zoom In"
            className="p-1 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-200"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            title="Fit to Timeline"
            className="p-1 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-200 ml-1"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Multi-Track Scrollable Body */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className="flex-1 overflow-x-auto overflow-y-hidden relative bg-nle-bg cursor-pointer"
      >
        <div
          className="h-full relative flex flex-col justify-between"
          style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
        >
          {/* Timeline Ruler */}
          <div className="h-6 bg-nle-header/80 border-b border-nle-border/80 relative text-[10px] font-mono text-slate-500">
            {Array.from({ length: totalTicks + 1 }).map((_, i) => {
              const sec = i * tickInterval;
              const leftPct = (sec / duration) * 100;
              if (leftPct > 100) return null;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-slate-700/60 pl-1 pt-0.5"
                  style={{ left: `${leftPct}%` }}
                >
                  {sec}s
                </div>
              );
            })}
          </div>

          {/* TRACK V2: B-Roll Overlays */}
          <div className="h-10 bg-indigo-950/20 border-b border-nle-border/40 relative flex items-center px-2">
            <span className="absolute left-2 text-[10px] font-mono font-bold text-indigo-400 z-10 px-1 rounded bg-black/60">
              V2 B-ROLL
            </span>
            {overlayTrack?.segments.map((seg) => {
              const leftPct = (seg.target_start_sec / duration) * 100;
              const widthPct = (seg.target_duration_sec / duration) * 100;
              return (
                <div
                  key={seg.id}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className="absolute h-7 rounded bg-indigo-600/60 hover:bg-indigo-600 border border-indigo-400/50 flex items-center px-2 text-[10px] text-white truncate shadow-sm transition-all"
                  title={`B-Roll Overlay (${seg.target_duration_sec.toFixed(1)}s)`}
                >
                  ★ {seg.content_preview || 'AI Visual Overlay'}
                </div>
              );
            })}
          </div>

          {/* TRACK V1: Main Video (Keep vs Cut Zones) */}
          <div className="h-12 bg-slate-900/60 border-b border-nle-border/40 relative flex items-center px-2">
            <span className="absolute left-2 text-[10px] font-mono font-bold text-slate-400 z-10 px-1 rounded bg-black/60">
              V1 VIDEO
            </span>

            {/* Cut Zones Overlay: Green for Keep, Red for Cut */}
            {cutZones.map((cz, idx) => {
              const leftPct = (cz.start_sec / duration) * 100;
              const widthPct = ((cz.end_sec - cz.start_sec) / duration) * 100;
              return (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCutZone(idx);
                  }}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute h-9 rounded flex items-center justify-between px-2 text-[10px] font-semibold cursor-pointer transition-all border ${
                    cz.is_cut
                      ? 'bg-rose-950/80 hover:bg-rose-900/90 border-rose-500/80 text-rose-300'
                      : 'bg-emerald-950/70 hover:bg-emerald-900/80 border-emerald-500/60 text-emerald-300'
                  }`}
                  title={`Click to toggle Keep / Cut (${(cz.end_sec - cz.start_sec).toFixed(1)}s)`}
                >
                  <span className="truncate">
                    {cz.is_cut ? '✂ CUT (Silence)' : '✔ KEEP'}
                  </span>
                  <span className="text-[9px] font-mono opacity-80">
                    {(cz.end_sec - cz.start_sec).toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* TRACK A1: Audio Waveform Canvas */}
          <div className="h-14 bg-emerald-950/10 border-b border-nle-border/40 relative flex items-center">
            <span className="absolute left-2 text-[10px] font-mono font-bold text-emerald-400 z-10 px-1 rounded bg-black/60">
              A1 AUDIO
            </span>
            <canvas
              ref={canvasRef}
              width={1600}
              height={56}
              className="w-full h-full pointer-events-none opacity-85"
            />
          </div>

          {/* TRACK T1: Subtitle & Captions Blocks */}
          <div className="h-9 bg-fuchsia-950/20 relative flex items-center px-2">
            <span className="absolute left-2 text-[10px] font-mono font-bold text-fuchsia-400 z-10 px-1 rounded bg-black/60">
              T1 CAPTIONS
            </span>
            {activeCaptions.map((cap, idx) => {
              const leftPct = (cap.start_sec / duration) * 100;
              const widthPct = ((cap.end_sec - cap.start_sec) / duration) * 100;
              return (
                <div
                  key={idx}
                  style={{ left: `${leftPct}%`, width: `${Math.max(1.5, widthPct)}%` }}
                  className={`absolute h-6 rounded px-1.5 flex items-center text-[9px] font-mono font-bold truncate border shadow-xs transition-all ${
                    cap.highlight
                      ? 'bg-amber-400/90 text-slate-950 border-amber-300'
                      : 'bg-fuchsia-600/70 text-white border-fuchsia-400/50'
                  }`}
                  title={`Caption: "${cap.text}" (${cap.start_sec}s - ${cap.end_sec}s)`}
                >
                  {cap.text}
                </div>
              );
            })}
          </div>

          {/* Playhead Cursor (Microsecond Sync Line) */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30 transition-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            {/* Playhead Head Marker */}
            <div className="w-3.5 h-3.5 -ml-[7px] bg-red-500 rotate-45 transform origin-center shadow-lg shadow-red-500/50"></div>
            {/* Playhead Vertical Line */}
            <div className="w-[1.5px] h-full bg-red-500 shadow-sm shadow-red-500/80 -ml-[0.75px]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
