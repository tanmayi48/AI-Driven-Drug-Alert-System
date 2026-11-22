import unittest
from pathlib import Path
from ai_service.features import pair_features
from ai_service.main import predict, PairInput, model_info
class AiTests(unittest.TestCase):
    def test_commutative_features(self):
        import numpy as np
        np.testing.assert_array_equal(pair_features('CCO', 'CC'), pair_features('CC', 'CCO'))
    def test_invalid_structure_rejected(self):
        with self.assertRaises(ValueError):
            pair_features('', 'CCO')
    def test_missing_structure_never_predicts(self):
        r = predict(PairInput(drugA={'canonicalId':'a','name':'A'}, drugB={'canonicalId':'b','name':'B'}))
        self.assertFalse(r['available'])
    def test_metrics_honesty(self):
        info = model_info()
        if info['trained']:
            self.assertEqual(len(info['models']), 3)
            self.assertIn('conditional', info['task'])
        else:
            self.assertEqual(info['models'], [])
if __name__ == '__main__':
    unittest.main()
