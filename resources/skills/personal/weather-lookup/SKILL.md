---
name: weather-lookup
description: Look up weather forecasts for a location and date range by running the bundled script.
---

When invoked:
1) Collect:
   - location (string)
   - start date (YYYY-MM-DD)
   - duration in days (int)
2) Run:
   `bash scripts/weather.sh "<location>" "<start>" "<duration>"`
3) Parse the JSON and summarize day-by-day highs/lows and precip chance.
4) If location is ambiguous or geocoding returns no results, ask a clarifying question.