/**
 * timecode.ts
 * Timecode formatting and microsecond arithmetic.
 */

export const MICROSECONDS_PER_SECOND = 1_000_000;

export function formatTimecode(seconds: number, fps: number = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function formatMicroseconds(us: number, fps: number = 30): string {
  return formatTimecode(us / MICROSECONDS_PER_SECOND, fps);
}

export function formatDurationHuman(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0.0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0);
  return `${mins}m ${secs}s`;
}
