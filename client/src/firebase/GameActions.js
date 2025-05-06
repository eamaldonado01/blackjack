import { doc, runTransaction } from 'firebase/firestore';
import { createDeck, shuffleDeck, calculateHandValue } from '../utils/GameHelpers';

/**
 * Starts a new game round in the specified lobby.
 */
export async function startGame(db, lobbyId, lobbyData) {
  await runTransaction(db, async tx => {
    const lobbyRef = doc(db, 'lobbies', lobbyId);
    const gameRef = doc(db, 'lobbies', lobbyId, 'game', 'state');

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
      balances[p] = lobby.balances[p];
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
export async function leaveLobby(db, lobbyId, uid) {
  console.log('[leaveLobby START]', { lobbyId, uid });

  await runTransaction(db, async tx => {
    const lobbyRef = doc(db, 'lobbies', lobbyId);
    const gameRef = doc(db, 'lobbies', lobbyId, 'game', 'state');

    const [lobbySnap, gameSnap] = await Promise.all([
      tx.get(lobbyRef),
      tx.get(gameRef),
    ]);

    if (!lobbySnap.exists()) {
      console.log('[leaveLobby] lobby document does NOT exist');
      return;
    }

    const lobby = lobbySnap.data();
    const removedIdx = lobby.players.indexOf(uid);
    if (removedIdx === -1) {
      console.log('[leaveLobby] uid not found in players list');
      return;
    }

    const players = lobby.players.filter(p => p !== uid);
    const ready = { ...lobby.ready };
    const bets = { ...lobby.bets };
    const balances = { ...lobby.balances };
    const usernames = { ...lobby.usernames };

    delete ready[uid];
    delete bets[uid];
    delete balances[uid];
    delete usernames[uid];

    let newHost = lobby.host;
    if (lobby.host === uid) {
      newHost = players[0] || null;
      console.log('[leaveLobby] Host left, transferring to', newHost);
    }

    if (players.length === 0) {
      console.log('[leaveLobby] No players left, deleting lobby');
      tx.delete(lobbyRef);
    } else {
      tx.update(lobbyRef, {
        players,
        ready,
        bets,
        balances,
        usernames,
        host: newHost,
      });
    }

    if (!gameSnap.exists()) {
      console.log('[leaveLobby] No active game doc found');
      return;
    }

    const g = gameSnap.data();

    delete g.hands[uid];
    delete g.bets[uid];
    delete g.balances[uid];
    delete g.outcome[uid];

    if (g.currentIdx >= removedIdx) g.currentIdx = Math.max(0, g.currentIdx - 1);

    if (!g.roundFinished && g.currentIdx >= players.length) {
      console.log('[leaveLobby] Auto-finishing dealer round');
      if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
      while (calculateHandValue(g.dealerHand, true) < 17) g.dealerHand.push(g.deck.pop());

      const dealerTot = calculateHandValue(g.dealerHand);
      players.forEach(p => {
        if (g.outcome[p] === 'Busted!') return;
        const ptot = calculateHandValue(g.hands[p]);
        let msg = '', bal = g.balances[p];
        if (dealerTot > 21 || ptot > dealerTot) { msg = 'Win!'; bal += g.bets[p] * 2; }
        else if (ptot === dealerTot) { msg = 'Push'; bal += g.bets[p]; }
        else { msg = 'Lose'; }
        g.outcome[p] = msg;
        g.balances[p] = bal;
      });
      g.roundFinished = true;
    }

    tx.update(gameRef, g);
  });

  console.log('[leaveLobby COMPLETED]');
}
