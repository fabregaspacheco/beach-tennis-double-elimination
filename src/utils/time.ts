/** Every "HH:MM" time of day on the quarter-hour, in order — the only values selectable for a match start time. */
export const QUARTER_HOUR_TIMES: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const totalMinutes = i * 15;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/** Snaps a "HH:MM" string to the nearest 15-minute mark. Empty string passes through unchanged. */
export function roundToQuarterHour(time: string): string {
  if (!time) return time;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const rounded = (Math.round((h * 60 + m) / 15) * 15) % (24 * 60);
  const rh = Math.floor(rounded / 60);
  const rm = rounded % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}
