import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  SkipBack,
  SkipForward,
  Ratio
} from 'lucide-react';
import { ProjectSummary, CaptionItem } from '../types';
import { formatTimecode } from '../utils/timecode';

interface VideoMonitorProps {
  project: ProjectSummary | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeCaptions: CaptionItem[];
  captionStyle: 'hormozi' | 'neon' | 'clean';
}

export const VideoMonitor: React.FC<VideoMonitorProps> = ({
  project,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onTogglePlay,
  activeCaptions,
  captionStyle
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [aspect, setAspect] = useState<'9:16' | '16:9'>('9:16');

  // Video source: prioritize proxy_url, fallback to raw media stream
  const videoSrc = project?.proxy_url || (project?.raw_video_path ? `/media/stream?path=${encodeURIComponent(project.raw_video_path)}` : null);

  // Sync external currentTime to video element
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.15) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync play/pause state
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Handle video element time update
  const handleNativeTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  // Find currently active subtitle block
  const currentSub = activeCaptions.find(
    (c) => currentTime >= c.start_sec && currentTime <= c.end_sec
  );

  const stepTime = (delta: number) => {
    const next = Math.max(0, Math.min(project?.duration_seconds || 60, currentTime + delta));
    onTimeUpdate(next);
  };

  const cycleRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  return (
    <div className="flex-1 bg-black flex flex-col justify-between items-center relative overflow-hidden select-none border-b border-nle-border">
      {/* Aspect Ratio & Timecode Overlay Tag */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="font-mono text-xs px-2.5 py-1 rounded bg-black/60 text-emerald-400 border border-emerald-500/20 backdrop-blur-xs flex items-center gap-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{formatTimecode(currentTime, project?.fps || 30)}</span>
          </div>

          <button
            onClick={() => setAspect(aspect === '9:16' ? '16:9' : '9:16')}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-black/60 hover:bg-black/80 text-slate-300 border border-nle-border backdrop-blur-xs transition-colors"
          >
            <Ratio className="w-3 h-3 text-slate-400" />
            <span>{aspect}</span>
          </button>
        </div>

        <div className="font-mono text-[11px] text-slate-400 bg-black/60 px-2 py-1 rounded border border-nle-border backdrop-blur-xs">
          TOTAL: {formatTimecode(project?.duration_seconds || 0, project?.fps || 30)}
        </div>
      </div>

      {/* Main Video Screen Area */}
      <div className="w-full flex-1 flex items-center justify-center p-3 relative">
        <div
          className={`relative overflow-hidden rounded-lg shadow-2xl bg-slate-950 flex items-center justify-center border border-slate-800 transition-all duration-200 ${
            aspect === '9:16' ? 'h-full max-h-[460px] aspect-[9/16]' : 'w-full max-w-[720px] aspect-[16/9]'
          }`}
        >
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-cover"
              onTimeUpdate={handleNativeTimeUpdate}
              onEnded={() => onTimeUpdate(0)}
              playsInline
              muted={isMuted}
            />
          ) : (
            <div className="text-center p-6 space-y-2 text-slate-500">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-blue-400">
                <Play className="w-5 h-5 ml-0.5" />
              </div>
              <div className="text-xs font-semibold text-slate-400">Preview Monitor Ready</div>
              <p className="text-[11px] text-slate-600">Generate a 480p proxy or click Play to scrub timeline.</p>
            </div>
          )}

          {/* Real-Time Dynamic Subtitle Overlay */}
          {currentSub && (
            <div className="absolute bottom-12 inset-x-4 flex justify-center text-center pointer-events-none z-10 transition-all">
              {captionStyle === 'hormozi' && (
                <span className="font-black text-xl tracking-wider uppercase px-3 py-1 drop-shadow-[0_4px_4px_rgba(0,0,0,1)] text-amber-300 bg-black/70 rounded-md border-2 border-black">
                  {currentSub.text}
                </span>
              )}
              {captionStyle === 'neon' && (
                <span className="font-extrabold text-lg tracking-wide px-3 py-1 rounded bg-slate-950/80 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                  {currentSub.text}
                </span>
              )}
              {captionStyle === 'clean' && (
                <span className="font-medium text-sm tracking-normal px-2.5 py-1 rounded bg-black/70 text-slate-100 border border-white/20">
                  {currentSub.text}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="w-full h-12 bg-nle-header/90 border-t border-nle-border px-4 flex items-center justify-between text-slate-300 z-20">
        <div className="flex items-center gap-2">
          {/* Step Back 1s */}
          <button
            onClick={() => stepTime(-1)}
            title="Step back 1 second"
            className="p-1.5 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-100 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Main Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-blue-500/20"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Step Forward 1s */}
          <button
            onClick={() => stepTime(1)}
            title="Step forward 1 second"
            className="p-1.5 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-100 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Return to Start */}
          <button
            onClick={() => onTimeUpdate(0)}
            title="Rewind to start"
            className="p-1.5 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed & Volume */}
        <div className="flex items-center gap-3">
          {/* Rate Button */}
          <button
            onClick={cycleRate}
            className="text-[11px] font-mono px-2 py-0.5 rounded bg-nle-surface hover:bg-nle-hover border border-nle-border text-slate-300"
          >
            {playbackRate}x
          </button>

          {/* Volume toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 rounded hover:bg-nle-hover text-slate-400 hover:text-slate-100"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                setIsMuted(val === 0);
                if (videoRef.current) videoRef.current.volume = val;
              }}
              className="w-16 h-1 accent-blue-500 bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
