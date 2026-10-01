"""Download the public ANIL 2025 rental indicators; no listing scraping."""
import csv
import io
import json
import urllib.request
from pathlib import Path

BASE = 'https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/'
RESOURCES = {'APARTMENT': '20251211-145010/pred-app-mef-dhup.csv',
             'APARTMENT_SMALL': '20251211-144934/pred-app12-mef-dhup.csv',
             'APARTMENT_LARGE': '20251211-144951/pred-app3-mef-dhup.csv',
             'HOUSE': '20251211-145039/pred-mai-mef-dhup.csv'}
records = {}
for kind, resource in RESOURCES.items():
    with urllib.request.urlopen(BASE + resource, timeout=30) as response:
        content = response.read()
        try:
            raw = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            raw = content.decode('cp1252')
    count = 0
    for row in csv.DictReader(io.StringIO(raw), delimiter=';'):
        def number(key):
            try:
                return round(float(row[key].replace(',', '.')), 4)
            except (ValueError, KeyError):
                return None
        if number('loypredm2') is None or number('loypredm2') <= 0:
            continue
        entry = records.setdefault(row['INSEE_C'], {'name': row['LIBGEO'], 'indicators': {}})
        entry['indicators'][kind] = [number('loypredm2'), number('lwr.IPm2'), number('upr.IPm2'),
                                   row['TYPPRED'], number('nbobs_com'), number('R2_adj')]
        count += 1
    if count < 30000:
        raise RuntimeError('Incomplete dataset: ' + kind)
    print(kind, count)
destination = Path(__file__).resolve().parent.parent / 'src/market-data/data/rents-2025.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(records, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('Communes:', len(records))
