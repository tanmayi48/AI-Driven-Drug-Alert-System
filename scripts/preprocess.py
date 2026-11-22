"""Normalize the DDInter official CSV and SIDER 4.1, enrich PubChem structures."""
import argparse
import hashlib
import json
import time
from pathlib import Path
from urllib.parse import quote
import pandas as pd
import requests
ROOT = Path(__file__).resolve().parents[1]
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ddinter', default=str(ROOT / 'data/raw/ddinter_B.csv'))
    parser.add_argument('--max-pairs', type=int, default=3000)
    parser.add_argument('--max-drugs', type=int, default=160)
    args = parser.parse_args()
    frame = pd.read_csv(args.ddinter)
    required = ['DDInterID_A', 'Drug_A', 'DDInterID_B', 'Drug_B', 'Level']
    if not set(required).issubset(frame.columns):
        raise ValueError('Expected DDInter columns: '+str(required)+'; got '+str(list(frame.columns)))
    frame = frame.dropna(subset=required)
    frame['pairKey'] = frame.apply(lambda r: '|'.join(sorted([r.DDInterID_A, r.DDInterID_B])), axis=1)
    conflicts = frame.groupby('pairKey').Level.nunique()
    frame = frame[~frame.pairKey.isin(conflicts[conflicts > 1].index)].drop_duplicates('pairKey')
    levels = {'minor': 'Low', 'moderate': 'Moderate', 'major': 'High', 'low': 'Low', 'high': 'High'}
    frame['severity'] = frame.Level.astype(str).str.lower().map(levels)
    frame = frame.dropna(subset=['severity'])
    # Prefer a bounded connected subset with SIDER name mappings. This keeps
    # the academic pipeline reproducible and avoids thousands of API calls.
    sider_names = pd.read_csv(ROOT / 'data/raw/drug_names.tsv', sep='\t', header=None, dtype=str)
    cid_by_name = {r[1].lower(): int(r[0].replace('CID', ''))-100000000 for r in sider_names.itertuples(index=False, name=None)}
    all_names = dict(zip(frame.DDInterID_A, frame.Drug_A))
    all_names.update(dict(zip(frame.DDInterID_B, frame.Drug_B)))
    degree = pd.concat([frame.DDInterID_A, frame.DDInterID_B]).value_counts()
    selected = [d for d in degree.index if all_names[d].lower() in cid_by_name][:args.max_drugs]
    frame = frame[frame.DDInterID_A.isin(selected) & frame.DDInterID_B.isin(selected)].sample(frac=1, random_state=42).head(args.max_pairs)
    drugs = {}
    cache_path = ROOT / 'data/raw/pubchem_cache.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    pending = {all_names[d]: cid_by_name[all_names[d].lower()] for d in selected if all_names[d] not in cache}
    names = list(pending)
    for start in range(0, len(names), 40):
        batch = names[start:start+40]
        url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/'+','.join(str(pending[n]) for n in batch)+'/property/CanonicalSMILES/JSON'
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        properties = {p['CID']: p for p in r.json()['PropertyTable']['Properties']}
        for n in batch:
            if pending[n] in properties:
                cache[n] = properties[pending[n]]
        cache_path.write_text(json.dumps(cache))
        print('PubChem structures cached:', len(cache), flush=True)
        time.sleep(0.3)
    for row in frame.itertuples():
        for identifier, name in [(row.DDInterID_A, row.Drug_A), (row.DDInterID_B, row.Drug_B)]:
            if identifier in drugs:
                continue
            if name not in cache:
                url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/'+quote(name, safe='')+'/property/CanonicalSMILES/JSON'
                try:
                    r = requests.get(url, timeout=20)
                    r.raise_for_status()
                    cache[name] = r.json()['PropertyTable']['Properties'][0]
                except (requests.RequestException, KeyError):
                    cache[name] = {}
                time.sleep(0.25)
                cache_path.write_text(json.dumps(cache))
            p = cache[name]
            drugs[identifier] = {'canonicalId': identifier, 'name': name, 'brands': [], 'cid': p.get('CID'), 'smiles': p.get('ConnectivitySMILES', p.get('CanonicalSMILES', p.get('SMILES', ''))), 'composition': name, 'drugClass': '', 'dosage': 'Not available in this source.', 'contraindications': [], 'sideEffects': [], 'source': 'DDInter 2.0 + PubChem; see dataset manifest', 'demo': False}
    interactions = []
    for row in frame.to_dict('records'):
        interactions.append({'pairKey': row['pairKey'], 'drugA': row['DDInterID_A'], 'drugB': row['DDInterID_B'], 'severity': row['severity'], 'mechanism': str(row.get('Mechanism', row.get('Description', 'Mechanism not provided in bulk export.'))), 'management': str(row.get('Management', 'Management not provided in bulk export; obtain qualified review.')), 'source': 'DDInter 2.0 official export', 'demo': False})
    adrs = []
    sider_path = ROOT / 'data/raw/meddra_all_se.tsv.gz'
    if sider_path.exists():
        s = pd.read_csv(sider_path, sep='\t', header=None, compression='gzip', dtype=str)
        by_cid = {d['cid']: d['canonicalId'] for d in drugs.values() if d['cid']}
        for row in s.itertuples(index=False, name=None):
            try:
                cid = int(row[0].replace('CID', '')) - 100000000
            except ValueError:
                continue
            if cid in by_cid and row[3] == 'PT':
                adrs.append({'drugId': by_cid[cid], 'effect': row[5], 'source': 'SIDER 4.1, CC BY-SA 4.0', 'signalType': 'label-derived association'})
        adrs = list({(a['drugId'], a['effect']): a for a in adrs}.values())
    if not adrs:
        raise ValueError('No SIDER ADR records mapped. Supply the official SIDER file; do not substitute fabricated signals.')
    metadata = {'ddinterVersion': '2.0', 'siderVersion': '4.1', 'drugCount': len(drugs), 'interactionCount': len(interactions), 'adrCount': len(adrs), 'rawSha256': hashlib.sha256(Path(args.ddinter).read_bytes()).hexdigest(), 'sampling': f'Connected subset of up to {args.max_drugs} highest-degree SIDER-matched drugs and {args.max_pairs} shuffled pairs (seed 42); not representative of all DDIs', 'licenses': {'DDInter': 'CC BY-NC-SA 4.0', 'SIDER': 'CC BY-SA 4.0'}, 'droppedUnknownSeverity': True, 'conflictingPairCount': int(sum(conflicts > 1))}
    output = {'drugs': list(drugs.values()), 'interactions': interactions, 'adrSignals': adrs, 'metadata': metadata}
    (ROOT / 'data/processed/import.json').write_text(json.dumps(output, indent=2))
    corpus = [{'text': f"{drugs[i['drugA']]['name']} + {drugs[i['drugB']]['name']}: {i['severity']}. {i['mechanism']} {i['management']}", 'source': i['source']} for i in interactions]
    corpus += [{'text': f"{drugs[a['drugId']]['name']}: label-derived adverse effect association: {a['effect']}. Does not prove individual causality.", 'source': a['source']} for a in adrs]
    (ROOT / 'data/processed/corpus.json').write_text(json.dumps(corpus))
    print(metadata)
if __name__ == '__main__':
    main()
