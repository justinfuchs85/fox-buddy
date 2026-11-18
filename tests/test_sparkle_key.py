"""tools/sparkle_key.py: the release workflow's own Ed25519, checked against RFC 8032's test vectors."""
import base64
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import sparkle_key as sk  # noqa: E402

# RFC 8032, section 7.1, TEST 2
SEED = bytes.fromhex('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb')
PUB = bytes.fromhex('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c')
MSG = bytes.fromhex('72')
SIG = bytes.fromhex('92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da'
                    '085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00')


class SparkleKey(unittest.TestCase):
    def test_public_key_from_a_seed(self):
        self.assertEqual(sk.public_key(base64.b64encode(SEED).decode()), PUB)

    def test_public_key_from_seed_and_public(self):
        self.assertEqual(sk.public_key(base64.b64encode(SEED + PUB).decode()), PUB)

    def test_an_old_96_byte_key(self):
        self.assertEqual(sk.public_key(base64.b64encode(b'\0' * 64 + PUB).decode()), PUB)

    def test_a_mismatched_key_is_refused(self):
        with self.assertRaises(ValueError):
            sk.public_key(base64.b64encode(SEED + b'\1' * 32).decode())
        with self.assertRaises(ValueError):
            sk.public_key(base64.b64encode(b'short').decode())

    def test_a_good_signature(self):
        self.assertTrue(sk.verify(PUB, MSG, SIG))

    def test_a_bad_signature(self):
        self.assertFalse(sk.verify(PUB, b'something else', SIG))
        self.assertFalse(sk.verify(PUB, MSG, SIG[:-1] + b'\1'))


if __name__ == '__main__':
    unittest.main()
