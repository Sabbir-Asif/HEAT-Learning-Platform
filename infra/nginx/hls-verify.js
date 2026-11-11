const cookieName = "hls_sig";
const videoIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const keyIdPattern = /^[A-Za-z0-9_-]{1,32}$/;
const expiryPattern = /^[0-9]{1,10}$/;
const signaturePattern = /^[0-9a-f]{64}$/;

const fail = (reason) => ({ ok: false, reason });

const hasForbiddenCharacter = (text) => {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127 || code === 92) return true;
  }
  return false;
};

export const constantTimeEqual = (left, right) => {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index++) {
    const a = index < left.length ? left.charCodeAt(index) : 0;
    const b = index < right.length ? right.charCodeAt(index) : 0;
    difference |= a ^ b;
  }
  return difference === 0;
};

export const normalisePath = (rawUri) => {
  if (typeof rawUri !== "string") return null;
  const cut = rawUri.search(/[?#]/);
  const path = cut < 0 ? rawUri : rawUri.slice(0, cut);
  if (path.charAt(0) !== "/") return null;
  if (hasForbiddenCharacter(path)) return null;
  if (/%(2f|5c|00)/i.test(path)) return null;
  if (/%(?![0-9a-fA-F]{2})/.test(path)) return null;

  let unsupported = false;
  const decoded = path.replace(/%([0-9a-fA-F]{2})/g, (_match, hex) => {
    const code = parseInt(hex, 16);
    if (code >= 128) unsupported = true;
    return String.fromCharCode(code);
  });
  if (unsupported) return null;
  if (decoded.indexOf("%") >= 0) return null;
  if (hasForbiddenCharacter(decoded)) return null;

  const segments = decoded.split("/").slice(1);
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment === "." || segment === "..") return null;
    if (segment === "" && index !== segments.length - 1) return null;
  }
  return "/" + segments.join("/");
};

export const parseKeys = (text) => {
  const keys = {};
  if (typeof text !== "string") return keys;
  for (const entry of text.split(",")) {
    const separator = entry.indexOf(":");
    if (separator < 0) continue;
    const id = entry.slice(0, separator).trim();
    const secret = entry.slice(separator + 1).trim();
    if (keyIdPattern.test(id) && secret !== "") keys[id] = secret;
  }
  return keys;
};

export const signingInput = (videoId, expiry) =>
  videoId + "\n/hls/" + videoId + "/\n" + String(expiry);

const readCookie = (header) => {
  if (typeof header !== "string" || header === "") return { state: "missing" };
  const values = [];
  for (const part of header.split(";")) {
    const pair = part.trim();
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator) === cookieName) values.push(pair.slice(separator + 1));
  }
  if (values.length === 0) return { state: "missing" };
  if (values.length > 1) return { state: "malformed" };
  const fields = values[0].split(".");
  if (fields.length !== 3) return { state: "malformed" };
  const keyId = fields[0];
  const expiry = fields[1];
  const signature = fields[2];
  if (!keyIdPattern.test(keyId)) return { state: "malformed" };
  if (!expiryPattern.test(expiry)) return { state: "malformed" };
  if (!signaturePattern.test(signature)) return { state: "malformed" };
  return { state: "ok", keyId, expiry: parseInt(expiry, 10), signature };
};

export const verifyRequest = ({ uri, cookieHeader, keys, now, hmacHex }) => {
  const path = normalisePath(uri);
  if (path === null) return fail("bad-path");
  const prefix = /^\/hls\/([A-Za-z0-9_-]{1,64})\//.exec(path);
  if (prefix === null || !videoIdPattern.test(prefix[1])) return fail("bad-path");
  const videoId = prefix[1];

  const cookie = readCookie(cookieHeader);
  if (cookie.state === "missing") return fail("no-cookie");
  if (cookie.state === "malformed") return fail("malformed");

  if (!Object.prototype.hasOwnProperty.call(keys, cookie.keyId)) return fail("unknown-key");
  const expected = hmacHex(keys[cookie.keyId], signingInput(videoId, cookie.expiry));
  if (!constantTimeEqual(expected, cookie.signature)) return fail("bad-signature");
  if (cookie.expiry <= now) return fail("expired");
  return { ok: true, videoId, keyId: cookie.keyId };
};
