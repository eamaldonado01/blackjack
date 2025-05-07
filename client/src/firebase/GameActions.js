import { createDeck, shuffleDeck, calculateHandValue } from '../utils/GameHelpers';
import {
  doc,
  updateDoc,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  remove,
  onDisconnect,
  set,
  serverTimestamp,
} from 'firebase/database';
import { rtdb } from './firebaseConfig';

export const removePresence = async (lobbyId, uid) => {
  const beatRef = rtdbRef(rtdb, `lobbies/${lobbyId}/${uid}`);  // adjust 'lobbies' if your root is named 'presence'
  try {
    await onDisconnect(beatRef).cancel();     // cancel pending handler
  } catch (e) {
    console.warn('Failed to cancel onDisconnect:', e);
  }
  try {
    // optional: write a tiny tombstone so the onDelete always triggers
    await set(beatRef, { leftAt: serverTimestamp() });
    await remove(beatRef);
  } catch (e) {
    console.warn('Failed to remove presence:', e);
  }
};

/**
 * Starts a new game round in the specified lobby.
 */
export async function startGame(db, lobbyId, lobbyData) {
  await runTransaction(db, async tx => {
    const lobbyRef = doc(db, 'lobbies', lobbyId);
    const gameRef = doc(db, 'lobbies', lobbyId, 'game', 'state');

  await updateDoc(doc(db, 'lobbies', lobbyId), {
    players  : arrayRemove(uid),
    ready    : deleteField(),
    bets     : deleteField(),
    balances : deleteField(),
    usernames: deleteField(),
  });


  const beat = ref(rtdb, `/presence/${lobbyId}/${uid}`);
  // cancel the still‑armed onDisconnect
  await onDisconnect(beat).cancel();
  // tiny “tombstone” write to guarantee siblings see the delete
  await set(beat, { leftAt: serverTimestamp() });
   await remove(beat);

    const lobbySnap = await tx.get(lobbyRef);
    if (!lobbySnap.exists()) throw new Error('Lobby does not exist');

    const lobby = lobbySnap.data();
    const players = lobby.players;

    const deck = shuffleDeck(createDeck());
    const hands = {};
    const bets = {};
    const balances = {};
    const outcome = {};

    players.forEach(p => {
      hands[p] = [deck.pop(), deck.pop()];
      bets[p] = lobby.bets[p];
      balances[p] = lobby.balances[p] - lobby.bets[p];
      outcome[p] = '';
    });

    let currentIdx = players.findIndex(
      p => calculateHandValue(hands[p]) !== 21
    );
    if (currentIdx === -1) currentIdx = players.length;

    const gameDoc = {
      deck,
      hands,
      dealerHand: [deck.pop(), { rank: 'Hidden', suit: 'Hidden' }],
      bets,
      balances,
      currentIdx,
      roundFinished: false,
      outcome,
    };

    if (currentIdx >= players.length) {
      const dealerHand = gameDoc.dealerHand;
      dealerHand[1] = deck.pop();
      while (calculateHandValue(dealerHand, true) < 17) dealerHand.push(deck.pop());

      const dealerTot = calculateHandValue(dealerHand);
      players.forEach(p => {
        const ptot = calculateHandValue(hands[p]);
        let msg = '', bal = balances[p];
        if (dealerTot > 21 || ptot > dealerTot) { msg = 'Win!'; bal += bets[p] * 2; }
        else if (ptot === dealerTot) { msg = 'Push'; bal += bets[p]; }
        else { msg = 'Lose'; }
        outcome[p] = msg;
        balances[p] = bal;
      });
      gameDoc.roundFinished = true;
    }

    tx.set(gameRef, gameDoc);
    tx.update(lobbyRef, { status: 'playing' });
  });
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
  
