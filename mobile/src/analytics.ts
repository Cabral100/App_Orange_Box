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
  photos: number;
  previousCount: number;
  delta: number;
  color: string;
  chartColor: string;
};

const CHART_COLORS = ["#0D6B40", "#E94E0B", "#24A35A", "#F2B816", "#084E30", "#F58A55", "#7CBF91", "#C8A33A"];

export function buildDashboard(records: InspectionRecord[], plots: Plot[], from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - Math.max(0, duration));
  const currentRecords = recordsInPeriod(records, from, to);
  const previousRecords = recordsInPeriod(records, previousFrom, previousTo);
  const rows: DashboardRow[] = plots.map((plot, index) => {
    const plotRecords = currentRecords.filter((record) => record.mapVisible && recordPlot(record, plots)?.id === plot.id);
    const count = plotRecords.reduce((sum, record) => sum + confirmedCount(record), 0);
    const previousCount = previousRecords
      .filter((record) => record.mapVisible && recordPlot(record, plots)?.id === plot.id)
      .reduce((sum, record) => sum + confirmedCount(record), 0);
    return {
      plot,
      count,
      photos: plotRecords.length,
      previousCount,
      delta: count - previousCount,
      color: severity(count).color,
      chartColor: CHART_COLORS[index % CHART_COLORS.length] || "#0D6B40",
    };
  });
  const unassigned = currentRecords
    .filter((record) => !recordPlot(record, plots))
    .reduce((sum, record) => sum + confirmedCount(record), 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0) + unassigned;
  const previousTotal = rows.reduce((sum, row) => sum + row.previousCount, 0);
  const increased = [...rows].filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta)[0] || null;
  const decreased = [...rows].filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta)[0] || null;
  return { rows, total, previousTotal, delta: total - previousTotal, unassigned, photos: currentRecords.length, increased, decreased, currentRecords };
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

function pieSegments(rows: DashboardRow[]) {
  const positive = rows.filter((row) => row.count > 0);
  const total = positive.reduce((sum, row) => sum + row.count, 0);
  if (!total) return '<circle cx="130" cy="130" r="90" fill="#24A35A"/><text x="130" y="136" text-anchor="middle" font-size="15" font-weight="700" fill="white">Sem registros</text>';
  let offset = 0;
  return positive.map((row) => {
    const fraction = row.count / total;
    const length = fraction * 565.486;
    const segment = `<circle cx="130" cy="130" r="90" fill="none" stroke="${row.chartColor}" stroke-width="54" stroke-dasharray="${length} ${565.486 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 130 130)"/>`;
    offset += length;
    return segment;
  }).join("");
}

