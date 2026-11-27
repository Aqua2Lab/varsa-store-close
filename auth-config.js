/* Varsa Group PIN gate.
   PLACEHOLDER HASHES — no PIN works until these are replaced.
   A hash is SHA-256 of the UTF-8 text: salt + ":" + pin
   Generate a new pair with:
     node scripts/pin-hash.js 1234
   Then paste the printed salt and hash under manager or cashier.
   1234 in that example is not a PIN that is set here. */
var VARSA_AUTH = {
  manager: {
    salt: "d00543730529cb2c84087e251042db37",
    hash: "9d3e834ac8154a56b60199e04bb6335b6deba4653ed9358559ab0d24b5f1ac06"
  },
  cashier: {
    salt: "13acda6f9fdffdbe70e343ee5b8cf0f2",
    hash: "891ac648d503879441c73e96f59609a012e4ae9954863c0be7cc89ccd9397462"
  }
};
