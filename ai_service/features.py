import numpy as np

def pair_features(a, b):
    """Commutative RDKit features prevent reversed-pair leakage."""
    from rdkit import Chem
    from rdkit.Chem import rdFingerprintGenerator
    gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=256)
    molecules = [Chem.MolFromSmiles(s or '') for s in (a, b)]
    if any(m is None or m.GetNumAtoms() == 0 for m in molecules):
        raise ValueError('Both medicines need valid molecular structures')
    x, y = [np.asarray(gen.GetFingerprint(m), dtype=np.float32) for m in molecules]
    return np.concatenate([x + y, np.abs(x - y)])

FEATURE_NAMES = [f'fingerprint_sum_{i}' for i in range(256)] + [f'fingerprint_difference_{i}' for i in range(256)]
