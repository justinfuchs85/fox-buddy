#!/usr/bin/env python3
"""The release workflow's checks on Sparkle's update-signing key, in plain Python (no packages needed).

    sparkle_key.py public <private-key-file>                 print the public key that goes in Info.plist
    sparkle_key.py verify <public-key> <file> <signature>    exit 1 unless the signature is good for the file

The private key file is what Sparkle's `generate_keys -x <file>` exports: base64 of a 32-byte seed (Sparkle 2),
of seed + public key (64 bytes), or of an older 96-byte key whose last 32 bytes are the public key. Checking
the signature the workflow just made means a key in the wrong form fails the build, not people's updates.

Ed25519 as in RFC 8032 (section 6), slow but small: it runs once per release.
"""
import base64
import hashlib
import sys

p = 2 ** 255 - 19
L = 2 ** 252 + 27742317777372353535851937790883648493
d = -121665 * pow(121666, p - 2, p) % p
I = pow(2, (p - 1) // 4, p)


def _recover_x(y, sign):
    xx = (y * y - 1) * pow(d * y * y + 1, p - 2, p)
    x = pow(xx, (p + 3) // 8, p)
    if (x * x - xx) % p:
        x = x * I % p
    if (x * x - xx) % p:
        return None
    return p - x if x & 1 != sign else x


_gy = 4 * pow(5, p - 2, p) % p
G = (_recover_x(_gy, 0), _gy, 1, _recover_x(_gy, 0) * _gy % p)


def _add(P, Q):
    A = (P[1] - P[0]) * (Q[1] - Q[0]) % p
    B = (P[1] + P[0]) * (Q[1] + Q[0]) % p
    C = 2 * P[3] * Q[3] * d % p
    D = 2 * P[2] * Q[2] % p
    E, F, Gg, H = B - A, D - C, D + C, B + A
    return (E * F % p, Gg * H % p, F * Gg % p, E * H % p)


def _mul(s, P):
    Q = (0, 1, 1, 0)
    while s:
        if s & 1:
            Q = _add(Q, P)
        P = _add(P, P)
        s >>= 1
    return Q


def _encode(P):
    zi = pow(P[2], p - 2, p)
    x, y = P[0] * zi % p, P[1] * zi % p
    return int.to_bytes(y | ((x & 1) << 255), 32, 'little')


def _decode(b):
    if len(b) != 32:
        return None
    y = int.from_bytes(b, 'little')
    sign = y >> 255
    y &= (1 << 255) - 1
    if y >= p:
        return None
    x = _recover_x(y, sign)
    return None if x is None else (x, y, 1, x * y % p)


def _equal(P, Q):
    return (P[0] * Q[2] - Q[0] * P[2]) % p == 0 and (P[1] * Q[2] - Q[1] * P[2]) % p == 0


def public_from_seed(seed):
    h = hashlib.sha512(seed).digest()
    a = int.from_bytes(h[:32], 'little')
    a &= (1 << 254) - 8
    a |= 1 << 254
    return _encode(_mul(a, G))


def public_key(private_b64):
    raw = base64.b64decode(private_b64.strip())
    if len(raw) == 32:
        return public_from_seed(raw)
    if len(raw) == 64:
        pub = public_from_seed(raw[:32])
        if pub != raw[32:]:
            raise ValueError('the key file\'s two halves don\'t match')
        return pub
    if len(raw) == 96:
        return raw[64:]
    raise ValueError(f'a {len(raw)}-byte key: expected what Sparkle\'s generate_keys -x exports')


def verify(public, message, signature):
    A, R = _decode(public), _decode(signature[:32])
    if A is None or R is None or len(signature) != 64:
        return False
    s = int.from_bytes(signature[32:], 'little')
    if s >= L:
        return False
    h = int.from_bytes(hashlib.sha512(signature[:32] + public + message).digest(), 'little') % L
    return _equal(_mul(s, G), _add(R, _mul(h, A)))


def main(argv):
    if len(argv) == 3 and argv[1] == 'public':
        print(base64.b64encode(public_key(open(argv[2]).read())).decode())
        return 0
    if len(argv) == 5 and argv[1] == 'verify':
        ok = verify(base64.b64decode(argv[2]), open(argv[3], 'rb').read(), base64.b64decode(argv[4]))
        print('signature checks out' if ok else 'signature does NOT match the public key')
        return 0 if ok else 1
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
