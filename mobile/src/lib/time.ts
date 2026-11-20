export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return "under a minute";
  return minutes === 1 ? "1 min" : `${minutes} min`;
}

export function dayKey(date: Date | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export function relativeDay(timestamp: number, now = Date.now()): string {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const key = dayKey(timestamp);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(timestamp).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
