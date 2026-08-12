const path = require('path');
const firebaseToolsPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
const auth = require(path.join(firebaseToolsPath, 'lib/auth'));
const apiv2 = require(path.join(firebaseToolsPath, 'lib/apiv2'));
const api = require(path.join(firebaseToolsPath, 'lib/api'));
const { v4: uuidv4 } = require(path.join(firebaseToolsPath, 'node_modules/uuid'));
const crypto = require('crypto');

function urlsafeBase64(str) {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function startLogin() {
  const authProxyClient = new apiv2.Client({
    urlPrefix: api.authProxyOrigin(),
    auth: false,
  });
  const sessionId = uuidv4();
  const codeVerifier = crypto.randomBytes(32).toString("hex");
  const codeChallenge = urlsafeBase64(crypto.createHash("sha256").update(codeVerifier).digest("base64"));
  
  const res = await authProxyClient.post("/attest", { session_id: sessionId });
  const attestToken = res.body.token;
  const loginUrl = `${api.authProxyOrigin()}/login?code_challenge=${codeChallenge}&session=${sessionId}&attest=${attestToken}`;
  
  console.log("SESSION_ID:" + sessionId.substring(0, 5).toUpperCase());
  console.log("LOGIN_URL:" + loginUrl);
  console.log("CODE_VERIFIER:" + codeVerifier);
}

startLogin().catch(console.error);