export function dashboardPdfHtml(dashboard: ReturnType<typeof buildDashboard>, from: Date, to: Date, plots: Plot[], imageSources: Record<string, string> = {}) {
  const date = (value: Date) => value.toLocaleDateString("pt-BR");
  const generatedAt = new Date().toLocaleString("pt-BR");
  const legend = dashboard.rows.map((row) => `<div class="legend-row"><i style="background:${row.chartColor}"></i><span>${escapeHtml(row.plot.name)}</span><b>${row.count}</b></div>`).join("");
  const plotRows = dashboard.rows.map((row) => `<tr><td><b>${escapeHtml(row.plot.name)}</b><small>Origem: ${escapeHtml(row.plot.source)}</small></td><td><span class="status" style="background:${row.color}18;color:${row.color}">${escapeHtml(severity(row.count).label)}</span></td><td>${row.photos}</td><td>${row.count}</td><td>${row.previousCount}</td><td class="${row.delta > 0 ? "bad" : row.delta < 0 ? "good" : ""}">${row.delta > 0 ? "+" : ""}${row.delta}</td></tr>`).join("");
  const inspectionRows = [...dashboard.currentRecords].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()).map((record) => {
    const plot = recordPlot(record, plots);
    const count = confirmedCount(record);
    const coordinates = record.location ? `${record.location.latitude.toFixed(6)}, ${record.location.longitude.toFixed(6)}` : "Não disponível";
    const image = imageSources[record.id] || record.imageUri;
    const classes = [...new Set(record.detections.map((item) => item.class_name))].join(", ") || "Nenhuma";
    return `<tr><td>${image ? `<img class="thumb" src="${escapeHtml(image)}">` : "—"}</td><td>${escapeHtml(new Date(record.capturedAt).toLocaleString("pt-BR"))}<small>ID: ${escapeHtml(record.id)}</small></td><td>${escapeHtml(plot?.name || "Sem talhão")}</td><td>${count ? `<b class="bad">${count} confirmado(s)</b>` : '<b class="good">Sem sinal</b>'}<small>Classes: ${escapeHtml(classes)} · confiança máxima ${(record.topConfidence * 100).toFixed(1)}%</small></td><td>${escapeHtml(coordinates)}<small>${escapeHtml(record.location?.source?.toUpperCase() || "SEM FONTE")} · precisão ${record.location?.accuracy != null ? `${record.location.accuracy.toFixed(1)} m` : "n/d"} · altitude ${record.location?.altitude != null ? `${record.location.altitude.toFixed(1)} m` : "n/d"}</small></td><td>${record.source === "camera" ? "Câmera" : "Galeria"}<small>${record.width}×${record.height} · ${record.mapVisible ? "visível no mapa" : "fora do mapa"} · ${record.demo ? "exemplo" : "campo"} · ${escapeHtml(record.syncState)}</small></td></tr>`;
  }).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:24px}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18231c;background:#fff;margin:0;padding:20px;font-size:11px}header{display:flex;justify-content:space-between;border-bottom:2px solid #0d6b40;padding-bottom:15px}.brand{color:#e94e0b;font-size:30px;font-weight:900}.brand small{display:block;color:#0d6b40;font-size:9px;letter-spacing:2px}.meta{text-align:right;color:#6e746f;line-height:1.5}.report-title{font-size:22px;margin:24px 0 4px}.period{color:#6e746f;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kpi{border:1px solid #d9e5dc;border-radius:12px;padding:13px}.kpi.primary{background:#0d6b40;color:#fff}.kpi b{display:block;font-size:24px}.kpi span{font-size:9px}.content{display:grid;grid-template-columns:250px 1fr;gap:24px;margin:22px 0;align-items:center}.pie{width:235px;height:235px}.legend-row{display:grid;grid-template-columns:12px 1fr 32px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #e5eee7}.legend-row i{width:10px;height:10px;border-radius:3px}.legend-row b{text-align:right}.section{margin-top:22px}.section h2{font-size:15px;margin:0 0 9px}.section p{color:#6e746f;margin:0 0 10px}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#eaf5ee;color:#0d6b40;text-align:left;padding:8px 5px;border-bottom:1px solid #c6dccd}td{padding:7px 5px;border-bottom:1px solid #e8eee9;vertical-align:top}td small{display:block;color:#6e746f;margin-top:3px}.thumb{width:46px;height:46px;object-fit:cover;border-radius:6px}.status{display:inline-block;padding:4px 7px;border-radius:10px;font-weight:700}.good{color:#0d6b40}.bad{color:#d9342b}.note{margin-top:22px;padding:12px;border-left:4px solid #e94e0b;border-radius:10px;background:#f4f8f5;font-size:9px;line-height:1.5;color:#466052}.page-break{break-before:page;page-break-before:always}
  </style></head><body><header><div class="brand">CYF<small>CLEAN YOUR FARM</small></div><div class="meta"><b>Relatório gerencial de inspeções</b><br>Gerado em ${escapeHtml(generatedAt)}<br>Período: ${date(from)} a ${date(to)}</div></header><h1 class="report-title">Resumo executivo</h1><div class="period">Consolidado operacional da propriedade</div><section class="grid"><div class="kpi primary"><b>${dashboard.total}</b><span>detecções confirmadas</span></div><div class="kpi"><b>${dashboard.photos}</b><span>inspeções realizadas</span></div><div class="kpi"><b>${dashboard.delta >= 0 ? "+" : ""}${dashboard.delta}</b><span>variação vs. período anterior</span></div><div class="kpi"><b>${dashboard.unassigned}</b><span>detecções sem talhão</span></div></section><section class="content"><svg class="pie" viewBox="0 0 260 260">${pieSegments(dashboard.rows)}<circle cx="130" cy="130" r="57" fill="white"/><text x="130" y="126" text-anchor="middle" font-size="30" font-weight="800" fill="#18231c">${dashboard.total}</text><text x="130" y="146" text-anchor="middle" font-size="10" fill="#6e746f">DETECÇÕES</text></svg><div><h2>Distribuição por talhão</h2>${legend || "<p>Nenhum talhão cadastrado.</p>"}</div></section><section class="section"><h2>Desempenho por talhão</h2><p>Comparação com período anterior de igual duração.</p><table><thead><tr><th>Talhão</th><th>Situação</th><th>Inspeções</th><th>Detecções</th><th>Anterior</th><th>Variação</th></tr></thead><tbody>${plotRows || '<tr><td colspan="6">Nenhum talhão cadastrado.</td></tr>'}</tbody></table></section><section class="section page-break"><h2>Detalhamento completo das inspeções</h2><p>Registros incluídos no período selecionado, com foto, origem, confiança e localização.</p><table><thead><tr><th>Foto</th><th>Data e hora</th><th>Talhão</th><th>Resultado</th><th>Coordenadas</th><th>Origem</th></tr></thead><tbody>${inspectionRows || '<tr><td colspan="6">Nenhuma inspeção no período.</td></tr>'}</tbody></table></section><div class="note"><b>Critério:</b> são contabilizadas detecções com confiança ≥95%. A confiança é a estimativa do modelo para cada ocorrência, não a porcentagem da área infestada. Verde significa nenhum registro confirmado; amarelo, de 1 a 20; vermelho, acima de 20. Zero registro não comprova ausência de praga. Este documento apoia a triagem de campo e não substitui avaliação agronômica.</div></body></html>`;
}
