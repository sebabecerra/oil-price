import { useEffect, useMemo, useState } from 'react';

const WIDTH = 1580;
const HEIGHT = 760;
const MARGIN = { top: 110, right: 34, bottom: 120, left: 62 };
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const Y_MAX = 140;
const ACCENT = "#ffd166";
const Y_TICKS = [0, 20, 40, 60, 80, 100, 120, 140];
const X_TICKS = [1861, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2026];
const ANIMATION_MS = 16000;

function xScale(year, minYear, maxYear) {
  return MARGIN.left + ((year - minYear) / (maxYear - minYear)) * INNER_WIDTH;
}

function yScale(value) {
  return MARGIN.top + (1 - value / Y_MAX) * INNER_HEIGHT;
}

function interpolateValueAtYear(series, year) {
  if (!series.length) return 0;
  if (year <= series[0].year) return series[0].value_2014_bbl;
  if (year >= series[series.length - 1].year) return series[series.length - 1].value_2014_bbl;

  for (let index = 0; index < series.length - 1; index += 1) {
    const left = series[index];
    const right = series[index + 1];
    if (year >= left.year && year <= right.year) {
      const span = right.year - left.year || 1;
      const t = (year - left.year) / span;
      return left.value_2014_bbl + (right.value_2014_bbl - left.value_2014_bbl) * t;
    }
  }

  return series[series.length - 1].value_2014_bbl;
}

function buildPath(series, minYear, maxYear) {
  return series
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xScale(point.year, minYear, maxYear).toFixed(2)} ${yScale(point.value_2014_bbl).toFixed(2)}`)
    .join(' ');
}

function resolveAnnotationYear(item) {
  if (typeof item.anchorYear === 'number') return item.anchorYear;
  const match = item.title.match(/(\d{4})(?:-(\d{4}))?/);
  if (!match) return 1861;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  return (start + end) / 2;
}

function annotationTriggerYear(item) {
  return resolveAnnotationYear(item) - 0.8;
}

function resolveAnnotationBoxX(item, minYear, maxYear) {
  const anchorYear = resolveAnnotationYear(item);
  const centeredX = xScale(anchorYear, minYear, maxYear) - (item.w / 2) + (item.xOffset ?? 0);
  const minX = MARGIN.left + 4;
  const maxX = WIDTH - MARGIN.right - item.w - 4;
  return Math.max(minX, Math.min(maxX, centeredX));
}

function Annotation({ item, visible, minYear, maxYear, series }) {
  const isHighlight = item.variant === 'highlight';
  const titleColor = isHighlight ? '#ffd166' : '#f3f4f6';
  const bodyColor = isHighlight ? '#ffe5a3' : 'rgba(229, 231, 235, 0.88)';
  const anchorYear = resolveAnnotationYear(item);
  const bodyLines = item.body.split('\n');
  const pointX = xScale(anchorYear, minYear, maxYear);
  const pointY = yScale(interpolateValueAtYear(series, anchorYear));
  const boxX = resolveAnnotationBoxX(item, minYear, maxYear);
  const lineStartX = Math.max(boxX + 6, Math.min(boxX + item.w - 6, pointX));
  const connectorFromTop = item.connectorSide === 'top';
  const lineStartY = connectorFromTop ? item.y : item.y + 24 + bodyLines.length * 14;
  return (
    <>
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={pointX}
        y2={pointY}
        stroke="rgba(180, 180, 180, 0.65)"
        strokeWidth="1.25"
        strokeDasharray="4 4"
      />
      <foreignObject x={boxX} y={item.y} width={item.w} height={item.h}>
        <div xmlns="http://www.w3.org/1999/xhtml" className={`annotation-box align-left ${visible ? 'annotation-visible' : 'annotation-hidden'}`}>
          <div className="annotation-title" style={{ color: titleColor }}>{item.title}</div>
          <div className="annotation-body" style={{ color: bodyColor }}>
            {bodyLines.map((line, index) => (
              <div key={`${item.title}-${index}`}>{line}</div>
            ))}
          </div>
        </div>
      </foreignObject>
    </>
  );
}

function OverlayBox({ item }) {
  return (
    <foreignObject x={item.x} y={item.y} width={item.w} height={item.h}>
      <div xmlns="http://www.w3.org/1999/xhtml" className="overlay-box">
        {item.title}
      </div>
    </foreignObject>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetch('/data/oil-history.json')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!data) return undefined;

    let frame = 0;
    const start = performance.now();

    const tick = (now) => {
      const next = Math.min((now - start) / ANIMATION_MS, 1);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [data]);

  const chart = useMemo(() => {
    if (!data) return null;
    const minYear = data.range.startYear;
    const maxYear = data.range.endYear;
    return {
      minYear,
      maxYear,
      path: buildPath(data.series, minYear, maxYear),
      currentYear: minYear + progress * (maxYear - minYear),
    };
  }, [data, progress]);

  if (error) {
    return <main className="page"><div className="status">Could not load data: {error}</div></main>;
  }

  if (!data || !chart) {
    return <main className="page"><div className="status">Loading chart…</div></main>;
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-head">
          <div className="section-kicker">Historical Real Oil</div>
          <h1 className="dashboard-title">Crude Oil History</h1>
          <p className="dashboard-subtitle">Long-run reconstructed real oil price series extended to 2026 and rendered in the visual language of the commodity monitor.</p>
        </div>

        <div className="frame">
          <div className="chart-title">{data.title}</div>

          <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={data.title}>
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#050505" />

            <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + INNER_HEIGHT} stroke="rgba(255,255,255,0.32)" strokeWidth="1" />
            <line x1={MARGIN.left} y1={MARGIN.top + INNER_HEIGHT} x2={WIDTH - MARGIN.right} y2={MARGIN.top + INNER_HEIGHT} stroke="rgba(255,255,255,0.32)" strokeWidth="1" />

          {Y_TICKS.map((tick) => {
            const y = yScale(tick);
            return (
              <g key={tick}>
                  <line x1={MARGIN.left - 4} y1={y} x2={MARGIN.left} y2={y} stroke="rgba(255,255,255,0.32)" strokeWidth="1" />
                  <text x={MARGIN.left - 10} y={y + 4} className="axis axis-y" textAnchor="end">{tick}</text>
              </g>
            );
            })}

            {X_TICKS.map((tick) => {
            const x = xScale(tick, chart.minYear, chart.maxYear);
            return (
              <g key={tick}>
                  <text x={x} y={MARGIN.top + INNER_HEIGHT + 24} className="axis axis-x" textAnchor="middle">
                    {tick}
                  </text>
                </g>
              );
            })}

            <path
              d={chart.path}
              fill="none"
              stroke={ACCENT}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={1 - progress}
            />

          {data.annotations.map((item) => (
              <Annotation
                key={item.title}
                item={item}
                minYear={chart.minYear}
                maxYear={chart.maxYear}
                series={data.series}
                visible={chart.currentYear >= annotationTriggerYear(item)}
              />
            ))}

          {(data.overlayBoxes ?? []).map((item) => (
              <OverlayBox key={item.title} item={item} />
            ))}
          </svg>

          <div className="footer-note"><em>Note: {data.subtitle}</em></div>
          <div className="footer-source"><em>Source: {data.source}</em></div>
        </div>
      </section>
    </main>
  );
}
