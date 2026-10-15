// Pure formatting helpers for sizes, times and subtitle files.

const MEGABYTE = 1_048_576;

/** 5_300_000 → '5 MB' */
export const formatMegabytes = bytes => `${Math.round(bytes / MEGABYTE)} MB`;

/** 75 → '1:15', 3725 → '1:02:05' */
export function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/** 75.5 → '00:01:15,500' (SubRip timestamp) */
export function formatSrtTimestamp(seconds) {
  const ms = Math.round(seconds * 1000);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const hms = [hours, minutes, secs].map(n => String(n).padStart(2, '0')).join(':');
  return `${hms},${String(ms % 1000).padStart(3, '0')}`;
}

/** [{ start, end, text }] → the contents of an .srt subtitle file */
export function toSrt(segments) {
  return (segments ?? [])
    .map((segment, index) => `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${segment.text}\n`)
    .join('\n');
}
