const path = require('path');
const firebaseToolsPath = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools');
const auth = require(path.join(firebaseToolsPath, 'lib/auth'));

async function run() {
  console.log("=== STARTING FIREBASE LOGIN SERVER ===");
  try {
    const res = await auth.loginGoogle(true);
    auth.setGlobalDefaultAccount(res);
    console.log("=== SUCCESS_LOGGED_IN ===", res.user ? res.user.email : "OK");
  } catch (err) {
    console.error("=== LOGIN ERROR ===", err);
  }
}

run();
