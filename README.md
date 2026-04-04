# Oil Price

Repository for multiple oil-chart apps that share the same visual language and deploy together to GitHub Pages.

Structure:

- `historical-real-oil-price/`: historical real oil price chart
- `rally-oil-price/`: one-line-per-year Brent chart

The repository root stays reserved for shared repo-level files such as the GitHub Pages workflow, the root index page, git config and future graph folders.

## Commands

Run these from the graph folder you want:

- `cd historical-real-oil-price` or `cd rally-oil-price`
- `npm install`
- `npm run build:data`
- `npm run dev`
- `npm run build`

## Data logic

### Historical Real Oil Price

1. Use OWID real oil prices through 2024.
2. Use FRED WTI spot prices to extend 2025 and 2026.
3. Deflate recent nominal prices into constant 2024 dollars with CPI.
4. Link the recent segment to the OWID 2024 level.
5. Convert the final series into `$2014/bbl`.

### Rally Oil Price

1. Fetch daily `DCOILBRENTEU` history from FRED.
2. Split the series by calendar year.
3. Normalize each year to its first trading day.
4. Render one line per year with the current year highlighted.
