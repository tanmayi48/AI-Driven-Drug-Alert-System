"""Real-data model comparison with unique unordered pairs and held-out test set."""
import json
from pathlib import Path
import sys
import warnings
import joblib
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix, classification_report, roc_auc_score
from sklearn.inspection import permutation_importance
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ai_service.features import pair_features
def main():
    data = json.loads((ROOT / 'data/processed/import.json').read_text())
    drugs = {d['canonicalId']: d for d in data['drugs']}
    labels = ['Low', 'Moderate', 'High']
    features, targets, keys, pair_drugs = [], [], [], []
    seen = set()
    for row in data['interactions']:
        if row.get('demo') or row['pairKey'] in seen:
            continue
        seen.add(row['pairKey'])
        try:
            features.append(pair_features(drugs[row['drugA']]['smiles'], drugs[row['drugB']]['smiles']))
        except ValueError:
            continue
        targets.append(labels.index(row['severity']))
        keys.append(row['pairKey'])
        pair_drugs.append((row['drugA'], row['drugB']))
    x, y = np.asarray(features), np.asarray(targets)
    if len(y) < 100 or any(sum(y == i) < 10 for i in range(3)):
        raise ValueError('Need at least 100 real structured pairs and 10 per class. Enlarge import.')
    train, test = train_test_split(np.arange(len(y)), test_size=0.2, random_state=42, stratify=y)
    train, val = train_test_split(train, test_size=0.25, random_state=42, stratify=y[train])
    assert not (set(np.array(keys)[train]) & set(np.array(keys)[test]))
    models = {'Logistic Regression': make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)), 'XGBoost': XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.08, n_jobs=2, random_state=42, eval_metric='mlogloss'), 'MLP': make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(64,), max_iter=200, early_stopping=True, random_state=42))}
    results, fitted = [], {}
    for name, model in models.items():
        if name == 'XGBoost':
            model.fit(x[train], y[train], sample_weight=compute_sample_weight('balanced', y[train]))
        elif name == 'MLP':
            # Reproducible class-balanced bootstrap only from training partition.
            rng = np.random.default_rng(42)
            size = max(sum(y[train] == c) for c in range(3))
            balanced = np.concatenate([rng.choice(train[y[train] == c], size=size, replace=True) for c in range(3)])
            model.fit(x[balanced], y[balanced])
        else:
            model.fit(x[train], y[train])
        predicted = model.predict(x[val])
        validation_f1 = float(precision_recall_fscore_support(y[val], predicted, average='macro', zero_division=0)[2])
        fitted[name] = model
        pred = model.predict(x[test]); probs = model.predict_proba(x[test])
        precision, recall, f1, _ = precision_recall_fscore_support(y[test], pred, average='macro', zero_division=0)
        results.append({'name': name, 'validationMacroF1': validation_f1, 'accuracy': float(accuracy_score(y[test], pred)), 'precision': float(precision), 'recall': float(recall), 'macroF1': float(f1), 'rocAuc': float(roc_auc_score(y[test], probs, multi_class='ovr', average='macro')), 'confusionMatrix': confusion_matrix(y[test], pred, labels=[0, 1, 2]).tolist(), 'perClass': classification_report(y[test], pred, target_names=labels, output_dict=True, zero_division=0)})
        print(name, 'validation F1', validation_f1, 'test F1', f1, flush=True)
    selected = max(results, key=lambda r: r['validationMacroF1'])['name']
    importance = permutation_importance(fitted[selected], x[val], y[val], n_repeats=2, scoring='f1_macro', random_state=42, n_jobs=2).importances_mean
    joblib.dump({'model': fitted[selected], 'classes': labels, 'name': selected, 'importance': importance}, ROOT / 'artifacts/model.joblib')
    # Drug-disjoint audit: excludes all held-out-drug pairs from training.
    unique_drugs = sorted({d for pair in pair_drugs for d in pair})
    held_out = set(np.random.default_rng(43).choice(unique_drugs, max(1, len(unique_drugs)//5), replace=False))
    cold_train = [i for i,p in enumerate(pair_drugs) if not held_out.intersection(p)]
    cold_test = [i for i,p in enumerate(pair_drugs) if held_out.intersection(p)]
    cold = {'trainPairs': len(cold_train), 'testPairs': len(cold_test), 'heldOutDrugs': len(held_out), 'evaluated': False}
    if len(cold_train) > 50 and len(set(y[cold_train])) == 3 and len(set(y[cold_test])) == 3:
        cold_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42))
        cold_model.fit(x[cold_train], y[cold_train])
        cold['baselineMacroF1'] = float(precision_recall_fscore_support(y[cold_test], cold_model.predict(x[cold_test]), average='macro', zero_division=0)[2]);cold['evaluated'] = True
    metadata = {'trained': True, 'selectedModel': selected, 'classes': labels, 'models': results, 'datasets': data['metadata'], 'split': {'train': len(train), 'validation': len(val), 'test': len(test), 'seed': 42, 'method': '60/20/20 stratified unique unordered-pair split'}, 'wholeDrugHoldout': cold, 'task': 'Severity classification conditional on known interaction, not interaction-existence detection.', 'limitations': ['No verified negative non-interaction labels.', 'No clinical validation.', 'Fingerprint collisions affect interpretability.', 'Pair-disjoint split may share drugs; separate whole-drug audit shown.', 'Scores are uncalibrated; no claim of clinical probability.']}
    (ROOT / 'artifacts/metrics.json').write_text(json.dumps(metadata, indent=2))
    (ROOT / 'artifacts/splits.json').write_text(json.dumps({k: [keys[i] for i in v] for k, v in [('train', train), ('validation', val), ('test', test)]}, indent=2))
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    axes[0].bar(labels, [sum(y == i) for i in range(3)]);axes[0].set_title('Real-data severity distribution')
    axes[1].bar([r['name'] for r in results], [r['macroF1'] for r in results]);axes[1].set_ylim(0, 1);axes[1].set_title('Test macro-F1');fig.tight_layout();fig.savefig(ROOT / 'artifacts/eda_comparison.png')
    print('Saved model, metrics, splits and EDA figure')
if __name__ == '__main__':
    main()
