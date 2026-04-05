import { useEffect, useMemo, useRef, useState } from "react";

const UI = {
  en: {
    heading: "WTI Spot and ROC(12)",
    subtitle: "Monthly WTI spot candles with a 12-month rate-of-change panel.",
    downloadCsv: "Download CSV",
    downloadPng: "Download PNG",
    noteLabel: "Note:",
    noteText: "Top panel shows monthly WTI candles built from daily FRED observations through March 2026, plus a provisional April 2026 snapshot to capture the current move. Bottom panel shows ROC(12), the year-over-year rate of change in the monthly close.",
    sourceLabel: "Source:",
    sourceText: "FRED DCOILWTICO; April 2026 extension from the current market snapshot used in the reference chart.",
  },
  es: {
    heading: "WTI Spot y ROC(12)",
    subtitle: "Velas mensuales del WTI spot con panel inferior de tasa de cambio a 12 meses.",
    downloadCsv: "Descargar CSV",
    downloadPng: "Descargar PNG",
    noteLabel: "Nota:",
    noteText: "El panel superior muestra velas mensuales del WTI construidas con observaciones diarias de FRED hasta marzo de 2026, más una extensión provisional para abril de 2026 para capturar el movimiento actual. El panel inferior muestra ROC(12), la tasa de cambio interanual del cierre mensual.",
    sourceLabel: "Fuente:",
    sourceText: "FRED DCOILWTICO; April 2026 extension from the current market snapshot used in the reference chart.",
  },
};

const WIDTH = 1380;
const HEIGHT = 760;
const PRICE_PANEL_TOP = 72;
const PRICE_PANEL_HEIGHT = 470;
const ROC_PANEL_TOP = 570;
const ROC_PANEL_HEIGHT = 140;
const LEFT = 56;
const RIGHT = 46;
const INNER_WIDTH = WIDTH - LEFT - RIGHT;
const DOMAIN_END = "2029-01-01";
const EVENT_LAYOUTS = {
  "1987 Crash": { labelDx: -28, anchor: "end", searchStart: "1986-01-01", searchEnd: "1988-12-01" },
  "1990 Crash": { labelDx: -8, anchor: "end", searchStart: "1989-06-01", searchEnd: "1991-06-01" },
  "DOT COM": { labelDx: 0, anchor: "middle", searchStart: "1999-01-01", searchEnd: "2001-03-01" },
  "Financial Crisis": { labelDx: 0, anchor: "middle", searchStart: "2007-06-01", searchEnd: "2009-06-01" },
  "2022 Bear Market\nInflation / War / Rates": { labelDx: -72, anchor: "end", searchStart: "2021-01-01", searchEnd: "2023-06-01" },
};

function monthDistance(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function yearTickDates(startDate, endDate) {
  const dates = [];
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  for (let year = startYear; year <= endYear; year += 1) {
    dates.push(`${year}-01-01`);
  }
  return dates;
}

function formatDate(date, lang) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang === "es" ? "es-CL" : "en-US", {
    year: "numeric",
    month: "short",
  });
}

