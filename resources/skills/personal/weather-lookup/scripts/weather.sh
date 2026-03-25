#!/usr/bin/env bash
set -euo pipefail

LOCATION="$1"
START="$2"
DAYS="$3"

# Open-Meteo units: "fahrenheit" or "celsius" (default: fahrenheit)
TEMP_UNIT="${TEMP_UNIT:-fahrenheit}"

# Optional: bias geocoding to a specific country (2-letter code, e.g. US). Leave unset for global.
COUNTRY_CODE="${COUNTRY_CODE:-}"

GEO_JSON="$(curl -f -sS --retry 2 --retry-delay 1 -G 'https://geocoding-api.open-meteo.com/v1/search' \
  --data-urlencode "name=${LOCATION}" \
  --data-urlencode "count=1" \
  ${COUNTRY_CODE:+--data-urlencode "country=${COUNTRY_CODE}"} )"

if [ -z "$GEO_JSON" ]; then
  echo "Geocoding request returned an empty response for: $LOCATION" >&2
  echo "Tip: if running in Codex Cloud, enable agent internet access and allowlist geocoding-api.open-meteo.com" >&2
  exit 2
fi

# Parse geocoding JSON once (COUNT/LAT/LON/TZ). Fail loudly on parse errors.
read -r COUNT LAT LON TZ < <(
  printf '%s' "$GEO_JSON" | tr -d '\r' | python3 -c "import json,sys
try:
  d=json.load(sys.stdin)
except Exception as e:
  print('PARSE_ERROR', file=sys.stderr)
  print(str(e), file=sys.stderr)
  sys.exit(2)
results=d.get('results') or []
count=len(results)
if count==0:
  print('0 0 0 unknown')
  sys.exit(0)
r0=results[0]
lat=r0.get('latitude')
lon=r0.get('longitude')
tz=r0.get('timezone')
if lat is None or lon is None or tz is None:
  print('MISSING_FIELDS', file=sys.stderr)
  print(json.dumps(r0), file=sys.stderr)
  sys.exit(2)
print(f'{count} {lat} {lon} {tz}')"
)

# Normalize COUNT (strip any remaining whitespace)
COUNT="${COUNT//[[:space:]]/}"

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [[ "$COUNT" == "0" ]]; then
  echo "No geocoding results for: $LOCATION" >&2
  echo "Geocoding response: $GEO_JSON" >&2
  exit 2
fi

END="$(python3 - "$START" "$DAYS" <<'PY'
import sys, datetime as dt
start = dt.date.fromisoformat(sys.argv[1])
days = int(sys.argv[2])
end = start + dt.timedelta(days=days-1)
print(end.isoformat())
PY
)"

curl -f -sS -G 'https://api.open-meteo.com/v1/forecast' \
  --data-urlencode "latitude=${LAT}" \
  --data-urlencode "longitude=${LON}" \
  --data-urlencode "timezone=${TZ}" \
  --data-urlencode "start_date=${START}" \
  --data-urlencode "end_date=${END}" \
  --data-urlencode "temperature_unit=${TEMP_UNIT}" \
  --data-urlencode "daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max"