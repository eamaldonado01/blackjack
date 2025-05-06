const functions = require("firebase-functions");
const admin     = require("firebase-admin");

admin.initializeApp();
const fdb = admin.firestore();

/**
 * Presence path written by the frontend:
 *   /status/{lobbyId}/{uid}   = 'online'
 * onDisconnect() -> node is removed automatically by the SDK
 */
exports.onPlayerDisconnect = functions.database
  .ref("/status/{lobbyId}/{uid}")
  .onDelete(async (_snap, context) => {
    const { lobbyId, uid } = context.params;
    const lobbyRef = fdb.collection("lobbies").doc(lobbyId);
    const gameRef  = lobbyRef.collection("game").doc("state");

    await fdb.runTransaction(async tx => {
      /* ---- lobby doc ------------------------------------------------ */
      const lobbySnap = await tx.get(lobbyRef);
      if (!lobbySnap.exists) return;              // already cleaned
      const lobby = lobbySnap.data();

      const idx = lobby.players.indexOf(uid);
      if (idx === -1) return;                     // already removed

      lobby.players.splice(idx, 1);
      delete lobby.ready     [uid];
      delete lobby.bets      [uid];
      delete lobby.balances  [uid];
      delete lobby.usernames [uid];

      // transfer host or delete empty lobby
      if (lobby.players.length === 0) {
        tx.delete(lobbyRef);
      } else {
        if (lobby.host === uid) lobby.host = lobby.players[0];
        tx.set(lobbyRef, lobby, { merge: true });
      }

      /* ---- game sub‑doc --------------------------------------------- */
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) return;
      const g = gameSnap.data();

      delete g.hands    [uid];
      delete g.bets     [uid];
      delete g.balances [uid];
      delete g.outcome  [uid];

      if (g.currentIdx >= idx) g.currentIdx = Math.max(0, g.currentIdx - 1);

      tx.set(gameRef, g, { merge: true });
    });

    console.log(`[onPlayerDisconnect] cleaned ${uid} in lobby ${lobbyId}`);
    return null;
  });
