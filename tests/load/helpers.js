// tests/load/helpers.js  – CommonJS

const randString = (len) =>
  Math.random().toString(36).slice(2, 2 + len);

module.exports = {
  /**
   * Fills `context.vars` with unique values for this VU.
   * Artillery passes (context, events, done)
   */
  generateUniqueData (context, events, done) {
    context.vars.uid        = randString(8);     // player id
    context.vars.lobbyCode  = randString(4);     // lobby code
    context.vars.shard      = Math.floor(Math.random() * 9); // 0‑8
    return done();
  }
};
