"""Download official files and record hashes; no keys needed."""
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
import requests
ROOT = Path(__file__).resolve().parents[1]
FILES = {
 'ddinter_B.csv': 'https://ddinter2.scbdd.com/static/media/download/ddinter_downloads_code_B.csv',
 'drug_names.tsv': 'http://sideeffects.embl.de/media/download/drug_names.tsv',
 'meddra_all_se.tsv.gz': 'http://sideeffects.embl.de/media/download/meddra_all_se.tsv.gz'
}
def main():
    manifest = []
    for name, url in FILES.items():
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        if b'<html' in r.content[:500].lower() or not r.content:
            raise ValueError('Source returned HTML/empty response. Download the official export manually: '+url)
        path = ROOT / 'data/raw' / name
        path.write_bytes(r.content)
        manifest.append({'file': name, 'source': url, 'sha256': hashlib.sha256(r.content).hexdigest(), 'retrievedAt': datetime.now(timezone.utc).isoformat()})
        (ROOT / 'data/raw/manifest.json').write_text(json.dumps(manifest, indent=2))
        print(name, len(r.content), 'bytes')
if __name__ == '__main__':
    main()
