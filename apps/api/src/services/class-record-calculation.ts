export type PeriodWeights = {
  MILESTONE: number;
  INDIVIDUAL: number;
  ATTENDANCE: number;
};
export type RecordScore = {
  kind: string;
  maxPoints: number;
  score: number | null;
  state: string;
};
export function calculateClassPeriod(
  items: RecordScore[],
  statuses: Array<string | null>,
  weights: PeriodWeights | null,
  lateCredit: number,
) {
  const graded = items.filter((i) => i.state !== "UNGRADED");
  const eligible = graded.filter((i) => i.state !== "EXCUSED");
  const average = (rows: RecordScore[]) => {
    const max = rows.reduce((n, i) => n + i.maxPoints, 0);
    return max
      ? (rows.reduce(
          (n, i) => n + (i.state === "MISSING" ? 0 : (i.score ?? 0)),
          0,
        ) /
          max) *
          100
      : null;
  };
  const attendance = {
    present: statuses.filter((s) => s === "PRESENT").length,
    absent: statuses.filter((s) => s === "ABSENT").length,
    late: statuses.filter((s) => s === "LATE").length,
    excused: statuses.filter((s) => s === "EXCUSED").length,
    unmarked: statuses.filter((s) => s === null).length,
    percentage: null as number | null,
  };
  const count = attendance.present + attendance.absent + attendance.late;
  attendance.percentage = count
    ? ((attendance.present + (attendance.late * lateCredit) / 100) / count) *
      100
    : null;
  const categories = {
    MILESTONE: average(eligible.filter((i) => i.kind === "MILESTONE")),
    INDIVIDUAL: average(eligible.filter((i) => i.kind === "INDIVIDUAL")),
    ATTENDANCE: attendance.percentage,
  };
  let score: number | null = average(eligible);
  if (weights) {
    const active = Object.entries(weights).filter(
      ([, weight]) => weight > 0,
    ) as Array<[keyof PeriodWeights, number]>;
    score = active.some(([key]) => categories[key] === null)
      ? null
      : active.reduce(
          (n, [key, weight]) => n + (categories[key]! * weight) / 100,
          0,
        );
  }
  return {
    score:
      score === null ? null : Math.round((score + Number.EPSILON) * 100) / 100,
    complete:
      graded.length === items.length &&
      attendance.unmarked === 0 &&
      score !== null,
    graded: graded.length,
    activityCount: items.length,
    attendance,
    categories,
  };
}
