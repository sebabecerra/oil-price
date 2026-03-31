# Historical Real Oil Price

Single-purpose app that reconstructs and displays a long-run real crude oil price series through 2026.

## Commands

- `npm install`
- `npm run build:data`
- `npm run dev`
- `npm run build`

## Data logic

1. Use OWID real oil prices through 2024.
2. Use FRED WTI spot prices to extend 2025 and 2026.
3. Deflate recent nominal prices into constant 2024 dollars with CPI.
4. Link the recent segment to the OWID 2024 level.
5. Convert the final series into `$2014/bbl`.
