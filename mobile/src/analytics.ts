import type { InspectionRecord, Plot } from "./types";
import { findPlot } from "./geo";

export const CONFIRMED_THRESHOLD = 0.95;

export function confirmedCount(record: InspectionRecord) {
  return record.detections.filter((detection) => detection.confidence >= CONFIRMED_THRESHOLD).length;
}

export function severity(count: number) {
  if (count === 0) return { id: "clear", label: "Sem ocorrência", color: "#24A35A" };
  if (count <= 20) return { id: "attention", label: "1 a 20", color: "#F2B816" };
  return { id: "critical", label: "Mais de 20", color: "#D9342B" };
}

export function recordPlot(record: InspectionRecord, plots: Plot[]) {
  if (record.plotId) return plots.find((plot) => plot.id === record.plotId) || null;
  return findPlot(plots, record.location);
}

export function recordsInPeriod(records: InspectionRecord[], from: Date, to: Date) {
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const end = new Date(to); end.setHours(23, 59, 59, 999);
  return records.filter((record) => {
    const captured = new Date(record.capturedAt).getTime();
    return captured >= start.getTime() && captured <= end.getTime();
  });
}

export type DashboardRow = {
  plot: Plot;
  count: number;
  previousCount: number;
  delta: number;
  color: string;
};

export function buildDashboard(records: InspectionRecord[], plots: Plot[], from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - Math.max(0, duration));
  const currentRecords = recordsInPeriod(records, from, to);
  const previousRecords = recordsInPeriod(records, previousFrom, previousTo);
  const rows: DashboardRow[] = plots.map((plot) => {
    const count = currentRecords
      .filter((record) => record.mapVisible && recordPlot(record, plots)?.id === plot.id)
      .reduce((sum, record) => sum + confirmedCount(record), 0);
    const previousCount = previousRecords
      .filter((record) => record.mapVisible && recordPlot(record, plots)?.id === plot.id)
      .reduce((sum, record) => sum + confirmedCount(record), 0);
    return { plot, count, previousCount, delta: count - previousCount, color: severity(count).color };
  });
  const unassigned = currentRecords
    .filter((record) => !recordPlot(record, plots))
    .reduce((sum, record) => sum + confirmedCount(record), 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0) + unassigned;
  const previousTotal = rows.reduce((sum, row) => sum + row.previousCount, 0);
  const increased = [...rows].filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta)[0] || null;
  const decreased = [...rows].filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta)[0] || null;
  return { rows, total, previousTotal, delta: total - previousTotal, unassigned, photos: currentRecords.length, increased, decreased };
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

function pieSegments(rows: DashboardRow[]) {
  const positive = rows.filter((row) => row.count > 0);
  const total = positive.reduce((sum, row) => sum + row.count, 0);
  if (!total) return '<circle cx="130" cy="130" r="90" fill="#24A35A"/><text x="130" y="136" text-anchor="middle" font-size="16" font-weight="700" fill="white">Sem registros</text>';
  let offset = 0;
  return positive.map((row) => {
    const fraction = row.count / total;
    const length = fraction * 565.486;
    const segment = `<circle cx="130" cy="130" r="90" fill="none" stroke="${row.color}" stroke-width="54" stroke-dasharray="${length} ${565.486 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 130 130)"/>`;
    offset += length;
    return segment;
  }).join("");
}

export function dashboardPdfHtml(
  dashboard: ReturnType<typeof buildDashboard>,
  from: Date,
  to: Date,
) {
  const date = (value: Date) => value.toLocaleDateString("pt-BR");
  const legend = dashboard.rows.map((row) => `<div class="legend-row"><i style="background:${row.color}"></i><span>${escapeHtml(row.plot.name)}</span><b>${row.count}</b></div>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  @page{margin:24px}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18231c;background:#fff;margin:0;padding:30px}.brand{color:#0d6b40;font-size:32px;font-weight:900}.brand small{display:block;font-size:10px;letter-spacing:2px}.period{margin:8px 0 26px;color:#6e746f}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{border:1px solid #e4e3dd;border-radius:16px;padding:16px}.kpi.primary{background:#0d6b40;color:#fff}.kpi b{display:block;font-size:28px}.kpi span{font-size:11px}.content{display:grid;grid-template-columns:300px 1fr;gap:30px;margin-top:28px;align-items:center}.pie{width:260px;height:260px}.legend-row{display:grid;grid-template-columns:14px 1fr 35px;gap:9px;align-items:center;padding:10px 0;border-bottom:1px solid #eee}.legend-row i{width:12px;height:12px;border-radius:4px}.legend-row b{text-align:right}.change{margin-top:24px;padding:16px;border-radius:16px;background:#fff2ea;border-left:5px solid #e94e0b}.note{margin-top:28px;font-size:10px;line-height:1.5;color:#68706b}
  </style></head><body><div class="brand">CYF<small>CLEAN YOUR FARM</small></div><div class="period">Dashboard de ${date(from)} a ${date(to)}</div><section class="grid"><div class="kpi primary"><b>${dashboard.total}</b><span>pragas no período</span></div><div class="kpi"><b>${dashboard.photos}</b><span>fotos salvas</span></div><div class="kpi"><b>${dashboard.delta >= 0 ? "+" : ""}${dashboard.delta}</b><span>variação</span></div><div class="kpi"><b>${dashboard.unassigned}</b><span>sem talhão</span></div></section><section class="content"><svg class="pie" viewBox="0 0 260 260">${pieSegments(dashboard.rows)}<circle cx="130" cy="130" r="57" fill="white"/><text x="130" y="126" text-anchor="middle" font-size="30" font-weight="800" fill="#18231c">${dashboard.total}</text><text x="130" y="146" text-anchor="middle" font-size="11" fill="#6e746f">detecções</text></svg><div><h2>Distribuição por talhão</h2>${legend || "<p>Nenhum talhão cadastrado.</p>"}</div></section><div class="change"><b>Maior aumento:</b> ${escapeHtml(dashboard.increased?.plot.name || "nenhum")} ${dashboard.increased ? `(+${dashboard.increased.delta})` : ""}<br><b>Maior redução:</b> ${escapeHtml(dashboard.decreased?.plot.name || "nenhuma")} ${dashboard.decreased ? `(${dashboard.decreased.delta})` : ""}</div><p class="note">A contagem representa caixas detectadas com confiança ≥95% nas fotos salvas. Não mede área infestada e zero significa ausência de registro no período, não ausência comprovada de praga. Resultado de triagem experimental.</p></body></html>`;
}
