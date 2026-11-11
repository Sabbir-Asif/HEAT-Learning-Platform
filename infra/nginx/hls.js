import crypto from "crypto";
import verify from "./hls-verify.js";

const hmacHex = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

const authorize = (r) => {
  const result = verify.verifyRequest({
    uri: r.variables.request_uri,
    cookieHeader: r.headersIn.Cookie,
    keys: verify.parseKeys(process.env.HLS_SIGNING_KEYS),
    now: Math.floor(Date.now() / 1000),
    hmacHex,
  });
  if (!result.ok) r.warn("hls denied: " + result.reason);
  return result.ok ? "1" : "0";
};

export default { authorize };
