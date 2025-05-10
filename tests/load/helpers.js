const { randomInt } = require('crypto');
const { v4: uuid } = require('uuid');

function randomString() {
    return Math.random().toString(36).substring(7);  // Generates random 5-7 char string
  }
module.exports = {
    randomString,
    generateUniqueData: function (userContext, events, done) {
      const uid = `user_${Math.floor(Math.random() * 1000000)}`;
      const shard = Math.floor(Math.random() * 10) + 1;  // 1-10 shards
      userContext.vars.uid = uid;
      userContext.vars.shard = shard;
      return done();
    }
  };
  
  
