"""Build the static snapshot without any network requests or dependencies."""
import json
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
source = json.loads((ROOT / "research/2026-11-02-rentals.json").read_text())
geocodes = json.loads((ROOT / "research/geocoding.json").read_text())

def resolve(address):
    matches = geocodes[address]["results"]
    assert len(matches) == 1, f"Review ambiguous address: {address}"
    match = matches[0]
    # Match the street and block number rather than accepting a nearby result.
    assert f'{match["BLK_NO"]} {match["ROAD_NAME"]}' == address.upper(), address
    return {
        "lat": float(match["LATITUDE"]), "lng": float(match["LONGITUDE"]),
        "postal": match["POSTAL"], "resolvedAddress": match["ADDRESS"],
        "coordinateSource": geocodes[address]["source"],
    }

rows = [{**row, "id": row["url"].rsplit("-", 1)[-1],
         "availabilityNote": "조사 당시 즉시 입주 표시 · 최종 확인 필요" if not row.get("available") else "",
         **resolve(row["address"])} for row in source["rows"]]
assert len(rows) == 18 and len({r["id"] for r in rows}) == 18
assert all(r["beds"] >= 2 and r["rent"] <= 6500 and r["walk"] < 10 for r in rows)
assert len({r["region"] for r in rows}) == 6
assert all(sum(r["region"] == region for r in rows) == 3 for region in {r["region"] for r in rows})
assert all(1.20 < r["lat"] < 1.45 and 103.60 < r["lng"] < 104.05 for r in rows)

data = {**source, "office": {"name": "Google Singapore", "address": source["destination"], **resolve("70 Pasir Panjang Road")}, "rows": rows}
target = ROOT / "docs/data/listings.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
index = ROOT / "docs/index.html"
html = index.read_text()
for asset in ["assets/app.js", "assets/style.css"]:
    fingerprint = hashlib.sha256((ROOT / "docs" / asset).read_bytes()).hexdigest()[:12]
    html = re.sub(re.escape(asset) + r"(?:\?v=[a-f0-9]+)?", f"{asset}?v={fingerprint}", html)
index.write_text(html)
print(f"Prepared {len(rows)} verified building pins + office; six regions, three listings each.")
