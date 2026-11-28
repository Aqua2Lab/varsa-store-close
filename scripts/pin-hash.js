/* Print a salt and SHA-256 hash for a new hub PIN.
   Usage: node scripts/pin-hash.js 1234
   The hash is SHA-256 of the UTF-8 text salt + ":" + pin.
   Paste the two lines into auth-config.js. Do not commit the PIN itself. */
const crypto = require("crypto");
const pin = process.argv[2] || "";
if (!/^\d{4,8}$/.test(pin)) {
  console.error("Usage: node scripts/pin-hash.js <4-8 digit PIN>");
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.createHash("sha256").update(salt + ":" + pin, "utf8").digest("hex");
console.log("salt: " + salt);
console.log("hash: " + hash);
