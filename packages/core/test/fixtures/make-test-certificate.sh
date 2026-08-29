#!/usr/bin/env bash
# Regenerate the throwaway signing certificate used by sign.test.ts.
#
# The key in test-signing.p12 signs nothing of value, protects no account and
# grants no access. It exists only so the signing tests have a certificate to
# work with, and its password is published here and in the README on purpose.
# Never use it for anything real.
set -euo pipefail
cd "$(dirname "$0")"

openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 7300 -nodes -subj "/CN=PDF Toolkit Test Certificate/O=Not A Real Org" \
  -addext "keyUsage=critical,digitalSignature,nonRepudiation" \
  -addext "extendedKeyUsage=emailProtection"

openssl pkcs12 -export -inkey key.pem -in cert.pem \
  -out test-signing.p12 -name "PDF Toolkit test" -passout pass:test

rm -f key.pem cert.pem
echo "wrote test-signing.p12 (password: test)"
