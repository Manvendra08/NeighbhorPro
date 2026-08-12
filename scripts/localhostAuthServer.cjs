const http = require('http');
const https = require('https');
const path = require('path');
const firebaseToolsPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
const auth = require(path.join(firebaseToolsPath, 'lib/auth'));
const api = require(path.join(firebaseToolsPath, 'lib/api'));
const jwt = require(path.join(firebaseToolsPath, 'node_modules/jsonwebtoken'));

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

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:9005');
  const code = u.searchParams.get('code');
  if (code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Authentication Successful! You can close this window.</h1>');
    console.log("RECEIVED_CODE:", code);
    
    try {
      const tokens = await exchangeCode(code);
      tokens.scopes = [
        "https://www.googleapis.com/auth/cloudplatformprojects.readonly",
        "https://www.googleapis.com/auth/firebase",
        "https://www.googleapis.com/auth/cloud-platform"
      ];
      
      const user = jwt.decode(tokens.id_token, { json: true });
      auth.setGlobalDefaultAccount({ user, tokens, scopes: tokens.scopes });
      console.log("=== SUCCESS_AUTHENTICATED ===", user ? user.email : "OK");
    } catch (e) {
      console.error("EXCHANGE_ERROR:", e.message || e);
    }
    
    setTimeout(() => process.exit(0), 1000);
  } else {
    res.writeHead(400);
    res.end('No code parameter');
  }
});

server.listen(9005, () => {
  console.log("SERVER_LISTENING_PORT_9005");
});
