export const SRS_DEFAULT = [1, 3, 7, 14, 30, 60];

export function nextReviewDate(level: number, intervals: number[]): string {
  const days = intervals[Math.min(level, intervals.length - 1)] ?? 60;
  return new Date(Date.now() + days * 86400000).toISOString();
}
