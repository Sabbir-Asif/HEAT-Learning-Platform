import crypto from "crypto";
import hls from "./hls-verify.js";
import verify from "./media-verify.js";

const hmacHex = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

const authorize = (r) => {
  const result = verify.verifyRequest({
    uri: r.variables.request_uri,
    keys: hls.parseKeys(process.env.HLS_SIGNING_KEYS),
    now: Math.floor(Date.now() / 1000),
    hmacHex,
  });
  if (!result.ok) r.warn("media denied: " + result.reason);
  return result.ok ? "1" : "0";
};

export default { authorize };
