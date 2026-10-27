// Колонки метрик донора (из глобальной базы) для таблиц проекта
import type { SheetCol } from "@/components/Sheet";
import type { ProjectDonor } from "@/lib/project";

const n = (v: number | null | undefined) => (v == null ? "—" : String(v));

// editGeoTopic — в Prefero GEO и тему можно вписать прямо в ячейке (ключи geo / topics сохраняет setDonorGeoTopic)
export function metricCols(editGeoTopic = false): SheetCol<ProjectDonor>[] {
  const g = (d: ProjectDonor) => d.global_donors;
  return [
    { key: "m_dr", header: "DR", kind: "readonly", width: 50, mono: true, get: (d) => n(g(d)?.dr) },
    { key: "m_kw", header: "Keywords", kind: "readonly", width: 70, mono: true, get: (d) => n(g(d)?.keywords) },
    { key: "m_tr", header: "Traffic", kind: "readonly", width: 70, mono: true, get: (d) => n(g(d)?.traffic) },
    editGeoTopic
      ? { key: "geo", header: "GEO", kind: "text", width: 70, get: (d) => g(d)?.geo ?? "", placeholder: "UA" }
      : { key: "m_geo", header: "GEO", kind: "readonly", width: 60, get: (d) => g(d)?.geo || "—" },
    editGeoTopic
      ? { key: "topics", header: "Topics", kind: "text", width: 130, get: (d) => g(d)?.topics ?? "", placeholder: "casino…" }
      : { key: "m_top", header: "Topics", kind: "readonly", width: 110, get: (d) => g(d)?.topics || "—" },
    { key: "m_tf", header: "TF", kind: "readonly", width: 45, mono: true, get: (d) => n(g(d)?.tf) },
    { key: "m_cf", header: "CF", kind: "readonly", width: 45, mono: true, get: (d) => n(g(d)?.cf) },
    {
      key: "m_ratio",
      header: "TF/CF",
      kind: "readonly",
      width: 55,
      mono: true,
      get: (d) => {
        const x = g(d);
        return x && x.tf != null && x.cf ? (x.tf / x.cf).toFixed(2) : "—";
      },
    },
    { key: "m_price", header: "Price (G)", kind: "readonly", width: 100, get: (d) => g(d)?.price || "" },
  ];
}