function downloadCsv(rows) {
  const out = [
    ["date", "open", "high", "low", "close", "roc12"],
    ...rows.map((row) => [row.date, row.open, row.high, row.low, row.close, row.roc12 ?? ""]),
  ];
  const csv = out
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wti-roc12.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadSvgPng(svgNode) {
  if (!svgNode) return;
  const clone = svgNode.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "wti-roc12.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  image.src = url;
}

function yScale(value, min, max, top, height) {
  return top + (1 - (value - min) / (max - min || 1)) * height;
}

function linePath(points) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

export default function App() {
  const [data, setData] = useState(null);
  const [lang, setLang] = useState("es");
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/wti-roc12.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const ui = UI[lang];

  const chart = useMemo(() => {
    if (!data) return null;
    const candles = data.candles;
    const positiveLows = candles.map((d) => d.low).filter((value) => value > 0);
    const rawPriceMin = Math.min(...positiveLows);
    const rawPriceMax = Math.max(...candles.map((d) => d.high));
    const priceMin = Math.floor((rawPriceMin - 5) / 5) * 5;
    const priceMax = Math.ceil((rawPriceMax + 5) / 5) * 5;
    const rocVals = candles.map((d) => d.roc12).filter((v) => v != null);
    const rocMin = Math.min(-60, ...rocVals);
    const rocMax = Math.max(220, ...rocVals);
    const priceTicks = [];
    for (let tick = priceMin; tick <= priceMax; tick += 20) priceTicks.push(tick);
    const domainStart = candles[0].date;
    const domainEnd = DOMAIN_END;
    const totalMonths = monthDistance(domainStart, domainEnd);
    const xForDate = (date) => LEFT + (monthDistance(domainStart, date) / (totalMonths || 1)) * INNER_WIDTH;
    const yearTicks = yearTickDates(domainStart, domainEnd);
    return { candles, priceMin, priceMax, priceTicks, rocMin, rocMax, xForDate, yearTicks, domainStart, domainEnd };
  }, [data]);

  if (error) return <main className="page"><div className="status">Error: {error}</div></main>;
  if (!chart) return <main className="page"><div className="status">Loading…</div></main>;

  const tickYears = chart.yearTicks.map((date) => ({ date }));
  const rocPoints = chart.candles
    .filter((d) => d.roc12 != null)
    .map((d) => {
      return [chart.xForDate(d.date), yScale(d.roc12, chart.rocMin, chart.rocMax, ROC_PANEL_TOP, ROC_PANEL_HEIGHT)];
    });

  const eventAnchors = data.events.reduce((acc, event) => {
    if (event.variant === "highlight") return acc;
    const layout = EVENT_LAYOUTS[event.label] ?? {};
    const candidates = chart.candles.filter((row) => row.roc12 != null && (!layout.searchStart || row.date >= layout.searchStart) && (!layout.searchEnd || row.date <= layout.searchEnd));
    const target = candidates.length ? candidates.reduce((best, row) => (row.roc12 > best.roc12 ? row : best)) : chart.candles.find((row) => row.date === event.date);
    if (target) acc[event.label] = target.date;
    return acc;
  }, {});

  const late2022Candidates = chart.candles.filter((row) => row.roc12 != null && row.date >= "2021-08-01" && row.date <= "2022-06-01");
  const late2022Marker = late2022Candidates.length ? late2022Candidates.reduce((best, row) => (row.roc12 > best.roc12 ? row : best)) : null;

  const latestRoc = [...chart.candles].reverse().find((row) => row.roc12 != null);
  const latestRocY = latestRoc ? yScale(latestRoc.roc12, chart.rocMin, chart.rocMax, ROC_PANEL_TOP, ROC_PANEL_HEIGHT) : null;

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h1 className="dashboard-title dashboard-title-accent">{ui.heading}</h1>
            <p className="dashboard-subtitle">{ui.subtitle}</p>
          </div>
          <div className="lang-switch">
            <button type="button" className="lang-btn" onClick={() => downloadSvgPng(svgRef.current)}>{ui.downloadPng}</button>
            <button type="button" className="lang-btn" onClick={() => downloadCsv(chart.candles)}>{ui.downloadCsv}</button>
            <button type="button" className={`lang-btn ${lang === "es" ? "lang-btn-active" : ""}`} onClick={() => setLang("es")}>ES</button>
            <button type="button" className={`lang-btn ${lang === "en" ? "lang-btn-active" : ""}`} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>

        <div className="frame">
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart" role="img" aria-label={ui.heading}>
            <rect width={WIDTH} height={HEIGHT} fill="#050505" />

            <g>
              {tickYears.map((entry) => {
                const x = chart.xForDate(entry.date);
                return <line key={entry.date} x1={x} y1={PRICE_PANEL_TOP} x2={x} y2={ROC_PANEL_TOP + ROC_PANEL_HEIGHT} stroke="rgba(255,255,255,0.1)" />;
              })}
              {chart.priceTicks.map((tick) => {
                const y = yScale(tick, chart.priceMin, chart.priceMax, PRICE_PANEL_TOP, PRICE_PANEL_HEIGHT);
                return (
                  <g key={`p-${tick}`}>
                    <line x1={LEFT} y1={y} x2={WIDTH - RIGHT} y2={y} stroke="rgba(255,255,255,0.08)" />
                    <text x={WIDTH - 8} y={y + 4} textAnchor="end" className="axis-label">{tick}</text>
                  </g>
                );
              })}
              {[-50, 0, 50, 100, 150, 200].map((tick) => {
                const y = yScale(tick, chart.rocMin, chart.rocMax, ROC_PANEL_TOP, ROC_PANEL_HEIGHT);
                return (
                  <g key={`r-${tick}`}>
                    <line x1={LEFT} y1={y} x2={WIDTH - RIGHT} y2={y} stroke="rgba(255,255,255,0.08)" />
                    <text x={WIDTH - 8} y={y + 4} textAnchor="end" className="axis-label">{tick}</text>
                  </g>
                );
              })}
              {latestRocY != null ? <line x1={LEFT} y1={latestRocY} x2={WIDTH - RIGHT} y2={latestRocY} stroke="rgba(180,180,180,0.8)" strokeWidth="1" /> : null}
            </g>

            {chart.candles.map((candle, i) => {
              const x = chart.xForDate(candle.date);
              const openY = yScale(candle.open, chart.priceMin, chart.priceMax, PRICE_PANEL_TOP, PRICE_PANEL_HEIGHT);
              const closeY = yScale(candle.close, chart.priceMin, chart.priceMax, PRICE_PANEL_TOP, PRICE_PANEL_HEIGHT);
              const highY = yScale(candle.high, chart.priceMin, chart.priceMax, PRICE_PANEL_TOP, PRICE_PANEL_HEIGHT);
              const lowY = yScale(candle.low, chart.priceMin, chart.priceMax, PRICE_PANEL_TOP, PRICE_PANEL_HEIGHT);
              const up = candle.close >= candle.open;
              const color = up ? "#0ea34a" : "#c81e1e";
              return (
                <g key={candle.date} onMouseMove={() => setHover({ type: "candle", candle, x, y: Math.min(openY, closeY) })} onMouseLeave={() => setHover(null)}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.1" />
                  <rect x={x - 2.2} y={Math.min(openY, closeY)} width={4.4} height={Math.max(1.2, Math.abs(closeY - openY))} fill={color} />
                </g>
              );
            })}

            <path d={linePath(rocPoints)} fill="none" stroke="#ffd166" strokeWidth="2.2" />

            {chart.candles.filter((d) => d.roc12 != null).map((d) => {
              const x = chart.xForDate(d.date);
              const y = yScale(d.roc12, chart.rocMin, chart.rocMax, ROC_PANEL_TOP, ROC_PANEL_HEIGHT);
              return <rect key={`roc-${d.date}`} x={x - 3} y={ROC_PANEL_TOP} width={6} height={ROC_PANEL_HEIGHT} fill="transparent" onMouseMove={() => setHover({ type: "roc", candle: d, x, y })} onMouseLeave={() => setHover(null)} />;
            })}

            {data.events.map((event) => {
              const anchorDate = eventAnchors[event.label] ?? event.date;
              const idx = chart.candles.findIndex((row) => row.date === anchorDate);
              if (idx < 0) return null;
              const x = chart.xForDate(anchorDate);
              const y = yScale(chart.candles[idx].roc12 ?? 0, chart.rocMin, chart.rocMax, ROC_PANEL_TOP, ROC_PANEL_HEIGHT);
              const layout = EVENT_LAYOUTS[event.label] ?? { labelDx: 0, anchor: "middle" };
              if (event.variant === "highlight") {
                const boxX = WIDTH - RIGHT - 154;
                return (
                  <g key={event.label}>
                    <rect x={boxX} y={ROC_PANEL_TOP - 4} width={150} height={ROC_PANEL_HEIGHT - 10} fill="rgba(255,96,80,0.28)" stroke="rgba(255,96,80,0.55)" />
                    <text x={boxX + 18} y={ROC_PANEL_TOP + 28} className="event-highlight">{event.label}</text>
                    {late2022Marker ? (() => { const markerX = chart.xForDate(late2022Marker.date); return <path d={`M ${markerX - 6} ${ROC_PANEL_TOP + 18} L ${markerX + 6} ${ROC_PANEL_TOP + 18} L ${markerX} ${ROC_PANEL_TOP + 30} Z`} fill="#3a66ff" />; })() : null}
                    <path d={`M ${x - 6} ${ROC_PANEL_TOP + 40} L ${x + 6} ${ROC_PANEL_TOP + 40} L ${x} ${ROC_PANEL_TOP + 52} Z`} fill="#5b1f17" />
                  </g>
                );
              }
              const lines = event.label.split("\n");
              const labelX = x + layout.labelDx;
              return (
                <g key={event.label}>
                  <text x={labelX} y={ROC_PANEL_TOP + 18} textAnchor={layout.anchor} className="event-label">
                    {lines.map((line, lineIdx) => (
                      <tspan key={lineIdx} x={labelX} dy={lineIdx === 0 ? 0 : 16}>{line}</tspan>
                    ))}
                  </text>
                  <path d={`M ${labelX} ${ROC_PANEL_TOP + 24 + (lines.length - 1) * 16} L ${x} ${y - 12}`} stroke="#3a66ff" strokeWidth="1.4" />
                  <path d={`M ${x - 6} ${y - 12} L ${x + 6} ${y - 12} L ${x} ${y - 2} Z`} fill="#3a66ff" />
                </g>
              );
            })}

            {tickYears.map((entry) => {
              const x = chart.xForDate(entry.date);
              return <text key={`x-${entry.date}`} x={x} y={ROC_PANEL_TOP - 10} textAnchor="middle" className="x-axis-year">{entry.date.slice(2, 4)}</text>;
            })}

            {hover ? (
              <g transform={`translate(${Math.min(WIDTH - 220, hover.x + 12)}, ${Math.max(22, hover.y - 56)})`}>
                <rect width="196" height={hover.type === "candle" ? "72" : "56"} rx="8" fill="rgba(8,8,8,0.96)" stroke="rgba(255,209,102,0.26)" />
                <text x="12" y="20" className="tooltip-title">{formatDate(hover.candle.date, lang)}</text>
                {hover.type === "candle" ? (
                  <>
                    <text x="12" y="38" className="tooltip-body">O {hover.candle.open.toFixed(2)}  H {hover.candle.high.toFixed(2)}</text>
                    <text x="12" y="56" className="tooltip-body">L {hover.candle.low.toFixed(2)}  C {hover.candle.close.toFixed(2)}</text>
                  </>
                ) : (
                  <text x="12" y="40" className="tooltip-body">ROC(12): {hover.candle.roc12?.toFixed(2)}%</text>
                )}
              </g>
            ) : null}
          </svg>
          <p className="footer-note"><span>{ui.noteLabel}</span> {ui.noteText}</p>
          <p className="footer-source"><span>{ui.sourceLabel}</span> {ui.sourceText}</p>
        </div>
      </section>
    </main>
  );
}
