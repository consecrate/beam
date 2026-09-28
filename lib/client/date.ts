/** The learner's local calendar date as YYYY-MM-DD (used for daily stats). */
export function today(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return today(d);
}
