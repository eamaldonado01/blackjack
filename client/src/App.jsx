const DBG = true;
const dlog = (...args) => DBG && console.log('[App]', ...args);

import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import useLobby from './hooks/useLobby';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame  from './MultiPlayerGame';
import UsernameInput    from './components/UsernameInput';
import {
  createDeck,
  shuffleDeck,
  calculateHandValue
} from './utils/GameHelpers';

import { db } from './firebase';
import {
  doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, getDoc
} from 'firebase/firestore';
import './styles.css';



/* ----------------------------------------------------------- */

const uid = nanoid(8);

/* ============================================================= */
/*               ROBUST PLAYER‑DISCONNECT HANDLER                */
/* ============================================================= */
async function leaveLobby(db, lobbyId, uid) {
  dlog('leaveLobby START', { lobbyId, uid });

  await runTransaction(db, async tx => {
    const lobbyRef = doc(db, 'lobbies', lobbyId);
    const gameRef  = doc(db, 'lobbies', lobbyId, 'game', 'state');

    const [lobbySnap, gameSnap] = await Promise.all([
      tx.get(lobbyRef),
      tx.get(gameRef),
    ]);

    if (!lobbySnap.exists()) {
      dlog('leaveLobby: lobby document does NOT exist (already deleted)');
      return;
    }

    const lobby = lobbySnap.data();
    dlog('leaveLobby: LOBBY BEFORE', JSON.parse(JSON.stringify(lobby)));

    const removedIdx = lobby.players.indexOf(uid);
    if (removedIdx === -1) {
      dlog('leaveLobby: uid not found in players list (already removed?)');
      return;
    }

    const players   = lobby.players.filter(p => p !== uid);
    const ready     = { ...(lobby.ready || {}) };
    const bets      = { ...(lobby.bets || {}) };
    const balances  = { ...(lobby.balances || {}) };
    const usernames = { ...(lobby.usernames || {}) };

    delete ready[uid];
    delete bets[uid];
    delete balances[uid];
    delete usernames[uid];

    let newHost = lobby.host;
    if (lobby.host === uid) {
      newHost = players[0] || null;
      dlog('leaveLobby: host is leaving; transferring host to', newHost);
    }

    if (players.length === 0) {
      dlog('leaveLobby: no players left, deleting lobby');
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
      dlog('leaveLobby: LOBBY AFTER', { players, host: newHost });
    }

    if (!gameSnap.exists()) {
      dlog('leaveLobby: no active game doc found');
      return;
    }

    const g = gameSnap.data();
    dlog('leaveLobby: GAME BEFORE', JSON.parse(JSON.stringify(g)));

    delete g.hands[uid];
    delete g.bets[uid];
    delete g.balances[uid];
    delete g.outcome[uid];

    if (g.currentIdx >= removedIdx) g.currentIdx = Math.max(0, g.currentIdx - 1);

    if (!g.roundFinished && g.currentIdx >= players.length) {
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
      dlog('leaveLobby: GAME AUTO-SETTLED for remaining players');
    }

    tx.update(gameRef, g);
    dlog('leaveLobby: GAME AFTER', {
      hands: Object.keys(g.hands),
      currentIdx: g.currentIdx,
      roundFinished: g.roundFinished,
    });
  });

  dlog('leaveLobby TRANSACTION COMMITTED ✓');
}


/* =========================================================== */

export default function App() {
  /* generic state -------------------------------------------------------- */
  const [username, setUsername]         = useState('');
  const [readyScreen, setReadyScreen]   = useState(false);
  const [mode, setMode]                 = useState('menu');   // 'menu' | 'single' | 'multi'

  /* single‑player OR local pre‑bet figures ------------------------------- */
  const [balance, setBalance]           = useState(100);
  const [bet, setBet]                   = useState(0);

  const [dealerHand, setDealerHand]     = useState([]);
  const [playerHand, setPlayerHand]     = useState([]);
  const [deck, setDeck]                 = useState([]);

  const [playerMessage, setPlayerMessage] = useState('');
  const [canDouble, setCanDouble]       = useState(false);
  const [showActions, setShowActions]   = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);
  const [gameOver, setGameOver]         = useState(false);

  const [lobbyInput, setLobbyInput]     = useState('');

  /* lobby / multiplayer hooks -------------------------------------------- */
  const {
    lobbyId,
    lobbyData,
    createLobby,
    joinLobby,
    setReady: setLobbyReady       /* renamed in hook impl. */
  } = useLobby(username, uid);

  /* live “game” sub‑doc stream (only when a round is active) ------------- */
  const [gameState, setGameState] = useState(null);
  useEffect(() => {
    if (!lobbyId || lobbyData?.status !== 'playing') {
      setGameState(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'lobbies', lobbyId, 'game', 'state'),
      snap => setGameState(snap.data())
    );
    return () => unsub();
  }, [lobbyId, lobbyData?.status]);

  /* keep local balance / bet mirrored with the lobby while waiting ------- */
  useEffect(() => {
    if (lobbyData?.status !== 'waiting') return;

    const rawBal  = lobbyData.balances?.[uid] ?? 100;
    const currBet = lobbyData.bets?.[uid]     ?? 0;
    const isReady = lobbyData.ready?.[uid];

    setBalance(isReady ? rawBal - currBet : rawBal);
    setBet(currBet);
  }, [lobbyData?.status,
      lobbyData?.balances,
      lobbyData?.bets,
      lobbyData?.ready,
      uid]);

  /* call leaveLobby if the tab/window is closed -------------------------- */
