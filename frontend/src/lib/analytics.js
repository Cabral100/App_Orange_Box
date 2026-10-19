import { findPlot } from "./geo.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function defaultPeriod() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: localDateInput(from), to: localDateInput(to) };
}

export function periodBounds(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Escolha um período válido.");
  }
  return { start, end };
}

export function previousPeriod(from, to) {
  const { start, end } = periodBounds(from, to);
  const duration = end.getTime() - start.getTime() + 1;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration + 1);
  return { start: previousStart, end: previousEnd };
}

export function pestCount(record) {
  const detections = Array.isArray(record.detections) ? record.detections : [];
  const confirmed = detections.filter((detection) => Number(detection.confidence) >= 0.95);
  return confirmed.length;
}

export function recordPlot(record, plots) {
  if (record.manualPlotId === "unassigned") return null;
  if (record.manualPlotId) return plots.find((plot) => plot.id === record.manualPlotId) || null;
  return findPlot(plots, record.location)
    || plots.find((plot) => plot.id === record.plotId)
    || null;
}

export function inPeriod(record, start, end) {
  const captured = new Date(record.capturedAt).getTime();
  return captured >= start.getTime() && captured <= end.getTime();
}

function summarizePeriod(records, plots, start, end) {
  const counts = Object.fromEntries(plots.map((plot) => [plot.id, 0]));
  let unassigned = 0;
  let photos = 0;
  records.forEach((record) => {
    if (!inPeriod(record, start, end)) return;
    const count = pestCount(record);
    const plot = recordPlot(record, plots);
    photos += 1;
    if (plot) counts[plot.id] += count;
    else unassigned += count;
  });
  return { counts, unassigned, photos };
}

export function severityFor(count) {
  if (count === 0) return { id: "clear", label: "Sem ocorrência", color: "#2fa760" };
  if (count <= 20) return { id: "attention", label: "1 a 20 pragas", color: "#f0c43c" };
  return { id: "critical", label: "Mais de 20 pragas", color: "#d94a42" };
}

export function buildReport(records, plots, from, to) {
  const currentBounds = periodBounds(from, to);
  const previousBounds = previousPeriod(from, to);
  const current = summarizePeriod(records, plots, currentBounds.start, currentBounds.end);
  const previous = summarizePeriod(records, plots, previousBounds.start, previousBounds.end);
  const rows = plots.map((plot) => {
    const count = current.counts[plot.id] || 0;
    const previousCount = previous.counts[plot.id] || 0;
    const delta = count - previousCount;
    const percent = previousCount === 0 ? (count === 0 ? 0 : null) : (delta / previousCount) * 100;
    return {
      plot,
      count,
      previousCount,
      delta,
      percent,
      severity: severityFor(count),
    };
  });
  const total = rows.reduce((sum, row) => sum + row.count, 0) + current.unassigned;
  const previousTotal = rows.reduce((sum, row) => sum + row.previousCount, 0) + previous.unassigned;
  const delta = total - previousTotal;
  const percent = previousTotal === 0 ? (total === 0 ? 0 : null) : (delta / previousTotal) * 100;
  const increased = [...rows].filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta)[0] || null;
  const decreased = [...rows].filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta)[0] || null;
  return {
    from,
    to,
    currentBounds,
    previousBounds,
    rows,
    total,
    previousTotal,
    delta,
    percent,
    photos: current.photos,
    unassigned: current.unassigned,
    increased,
    decreased,
  };
}

export function formatChange(delta, percent) {
  if (delta === 0) return "Sem alteração";
  const direction = delta > 0 ? "+" : "−";
  const absolute = Math.abs(delta);
  if (percent == null) return `${direction}${absolute} · novo no período`;
  return `${direction}${absolute} · ${Math.abs(percent).toFixed(0)}%`;
}

