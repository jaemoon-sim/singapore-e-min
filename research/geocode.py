"""Resolve researched Singapore buildings with SLA OneMap. Cached, no browser requests."""
import json
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent
source = json.loads((ROOT / "2026-11-02-rentals.json").read_text())
cache_path = ROOT / "geocoding.json"
cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
addresses = [row["address"] for row in source["rows"]] + ["70 Pasir Panjang Road"]
for address in addresses:
    if address not in cache:
        url = "https://www.onemap.gov.sg/api/common/elastic/search?" + urllib.parse.urlencode({
            "searchVal": address, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": "1"
        })
        req = urllib.request.Request(url, headers={"User-Agent": "SingaporeHomeMap/1.0"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    cache[address] = {"source": url, "checkedDate": source["checkedDate"], **json.load(response)}
                break
            except urllib.error.HTTPError as error:
                if error.code != 429 or attempt == 3:
                    raise
                time.sleep(15 * (attempt + 1))
        cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n")
        time.sleep(2)
    entry = cache[address]
    print(address, json.dumps(entry.get("results", []), ensure_ascii=False), flush=True)
