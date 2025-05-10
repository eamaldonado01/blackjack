const { randomInt } = require('crypto');
const { v4: uuid } = require('uuid');

module.exports = {
  // Called once per virtual user
  before: (context, events, done) => {
    context.vars.uid = uuid();
    context.vars.lobbyCode = randomInt(1000, 9999);  // 4‑digit lobby
    return done();
  }
};