function csvCell(value) {
  const raw = String(value ?? "");
  // Names imported from GeoJSON are user-controlled. Neutralize spreadsheet
  // formulas without converting legitimate numeric deltas such as -3 to text.
  const text = typeof value === "string" && /^[\s]*[=+\-@]/.test(value) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportToCsv(report) {
  const lines = [
    ["Relatório CYF", `${report.from} a ${report.to}`],
    ["Gerado em", new Date().toISOString()],
    ["Métrica", "Quantidade de caixas com confiança do modelo >=95% nas fotos salvas; não representa área infestada"],
    ["Comparação", "Período imediatamente anterior com a mesma duração"],
    ["Total de pragas", report.total],
    ["Período anterior", report.previousTotal],
    ["Variação absoluta", report.delta],
    ["Fotos analisadas e salvas", report.photos],
    ["Pragas sem talhão confirmado", report.unassigned],
    ["Maior aumento absoluto", report.increased?.plot.name || "Nenhum", report.increased?.delta || 0],
    ["Maior redução absoluta", report.decreased?.plot.name || "Nenhuma", report.decreased?.delta || 0],
    [],
    ["Talhão", "Pragas no período", "Período anterior", "Variação", "Variação percentual", "Nível"],
    ...report.rows.map((row) => [
      row.plot.name,
      row.count,
      row.previousCount,
      row.delta,
      row.percent == null ? "novo" : `${row.percent.toFixed(1)}%`,
      row.severity.label,
    ]),
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
}

function htmlCell(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayDate(value) {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

/** Standalone, dependency-free dashboard suitable for printing or saving as PDF. */
export function reportToDashboardHtml(report, embeddedFont = "") {
  const maxCount = Math.max(1, ...report.rows.flatMap((row) => [row.count, row.previousCount]));
  const generatedAt = new Date().toLocaleString("pt-BR");
  const plotRows = report.rows.length
    ? report.rows.map((row) => {
      const currentWidth = row.count === 0 ? 0 : Math.max(2, (row.count / maxCount) * 100);
      const previousWidth = row.previousCount === 0 ? 0 : Math.max(2, (row.previousCount / maxCount) * 100);
      return `<article class="plot-row">
        <div class="plot-heading"><strong>${htmlCell(row.plot.name)}</strong><span>${htmlCell(row.severity.label)}</span></div>
        <div class="bar-line"><span>Atual</span><div class="bar-track"><i style="width:${currentWidth}%;background:${htmlCell(row.severity.color)}"></i></div><b>${row.count}</b></div>
        <div class="bar-line previous"><span>Anterior</span><div class="bar-track"><i style="width:${previousWidth}%"></i></div><b>${row.previousCount}</b></div>
        <small>${htmlCell(formatChange(row.delta, row.percent))}</small>
      </article>`;
    }).join("")
    : '<p class="empty">Nenhum talhão delimitado para este relatório.</p>';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Dashboard CYF — ${htmlCell(report.from)} a ${htmlCell(report.to)}</title>
  <style>
    @font-face{font-family:Inter;src:url('${embeddedFont || "/fonts/Inter-latin.woff2"}') format('woff2');font-style:normal;font-weight:100 900;font-display:swap}:root{color:#183023;background:#fff;font-family:Inter,Arial,Helvetica,sans-serif}*{box-sizing:border-box}body{margin:0;padding:32px}.page{max-width:920px;margin:auto}.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:3px solid #176a40;padding-bottom:20px}.brand{font-size:30px;font-weight:900;letter-spacing:-1px;color:#176a40}.brand small{display:block;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#627168}.period{text-align:right}.period strong,.period span{display:block}.period span{margin-top:5px;font-size:12px;color:#6e7b72}.eyebrow{margin:28px 0 8px;color:#176a40;font-size:10px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase}h1,h2,p{margin-top:0}h1{margin-bottom:6px;font-size:25px}h2{font-size:18px}.intro{color:#627168;font-size:12px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.kpi{padding:17px;border:1px solid #dbe5dd;border-radius:14px;background:#f8faf7}.kpi.primary{color:white;border:0;background:#176a40}.kpi b,.kpi span{display:block}.kpi b{font-size:27px}.kpi span{margin-top:4px;font-size:11px;color:#68776d}.kpi.primary span{color:#dceee2}.highlights{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0 24px}.highlight{padding:14px 16px;border-left:4px solid #b9531e;background:#fff6ed}.highlight.reduction{border-color:#176a40;background:#edf7ef}.highlight span,.highlight strong,.highlight small{display:block}.highlight span{font-size:10px;color:#6d786f;text-transform:uppercase}.highlight strong{margin:5px 0 2px}.highlight small{font-size:11px;color:#5e6a62}.chart{border:1px solid #dbe5dd;border-radius:16px;overflow:hidden}.plot-row{padding:15px}.plot-row+ .plot-row{border-top:1px solid #e5ebe6}.plot-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}.plot-heading span{font-size:10px;color:#68766c}.bar-line{display:grid;grid-template-columns:54px 1fr 28px;gap:8px;align-items:center;margin-top:6px}.bar-line>span,.bar-line>b{font-size:10px}.bar-line>b{text-align:right}.bar-track{height:9px;overflow:hidden;border-radius:10px;background:#edf1ed}.bar-track i{display:block;height:100%;border-radius:inherit}.bar-line.previous .bar-track i{background:#aab4ad}.plot-row>small{display:block;margin:8px 0 0 62px;color:#627168}.legend{display:flex;flex-wrap:wrap;gap:16px;margin:12px 0 26px;font-size:10px;color:#5e6b62}.legend span{display:flex;align-items:center;gap:6px}.legend i{width:10px;height:10px;border-radius:3px}.notes{margin-top:25px;padding-top:16px;border-top:1px solid #dbe5dd;color:#647168;font-size:10px;line-height:1.55}.print-action{position:fixed;right:20px;bottom:20px;padding:12px 18px;color:#fff;border:0;border-radius:10px;background:#b9531e;font-weight:800;cursor:pointer}.empty{padding:24px;color:#66736a;text-align:center}.footer{margin-top:18px;color:#7d8880;font-size:9px;text-align:right}
    @media(max-width:620px){body{padding:18px}.top{display:block}.period{margin-top:12px;text-align:left}.kpis{grid-template-columns:1fr 1fr}.highlights{grid-template-columns:1fr}}
    @media print{@page{size:A4;margin:14mm}body{padding:0}.page{max-width:none}.print-action{display:none}.plot-row{break-inside:avoid}.kpi,.highlight{break-inside:avoid}}
  </style>
</head>
<body>
  <main class="page">
    <header class="top"><div><div class="brand">CYF<small>Clean Your Farm</small></div></div><div class="period"><strong>${displayDate(report.from)} a ${displayDate(report.to)}</strong><span>Gerado em ${htmlCell(generatedAt)}</span></div></header>
    <p class="eyebrow">Dashboard de campo</p><h1>Ocorrências registradas</h1><p class="intro">Comparação com o período imediatamente anterior de mesma duração.</p>
    <section class="kpis" aria-label="Indicadores principais">
      <article class="kpi primary"><b>${report.total}</b><span>pragas no período</span></article>
      <article class="kpi"><b>${report.previousTotal}</b><span>período anterior</span></article>
      <article class="kpi"><b>${report.photos}</b><span>fotos salvas</span></article>
      <article class="kpi"><b>${report.unassigned}</b><span>sem talhão</span></article>
    </section>
    <section class="highlights" aria-label="Destaques da comparação">
      <article class="highlight"><span>Maior aumento</span><strong>${htmlCell(report.increased?.plot.name || "Nenhum aumento")}</strong><small>${report.increased ? `+${report.increased.delta} pragas` : "Sem alta no período"}</small></article>
      <article class="highlight reduction"><span>Maior redução</span><strong>${htmlCell(report.decreased?.plot.name || "Nenhuma redução")}</strong><small>${report.decreased ? `${report.decreased.delta} pragas` : "Sem queda no período"}</small></article>
    </section>
    <p class="eyebrow">Por talhão</p><h2>Atual × período anterior</h2>
    <section class="chart" aria-label="Comparação de ocorrências por talhão">${plotRows}</section>
    <div class="legend" aria-label="Níveis de ocorrência"><span><i style="background:#2fa760"></i>0 · sem registro</span><span><i style="background:#f0c43c"></i>1 a 20 pragas</span><span><i style="background:#d94a42"></i>mais de 20 pragas</span></div>
    <p class="notes"><strong>Como ler:</strong> a contagem representa caixas detectadas com confiança do modelo ≥95% nas fotos salvas. Não mede área infestada e “0” significa ausência de registro no período, não ausência comprovada de praga. Resultados são de triagem experimental e requerem confirmação humana.</p>
    <p class="footer">CYF · Clean Your Farm</p>
  </main>
  <button class="print-action" type="button" onclick="window.print()">Imprimir ou salvar em PDF</button>
</body>
</html>`;
}

export function downloadBlob(filename, contents, type) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export const DAY_IN_MS = DAY_MS;
