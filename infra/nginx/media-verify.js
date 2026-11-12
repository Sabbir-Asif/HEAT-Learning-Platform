import hls from "./hls-verify.js";

const keyIdPattern = /^[A-Za-z0-9_-]{1,32}$/;
const expiryPattern = /^[0-9]{1,10}$/;
const signaturePattern = /^[0-9a-f]{64}$/;
const protectedPath = /^\/media\/protected\/[0-9]{4}\/[0-9]{2}\/[0-9a-f-]{36}\/[A-Za-z0-9_.-]{1,64}$/;

const fail = (reason) => ({ ok: false, reason });

const parseQuery = (rawUri) => {
  const cut = rawUri.indexOf("?");
  const values = {};
  if (cut < 0) return values;
  const pairs = rawUri.slice(cut + 1).split("&");
  for (let index = 0; index < pairs.length; index++) {
    const separator = pairs[index].indexOf("=");
    if (separator < 0) continue;
    const name = pairs[index].slice(0, separator);
    if (Object.prototype.hasOwnProperty.call(values, name)) values[name] = null;
    else values[name] = pairs[index].slice(separator + 1);
  }
  return values;
};

const signingInput = (path, expiry) => path + "\n" + String(expiry);

const verifyRequest = (input) => {
  const path = hls.normalisePath(input.uri);
  if (path === null || !protectedPath.test(path)) return fail("bad-path");
  const query = parseQuery(input.uri);
  const keyId = query.k;
  const expiry = query.e;
  const signature = query.s;
  if (typeof keyId !== "string" || !keyIdPattern.test(keyId)) return fail("malformed");
  if (typeof expiry !== "string" || !expiryPattern.test(expiry)) return fail("malformed");
  if (typeof signature !== "string" || !signaturePattern.test(signature)) return fail("malformed");
  if (!Object.prototype.hasOwnProperty.call(input.keys, keyId)) return fail("unknown-key");
  const expiresAt = parseInt(expiry, 10);
  const expected = input.hmacHex(input.keys[keyId], signingInput(path, expiresAt));
  if (!hls.constantTimeEqual(expected, signature)) return fail("bad-signature");
  if (expiresAt <= input.now) return fail("expired");
  return { ok: true, keyId };
};

export default { signingInput, verifyRequest };
