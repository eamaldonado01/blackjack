const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Triggered when any player disappears from the presence list.
 * Keeps Firestore and RTDB in sync by trimming the lobby doc.
 */
exports.onPresenceDelete = functions.database
  .ref('/lobbies/{lobbyId}/{uid}')   // adjust this if your RTDB path is different (was 'presence' before?)
  .onDelete(async (_, ctx) => {
    const { lobbyId, uid } = ctx.params;
    const lobbyRef = admin.firestore().collection('lobbies').doc(lobbyId);

    await admin.firestore().runTransaction(async txn => {
      const snap = await txn.get(lobbyRef);
      if (!snap.exists) return;
      const data = snap.data();

      // 1️⃣ remove the user from players + all related fields
      const players = (data.players || []).filter(p => p !== uid);
      const updates = {
        players,
        [`ready.${uid}`]: admin.firestore.FieldValue.delete(),
        [`bets.${uid}`]: admin.firestore.FieldValue.delete(),
        [`balances.${uid}`]: admin.firestore.FieldValue.delete(),
        [`usernames.${uid}`]: admin.firestore.FieldValue.delete(),
      };

      // 2️⃣ if nobody remains, delete the lobby entirely
      if (players.length === 0) {
        txn.delete(lobbyRef);
        console.log(`Lobby ${lobbyId} deleted (last player ${uid} left)`);
      } else {
        // 3️⃣ if the host left, promote a new host
        if (data.host && !players.includes(data.host)) {
          updates.host = players[0];
          console.log(`Lobby ${lobbyId}: new host is ${players[0]}`);
        }
        txn.update(lobbyRef, updates);
        console.log(`Lobby ${lobbyId}: removed player ${uid}`);
      }
    });
  });
