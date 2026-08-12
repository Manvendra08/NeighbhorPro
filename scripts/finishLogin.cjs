const path = require('path');
const firebaseToolsPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
const auth = require(path.join(firebaseToolsPath, 'lib/auth'));
const api = require(path.join(firebaseToolsPath, 'lib/api'));
const jwt = require(path.join(firebaseToolsPath, 'node_modules/jsonwebtoken'));
const https = require('https');

const authCode = process.argv[2];

if (!authCode) {
  console.error("Usage: node finishLogin.cjs <authCode>");
  process.exit(1);
}

function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      code: code,
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      redirect_uri: "http://localhost:9005",
      grant_type: "authorization_code"
    }).toString();

    const options = {
      hostname: 'accounts.google.com',
      port: 443,
      path: '/o/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function finish() {
  console.log("Exchanging auth code for tokens...");
  const tokens = await exchangeCode(authCode);
  
  tokens.scopes = [
    "https://www.googleapis.com/auth/cloudplatformprojects.readonly",
    "https://www.googleapis.com/auth/firebase",
    "https://www.googleapis.com/auth/cloud-platform"
  ];
  
  const user = jwt.decode(tokens.id_token, { json: true });
  const result = {
    user: user,
    tokens: tokens,
    scopes: tokens.scopes
  };
  
  auth.setGlobalDefaultAccount(result);
  console.log("=== SUCCESS_LOGGED_IN ===", user ? user.email : "OK");
}

finish().catch(err => {
  console.error("Failed to complete login:", err.message || err);
  process.exit(1);
});
