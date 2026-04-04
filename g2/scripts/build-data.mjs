import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public/data");
const outFile = resolve(outDir, "oil-ytd-multiline.json");
const FRED_BRENT_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU";

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(",");
  return lines.map((line) => {
    const parts = line.split(",");
    const row = {};
    columns.forEach((column, index) => {
      row[column] = parts[index] ?? "";
    });
    return row;
  });
}

async function fetchFredSeries() {
  const response = await fetch(FRED_BRENT_URL, {
    headers: {
      "User-Agent": "historical-real-oil-price-g2/1.0",
      Accept: "text/csv,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`FRED request failed: HTTP ${response.status}`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);

  return rows
    .map((row) => ({
      date: row.observation_date ?? row.DATE,
      price: Number(row.DCOILBRENTEU),
    }))
    .filter((row) => {
      if (!row.date || !Number.isFinite(row.price) || row.price <= 0) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildSeries(rows, minYear = Number.NEGATIVE_INFINITY) {
  const buckets = new Map();

  for (const row of rows) {
    const year = Number(row.date.slice(0, 4));
    if (year < minYear) continue;
    if (!buckets.has(year)) buckets.set(year, []);
    buckets.get(year).push(row);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, points]) => {
      const base = points[0].price;
      return {
        year,
        firstDate: points[0].date,
        lastDate: points.at(-1).date,
        basePrice: round2(base),
        lastPrice: round2(points.at(-1).price),
        points: points.map((point, index) => ({
          day: index + 1,
          date: point.date,
          price: round2(point.price),
          changePct: round4(((point.price / base) - 1) * 100),
        })),
      };
    });
}

const rows = await fetchFredSeries();
const series = buildSeries(rows);
const currentSeries = series.at(-1);

if (!currentSeries) {
  throw new Error("No oil series generated.");
}

const payload = {
  generatedAt: new Date().toISOString(),
  title: "Brent Crude Oil: one line per year",
  subtitle: "Each line is a calendar year rebased to 100 on its first trading day.",
  source: "FRED (DCOILBRENTEU)",
  range: {
    startYear: series[0].year,
    endYear: series.at(-1).year,
    maxTradingDay: Math.max(...series.map((entry) => entry.points.length)),
  },
  summary: {
    currentYear: currentSeries.year,
    currentDay: currentSeries.points.at(-1).day,
    currentDate: currentSeries.points.at(-1).date,
    currentChangePct: currentSeries.points.at(-1).changePct,
  },
  series,
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outFile}`);
