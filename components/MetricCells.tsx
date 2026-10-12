import type { GlobalMetrics } from "@/lib/project";

export const METRIC_HEADERS = ["DR", "Keywords", "Traffic", "GEO", "Topics", "TF", "CF", "TF/CF", "Price (G)"];

const n = (v: number | null | undefined) => (v == null ? "—" : String(v));

// Метрики донора берутся из глобальной базы, поэтому обновляются везде сразу.
export function MetricCells({ g }: { g: GlobalMetrics | null }) {
  const ratio = g && g.tf != null && g.cf ? (g.tf / g.cf).toFixed(2) : "—";
  return (
    <>
      <td className="font-mono">{n(g?.dr)}</td>
      <td className="font-mono">{n(g?.keywords)}</td>
      <td className="font-mono">{n(g?.traffic)}</td>
      <td>{g?.geo || "—"}</td>
      <td className="max-w-40 truncate" title={g?.topics || undefined}>{g?.topics || "—"}</td>
      <td className="font-mono">{n(g?.tf)}</td>
      <td className="font-mono">{n(g?.cf)}</td>
      <td className="font-mono">{ratio}</td>
      <td className="whitespace-nowrap">{g?.price || ""}</td>
    </>
  );
}
