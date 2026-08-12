const fs = require('fs');
const path = require('path');
const https = require('https');
const firebaseToolsPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
const auth = require(path.join(firebaseToolsPath, 'lib/auth'));

async function deployRules() {
  const acc = auth.getGlobalDefaultAccount();
  const token = acc.tokens.access_token;
  const projectId = 'neighbhorpro';
  
  const rulesContent = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  
  console.log("1. Creating Ruleset via Firebase Rules API...");
  const createRulesetBody = JSON.stringify({
    source: {
      files: [
        {
          name: 'firestore.rules',
          content: rulesContent
        }
      ]
    }
  });

  const rulesetRes = await makeRequest({
    hostname: 'firebaserules.googleapis.com',
    path: `/v1/projects/${projectId}/rulesets`,
    method: 'POST',
    token: token,
    body: createRulesetBody
  });

  console.log("Ruleset created:", rulesetRes.name);
  const rulesetName = rulesetRes.name;

  console.log("2. Releasing Ruleset to cloud.firestore...");
  const releaseBody = JSON.stringify({
    release: {
      name: `projects/${projectId}/releases/cloud.firestore`,
      rulesetName: rulesetName
    }
  });

  const releaseRes = await makeRequest({
    hostname: 'firebaserules.googleapis.com',
    path: `/v1/projects/${projectId}/releases/cloud.firestore?updateMask=rulesetName`,
    method: 'PATCH',
    token: token,
    body: releaseBody
  });

  console.log("=== FIRESTORE RULES DEPLOYED SUCCESSFULLY! ===");
  console.log("Release Name:", releaseRes.name);
  console.log("Active Ruleset:", releaseRes.rulesetName);
  console.log("Updated At:", releaseRes.updateTime);
}

function makeRequest({ hostname, path, method, token, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

deployRules().catch(err => {
  console.error("DEPLOYMENT FAILED:", err.message || err);
  process.exit(1);
});
