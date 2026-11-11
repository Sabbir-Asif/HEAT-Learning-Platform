export interface ResumeCandidate {
  videoId: string;
  resumePositionSeconds: number;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface ResumePoint {
  videoId: string | null;
  resumePositionSeconds: number;
}

export const resumePointOf = (candidates: readonly ResumeCandidate[]): ResumePoint => {
  const latest = candidates
    .filter((row) => row.completedAt === null && row.resumePositionSeconds > 0)
    .reduce<ResumeCandidate | null>(
      (current, row) => (current === null || row.updatedAt > current.updatedAt ? row : current),
      null,
    );
  return latest === null
    ? { videoId: null, resumePositionSeconds: 0 }
    : { videoId: latest.videoId, resumePositionSeconds: latest.resumePositionSeconds };
};
