import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public/data");
const outFile = resolve(outDir, "wti-roc12.json");
const FRED_WTI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO";

const events = [
  { label: "1987 Crash", date: "1987-10-01" },
  { label: "1990 Crash", date: "1990-08-01" },
  { label: "DOT COM", date: "2000-03-01" },
  { label: "Financial Crisis", date: "2008-10-01" },
  { label: "2022 Bear Market\nInflation / War / Rates", date: "2022-06-01" },
  { label: "IT'S BACK!", date: "2026-03-01", variant: "highlight" },
];

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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "roc-12-oil-price/1.0",
      Accept: "text/csv,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

function monthKey(date) {
  return date.slice(0, 7);
}

function aggregateMonthly(rows) {
  const buckets = new Map();

  for (const row of rows) {
    const date = row.observation_date ?? row.DATE;
    const value = Number(row.DCOILWTICO);
    if (!date || !Number.isFinite(value) || value <= 0) continue;
    const key = monthKey(date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ date, value });
  }

  return [...buckets.entries()]
    .map(([key, entries]) => {
      const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
      const values = sorted.map((entry) => entry.value);
      return {
        month: key,
        date: `${key}-01`,
        open: Number(values[0].toFixed(2)),
        high: Number(Math.max(...values).toFixed(2)),
        low: Number(Math.min(...values).toFixed(2)),
        close: Number(values.at(-1).toFixed(2)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function addRoc(monthly) {
  return monthly.map((entry, index) => {
    if (index < 12) {
      return { ...entry, roc12: null };
    }
    const prev = monthly[index - 12].close;
    const roc12 = ((entry.close / prev) - 1) * 100;
    return { ...entry, roc12: Number(roc12.toFixed(2)) };
  });
}

const rows = parseCsv(await fetchText(FRED_WTI_URL));
const monthly = addRoc(aggregateMonthly(rows));
const latest = monthly.at(-1);

const payload = {
  generatedAt: new Date().toISOString(),
  title: "WTI Spot and ROC(12)",
  subtitle: "Monthly WTI spot candles with 12-month rate of change.",
  source: "FRED DCOILWTICO",
  latest,
  range: { start: monthly[0].date, end: latest.date },
  events,
  candles: monthly,
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outFile}`);