/* beforeunload effect */
useEffect(() => {
  const handler = () => {
    dlog('beforeunload fired – leaving lobby');
    if (mode === 'multi' && lobbyId) leaveLobby(db, lobbyId, uid)
      .then(() => dlog('leaveLobby (BL) ✓'))
      .catch(err => console.error('leaveLobby (BL) error', err));
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [mode, lobbyId]);

/* live snapshot effect */
useEffect(() => {
  if (!lobbyId || lobbyData?.status !== 'playing') {
    setGameState(null);
    return;
  }
  dlog('Subscribing to game state doc for lobby', lobbyId);
  const unsub = onSnapshot(
    doc(db, 'lobbies', lobbyId, 'game', 'state'),
    snap => {
      dlog('Game state snapshot update:', snap.exists() ? snap.data() : 'doc deleted');
      setGameState(snap.data());
    }
  );
  return () => {
    dlog('Unsubscribing from game state doc for lobby', lobbyId);
    unsub();
  };
}, [lobbyId, lobbyData?.status]);

  /* ----------------------- helpers & actions --------------------------- */
  const resetRound = () => {
    setDealerHand([]); setPlayerHand([]);
    setPlayerMessage('');
    setCanDouble(false); setShowActions(false);
    setBet(0); setRoundFinished(false);
  };

  const playDealer = (dck, dHand) => {
    while (calculateHandValue(dHand, true) < 17) dHand.push(dck.pop());
    return dHand;
  };

  /* ---------- single‑player actions ---------- */
  const handleHitSingle = () => {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setDeck(newDeck);
    setPlayerHand(newHand);

    const total = calculateHandValue(newHand);
    if (total === 21) { handleStandSingle(newDeck, newHand); return; }
    if (total > 21) {
      setPlayerMessage('Busted!');
      setShowActions(false); setRoundFinished(true);
      if (balance === 0) setGameOver(true);
    }
  };

  const handleStandSingle = (dck = deck, ph = playerHand) => {
    const newDeck       = [...dck];
    const dealerReveal  = [...dealerHand];
    if (dealerReveal[1]?.rank === 'Hidden') dealerReveal[1] = newDeck.pop();

    const dealerFinal   = playDealer(newDeck, dealerReveal);

    setDeck(newDeck);
    setDealerHand(dealerFinal);

    const p = calculateHandValue(ph);
    const d = calculateHandValue(dealerFinal);

    if (d > 21 || p > d)            { setBalance(b => b + bet * 2); setPlayerMessage('Win!'); }
    else if (d === p)               { setBalance(b => b + bet    ); setPlayerMessage('Push — bet returned.'); }
    else                            { setPlayerMessage('Dealer wins.'); if (balance === 0) setGameOver(true); }

    setShowActions(false); setRoundFinished(true);
  };

  const handleDoubleSingle = () => {
    if (balance < bet) return;
    setBalance(b => b - bet);
    setBet(bet * 2);
    handleHitSingle();              // will draw 1
    if (!roundFinished) handleStandSingle();
  };

  /* ---------- shared helpers ---------- */
  const handleAddChipBet = value => {
    if (!showActions && balance >= value) {
      setBet(b => b + value);
      setBalance(b => b - value);
    }
  };

  const handleClearBet = async () => {
    if (showActions) return;
    setBalance(b => b + bet);
    setBet(0);
    if (mode === 'multi' && lobbyData?.status === 'waiting') {
      try { await setLobbyReady(false, 0); } catch (e) { console.error(e); }
    }
  };

  /* ---------- “Deal” button (single OR multi) ---------- */
  const handleDeal = async () => {
    if (bet === 0) return;

    /* single‑player ------------------------------------------------------ */
    if (mode === 'single') {
      const newDeck = shuffleDeck(createDeck());
      const player  = [newDeck.pop(), newDeck.pop()];
      const dealer  = [newDeck.pop(), { rank: 'Hidden', suit: 'Hidden' }];

      setDeck(newDeck);
      setPlayerHand(player);
      setDealerHand(dealer);
      setShowActions(true); setCanDouble(true);

      const player21 = calculateHandValue(player) === 21;
      const dealer21 = calculateHandValue([dealer[0], newDeck[newDeck.length - 1]]) === 21;

      if (player21) {
        setShowActions(false); setRoundFinished(true);
        if (dealer21) { setBalance(b => b + bet);       setPlayerMessage('Push — both blackjack'); }
        else          { setBalance(b => b + bet * 2.5); setPlayerMessage('Blackjack! You win!');   }
      }
      return;
    }

    /* multi‑player : just mark this player “ready” with their bet -------- */
    try {
      await setLobbyReady(true, bet);
    } catch (e) {
      console.error('setLobbyReady failed', e);
    }
  };

  /* ---------- lobby creation / join UI ---------- */
  const handleCreateLobby = async () => { await createLobby(); setMode('multi'); };
  const handleJoinLobby   = async () => {
    if (lobbyInput.trim()) { await joinLobby(lobbyInput.trim()); setMode('multi'); }
  };

  /* ---------- host‑only actions ---------- */
  const allReady =
    lobbyData?.players?.length > 0 &&
    Object.values(lobbyData.ready || {}).every(Boolean);

  const hostStartGame = async () => {
    if (uid !== lobbyData.host || !allReady) return;

    const deck      = shuffleDeck(createDeck());
    const hands     = {};
    const balances  = {};
    const bets      = lobbyData.bets;
    const prevBal   = lobbyData.balances || {};

    lobbyData.players.forEach(p => {
      hands[p]    = [deck.pop(), deck.pop()];
      balances[p] = (prevBal[p] ?? 100) - bets[p];
    });

    /* first player that doesn’t start with 21 gets the first turn */
    const firstIdx   = lobbyData.players.findIndex(
      p => calculateHandValue(hands[p]) !== 21
    );
    const currentIdx = firstIdx === -1 ? lobbyData.players.length : firstIdx;

    const gameDoc = {
      deck,
      hands,
      dealerHand: [deck.pop(), { rank: 'Hidden', suit: 'Hidden' }],
      bets,
      balances,
      currentIdx,
      roundFinished: false,
      outcome: {}
    };

    /* everyone starts on 21 => skip to dealer immediately */
    if (currentIdx >= lobbyData.players.length) {
      const dealerHand = gameDoc.dealerHand;
      dealerHand[1] = deck.pop();
      while (calculateHandValue(dealerHand, true) < 17) dealerHand.push(deck.pop());

      const dealerTot = calculateHandValue(dealerHand);
      lobbyData.players.forEach(p => {
        const ptot = calculateHandValue(hands[p]);
        let msg = '', bal = balances[p];
        if (dealerTot > 21 || ptot > dealerTot)      { msg = 'Win!';  bal += bets[p] * 2; }
        else if (ptot === dealerTot)                 { msg = 'Push'; bal += bets[p];      }
        else                                         { msg = 'Lose'; }
        gameDoc.outcome[p]  = msg;
        gameDoc.balances[p] = bal;
      });
      gameDoc.roundFinished = true;
    }

    await setDoc(doc(db, 'lobbies', lobbyId, 'game', 'state'), gameDoc);
    await updateDoc(doc(db, 'lobbies', lobbyId), { status: 'playing' });
  };

  /* the host clicks after a finished round to reset everything */
  const hostNewRound = async () => {
    if (uid !== lobbyData.host) return;

    const finalBalances =
      (await getDoc(doc(db, 'lobbies', lobbyId, 'game', 'state'))).data()?.balances
      || lobbyData.balances;

    const ready = {}, bets = {};
    lobbyData.players.forEach(p => { ready[p] = false; bets[p] = 0; });

    await updateDoc(doc(db, 'lobbies', lobbyId), {
      status: 'waiting',
      ready,
      bets,
      balances: finalBalances
    });
    await deleteDoc(doc(db, 'lobbies', lobbyId, 'game', 'state'));
  };

  /* ---------- in‑round player actions (Hit / Stand) ---------- */
  const txHit = async () => {
    const ref = doc(db, 'lobbies', lobbyId, 'game', 'state');
    await runTransaction(db, async tx => {
      const g    = (await tx.get(ref)).data();
      const idx  = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw new Error('Not your turn');
  
      g.hands[uid].push(g.deck.pop());
      const tot = calculateHandValue(g.hands[uid]);
  
      /* -------- bust / 21 handling -------- */
      if (tot > 21) {
        g.outcome[uid] = 'Busted!';
        g.currentIdx++;
      } else if (tot === 21) {
        g.currentIdx++;
      }
  
      /* if last active player done -> resolve dealer */
      if (g.currentIdx >= lobbyData.players.length) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17) g.dealerHand.push(g.deck.pop());
  
        const dealerTot = calculateHandValue(g.dealerHand);
        lobbyData.players.forEach(p => {
          if (g.outcome[p] === 'Busted!') return;            // already bust
          const ptot = calculateHandValue(g.hands[p]);
          let msg='', bal=g.balances[p];
          if (dealerTot > 21 || ptot > dealerTot)   { msg='Win!';  bal += g.bets[p]*2; }
          else if (ptot === dealerTot)              { msg='Push'; bal += g.bets[p];    }
          else                                      { msg='Lose'; }
          g.outcome[p] = msg; g.balances[p] = bal;
        });
        g.roundFinished = true;
      }
  
      tx.update(ref, g);
    });
  };

  const txStand = async () => {
    const ref = doc(db, 'lobbies', lobbyId, 'game', 'state');
    await runTransaction(db, async tx => {
      const g    = (await tx.get(ref)).data();
      const idx  = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw new Error('Not your turn');

      g.currentIdx++;

      if (g.currentIdx >= lobbyData.players.length) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17) g.dealerHand.push(g.deck.pop());

        const dealerTot = calculateHandValue(g.dealerHand);
        lobbyData.players.forEach(p => {
          if (g.outcome[p] === 'Busted!') return;
          const ptot = calculateHandValue(g.hands[p]);
          let msg='', bal=g.balances[p];
          if (dealerTot > 21 || ptot > dealerTot)   { msg='Win!';  bal += g.bets[p]*2; }
          else if (ptot === dealerTot)              { msg='Push'; bal += g.bets[p];    }
          else                                      { msg='Lose'; }
          g.outcome[p] = msg; g.balances[p] = bal;
        });
        g.roundFinished = true;
      }

      tx.update(ref, g);
    });
  };

  /* ---------- navigation (Menu button) ---------- */
  const handleBackToMenu = async () => {
    dlog('Menu clicked in mode:', mode, 'lobbyId:', lobbyId);
    try {
      if (mode === 'multi' && lobbyId) {
        await leaveLobby(db, lobbyId, uid);
        dlog('leaveLobby awaited ✓');
      }
    } catch (e) {
      console.error('leaveLobby threw', e);
    } finally {
      setMode('menu');
      resetRound();
      setBalance(100); setBet(0); setGameOver(false);
      setLobbyInput('');
    }
  };

  /* =========================================================== *
   * ====================== RENDER ============================== *
   * =========================================================== */

  if (!readyScreen) {
    return (
      <UsernameInput
        username={username}
        setUsername={setUsername}
        onReady={() => setReadyScreen(true)}
      />
    );
  }

  if (mode === 'menu') {
    return (
      <div className="table-container">
        <h1 className="title-banner">Blackjack</h1>

        <div className="join-container">
          <h2>Welcome, {username}!</h2>

          <p>Play Single‑player</p>
          <button
            className="common-button"
            onClick={() => { resetRound(); setGameOver(false); setMode('single'); }}
          >
            Single Player
          </button>

          <p className="section-spacing">Play Multiplayer</p>
          <div className="mp-buttons-row">
            <button className="common-button" onClick={handleCreateLobby}>
              Create New Lobby
            </button>
            <button className="common-button" onClick={handleJoinLobby}>
              Join Existing Lobby
            </button>
          </div>

          <input
            type="text"
            placeholder="Enter Lobby ID"
            value={lobbyInput}
            onChange={e => setLobbyInput(e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (mode === 'single') {
    return (
      <SinglePlayerGame
        /* props */
        onBack={handleBackToMenu}
        username={username}
        balance={balance}
        bet={bet}
        dealerHand={dealerHand}
        playerHand={playerHand}
        playerMessage={playerMessage}
        canDouble={canDouble}
        showActions={showActions}
        roundFinished={roundFinished}
        gameOver={gameOver}
        handleHit={handleHitSingle}
        handleStand={() => handleStandSingle()}
        handleDouble={handleDoubleSingle}
        handleClearBet={handleClearBet}
        handleDeal={handleDeal}
        handleAddChipBet={handleAddChipBet}
        handleNewRound={resetRound}
      />
    );
  }

  /* mode === 'multi' ----------------------------------------------------- */
  return (
    <MultiPlayerGame
      onBack={handleBackToMenu}
      uid={uid}
      lobbyId={lobbyId}
      lobbyData={lobbyData}
      balance={balance}
      bet={bet}
      allReady={allReady}
      hostStartGame={hostStartGame}
      handleAddChipBet={handleAddChipBet}
      handleClearBet={handleClearBet}
      handleDeal={handleDeal}
      gameState={gameState}
      handleHit={txHit}
      handleStand={txStand}
      hostNewRound={hostNewRound}
    />
  );
}
