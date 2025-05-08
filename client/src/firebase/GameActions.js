import { createDeck, shuffleDeck, calculateHandValue } from '../utils/GameHelpers';
import {
  doc,
  updateDoc,
  arrayRemove,
  deleteField,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  remove,
  onDisconnect,
  set,
  serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database';
import { rtdb } from './firebaseConfig';

export const setupPresence = (rtdb, lobbyId, uid) => {
  const ref = rtdb.ref(`/presence/${lobbyId}/${uid}`);
  ref.set(true);
  ref.onDisconnect().remove();
};

export const removePresence = async (lobbyId, uid) => {
  const beatRef = rtdbRef(rtdb, `lobbies/${lobbyId}/${uid}`);  // adjust if your path is 'presence'
  try {
    await onDisconnect(beatRef).cancel();     // cancel pending handler
  } catch (e) {
    console.warn('Failed to cancel onDisconnect:', e);
  }
  try {
    // optional: write a tiny tombstone so the onDelete always triggers
    await set(beatRef, { leftAt: rtdbServerTimestamp() });
    await remove(beatRef);
  } catch (e) {
    console.warn('Failed to remove presence:', e);
  }
};

export async function createLobby(db, lobbyData) {
  let lobbyId;
  let exists = true;
  let attempt = 0;

  while (exists && attempt < 10) {
    lobbyId = Math.floor(1000 + Math.random() * 9000).toString();
    const docRef = doc(db, 'lobbies', lobbyId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      exists = false;
      await setDoc(docRef, {
        ...lobbyData,
        createdAt: serverTimestamp(),
      });
    } else {
      attempt++;
    }
  }

  if (exists) {
    throw new Error('Failed to create a unique lobby after 10 attempts.');
  }

  return lobbyId;
}

/**
 * Starts a new game round in the specified lobby.
 */
export async function startGame(db, lobbyId, lobbyData) {
  if (lobbyData.status === 'playing') return;      // already started
  if (!lobbyData.players?.length) throw new Error('No players in lobby');

  /* ---------- build & shuffle deck ---------- */
  let deck = shuffleDeck(createDeck());

  /* ---------- initial hands ---------- */
  const hands   = {};
  const outcome = {};
  lobbyData.players.forEach(p => {
    hands[p] = [deck.pop(), deck.pop()];
    outcome[p] = '';           // will be filled as the round plays out
  });
  const dealerHand = [deck.pop(), { rank: 'Hidden', suit: 'Hidden' }];

  /* ---------- balances after taking bets ---------- */
  const balances = { ...lobbyData.balances };
  lobbyData.players.forEach(p => {
    balances[p] = (balances[p] ?? 100) - (lobbyData.bets[p] || 0);
  });

  /* ---------- persist game‑state + lobby header ---------- */
  const gameStateDoc = doc(db, 'lobbies', lobbyId, 'game', 'state');
  const lobbyDoc     = doc(db, 'lobbies', lobbyId);

  await Promise.all([
    setDoc(gameStateDoc, {
      deck,
      dealerHand,
      hands,
      bets      : { ...lobbyData.bets },
      balances,
      currentIdx: 0,            // 0 ⇒ first player in lobbyData.players
      outcome,
      roundFinished: false,
    }),
    updateDoc(lobbyDoc, { status: 'playing' }),
  ]);

  dlog('Start game: deck size', deck.length);
}

/**
 * Removes a player from the lobby and updates game state accordingly.
 */
/* — excerpt of leaveLobby only — */
export async function leaveLobby(db, lobbyId, uid) {

  try {
    await updateDoc(doc(db, 'lobbies', lobbyId), {
      players: arrayRemove(uid),
      [`ready.${uid}`]: deleteField(),
      [`bets.${uid}`]: deleteField(),
      [`balances.${uid}`]: deleteField(),
      [`usernames.${uid}`]: deleteField(),
    });
  } catch (e) {
    console.error('Failed Firestore leaveLobby:', e);
  }

  await removePresence(lobbyId, uid);

    await runTransaction(db, async tx => {
      const lobbyRef = doc(db, 'lobbies', lobbyId);
      const gameRef  = doc(db, 'lobbies', lobbyId, 'game', 'state');
  
      const [lobbySnap, gameSnap] = await Promise.all([
        tx.get(lobbyRef),
        tx.get(gameRef),
      ]);
      if (!lobbySnap.exists()) return;
  
      const lobby        = lobbySnap.data();
      const removedIdx   = lobby.players.indexOf(uid);
      const wasHost      = lobby.host === uid;
  
      /* ------- strip player from lobby ------- */
      const players   = lobby.players.filter(p => p !== uid);
      const ready     = { ...lobby.ready };     delete ready[uid];
      const bets      = { ...lobby.bets };      delete bets[uid];
      const balances  = { ...lobby.balances };  delete balances[uid];
      const usernames = { ...lobby.usernames }; delete usernames[uid];
  
      if (players.length === 0)  tx.delete(lobbyRef);
      else tx.update(lobbyRef, {
        players, ready, bets, balances, usernames,
        host: wasHost ? players[0] : lobby.host,
      });
  
      /* ------- update game doc if it exists ------- */
      if (!gameSnap.exists()) return;
      const g = gameSnap.data();
  
      delete g.hands[uid];
      delete g.bets[uid];
      delete g.balances[uid];
      delete g.outcome[uid];
  
      /* bookkeeping for turn pointer */
      const wasCurrentTurn = g.currentIdx === removedIdx;
      if (g.currentIdx > removedIdx) g.currentIdx--;
  
      const activePlayers = players.filter(p => !g.outcome[p]);
      if (
        !g.roundFinished &&
        (activePlayers.length === 0 || g.currentIdx >= players.length)
      ) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17)
          g.dealerHand.push(g.deck.pop());
  
        const dealerTot = calculateHandValue(g.dealerHand);
        players.forEach(p => {
          if (g.outcome[p] === 'Busted!') return;
          const ptot = calculateHandValue(g.hands[p]);
          let msg = '', bal = g.balances[p];
          if (dealerTot > 21 || ptot > dealerTot) msg = 'Win!',  bal += g.bets[p] * 2;
          else if (ptot === dealerTot)            msg = 'Push', bal += g.bets[p];
          else                                    msg = 'Lose';
          g.outcome[p] = msg;  g.balances[p] = bal;
        });
        g.roundFinished = true;
      }
  
      tx.update(gameRef, g);
    });
  }

  export async function quickLeaveLobby(db, lobbyId, uid) {
    try {
      await updateDoc(doc(db, 'lobbies', lobbyId), {
        players: arrayRemove(uid),
        [`ready.${uid}`]: deleteField(),
        [`bets.${uid}`]: deleteField(),
        [`balances.${uid}`]: deleteField(),
        [`usernames.${uid}`]: deleteField(),
      });
    } catch (e) {
      console.warn('quickLeaveLobby Firestore error:', e);
    }
  
    try {
      await removePresence(lobbyId, uid);
    } catch (e) {
      console.warn('quickLeaveLobby RTDB error:', e);
    }
  }
  
