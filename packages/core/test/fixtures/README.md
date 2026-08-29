# Test fixtures

## test-signing.p12

A throwaway self-signed certificate and private key, used by `sign.test.ts` so
the signing tests have something to sign with.

**Password: `test`.** Published deliberately, here and in the script that makes
the file.

This key is not a secret. It signs nothing of value, protects no account and
grants access to nothing. It is self-signed, so no reader trusts it: a document
signed with it shows as "validity unknown" in Acrobat, which is exactly what
the tests expect. Never use it for anything real.

Regenerate it with `./make-test-certificate.sh`, which needs `openssl` on the
path. The committed file is what the tests actually use, so regenerating is
only necessary if it expires; it is currently issued for 20 years, which is
absurd for a real certificate and right for this one.
