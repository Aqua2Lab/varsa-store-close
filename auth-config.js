/* Varsa Group PIN gate.
   A hash is SHA-256 of the UTF-8 text: salt + ":" + pin
   To replace one:
     node scripts/pin-hash.js 1234
   Then paste the printed salt and hash under manager or cashier.
   1234 in that example is not a PIN that is set here. */
var VARSA_AUTH = {
  manager: {
    salt: "b07e5c9a01ad1709e8f74d8e6b1549d8",
    hash: "a82a2d206754a65cd8c40b92e1e09205ad8549526a2474e36838410608955db1"
  },
  cashier: {
    salt: "9f9b86c1f3827db09f94b65402ce0c89",
    hash: "be5eeaed1cef3e89257128ed87ae902c0d885cb634b30224c8de163d6c219937"
  }
};
