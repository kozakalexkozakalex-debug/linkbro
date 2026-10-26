// Quality Score 0–100: взвешенное среднее нормированных метрик, не только DR.
//   DR → /100 · Traffic и Keywords → по логарифму (1 000 000 трафика ≈ 100%) · TF → /50 · TF/CF → до 1.
// Отсутствующая метрика не тянет оценку вниз — она уменьшает полноту (coverage, 0–100).
// Веса по умолчанию те же, что в представлении global_donors_usage (Confero); проект может задать свои.
export const SCORE_KEYS = ["dr", "traffic", "keywords", "tf", "ratio"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export type Weights = Record<ScoreKey, number>;
export const DEFAULT_WEIGHTS: Weights = { dr: 30, traffic: 30, keywords: 15, tf: 15, ratio: 10 };
export const SCORE_LABEL: Record<ScoreKey, string> = { dr: "DR", traffic: "Traffic", keywords: "Keywords", tf: "TF", ratio: "TF/CF" };

type M = { dr: number | null; traffic: number | null; keywords: number | null; tf: number | null; cf: number | null } | null | undefined;

export function normWeights(raw: unknown): Weights {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_WEIGHTS };
  for (const k of SCORE_KEYS) {
    const n = Number(src[k]);
    if (src[k] !== undefined && src[k] !== "" && Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function qualityScore(m: M, w: Weights = DEFAULT_WEIGHTS): { score: number | null; coverage: number } {
  if (!m) return { score: null, coverage: 0 };
  const parts: [ScoreKey, number | null][] = [
    ["dr", m.dr == null ? null : Math.min(Math.max(m.dr, 0), 100) / 100],
    ["traffic", m.traffic == null ? null : Math.min(Math.log10(Math.max(m.traffic, 1)) / 6, 1)],
    ["keywords", m.keywords == null ? null : Math.min(Math.log10(Math.max(m.keywords, 1)) / 5, 1)],
    ["tf", m.tf == null ? null : Math.min(Math.max(m.tf, 0), 50) / 50],
    ["ratio", m.tf != null && m.cf ? Math.min(m.tf / m.cf, 1) : null],
  ];
  const total = SCORE_KEYS.reduce((a, k) => a + w[k], 0) || 1;
  let v = 0;
  let have = 0;
  for (const [k, n] of parts) {
    if (n == null) continue;
    v += w[k] * n;
    have += w[k];
  }
  return { score: have > 0 ? Math.round((100 * v) / have) : null, coverage: Math.round((100 * have) / total) };
}

// Цвет оценки: ≥ 60 зелёный, 35–59 жёлтый, ниже — серый; «≈» при полноте < 60%
export function scoreTone(score: number | null): string {
  if (score == null) return "text-mute";
  return score >= 60 ? "text-ok" : score >= 35 ? "text-warn" : "text-mute";
}

export const STALE_DAYS = 90;
export function isStale(iso: string | null | undefined): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() > STALE_DAYS * 86_400_000;
}
