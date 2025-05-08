/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';

import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame  from './MultiPlayerGame';
import UsernameInput    from './components/UsernameInput';
import Leaderboard      from './components/Leaderboard';
import { useLobby, setupPresence } from './hooks/useLobby';

import {
  startGame,
  leaveLobby,
  quickLeaveLobby,
} from './firebase/GameActions';

import { updateLeaderboard } from './firebase/LeaderboardActions';

import { db } from './firebase/firebaseConfig';
import {
  doc, onSnapshot, getDoc, updateDoc, runTransaction,
} from 'firebase/firestore';

import {
  createDeck,
  shuffleDeck,
  calculateHandValue,
} from './utils/GameHelpers';

import './styles.css';

/* --------------------------- constants ---------------------------- */
const DBG  = true;
const dlog = (...a) => DBG && console.log('[App]', ...a);
const uid  = nanoid(8);

/* ================================================================= */
export default function App() {
  /* ------------------------- generic UI --------------------------- */
  const [username , setUsername ] = useState('');
  const [readyScrn , setReadyScrn] = useState(false);
  const [mode     , setMode     ] = useState('menu');   // menu | single | multi

  /* -------------------- local (single‑player) state --------------- */
  const [balance     , setBalance     ] = useState(100);
  const [bet         , setBet         ] = useState(0);
  const [dealerHand  , setDealerHand  ] = useState([]);
  const [playerHand  , setPlayerHand  ] = useState([]);
  const [deck        , setDeck        ] = useState([]);
  const [playerMsg   , setPlayerMsg   ] = useState('');
  const [canDouble   , setCanDouble   ] = useState(false);
  const [showActions , setShowActions ] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);
  const [gameOver    , setGameOver    ] = useState(false);

  const [lobbyInput  , setLobbyInput  ] = useState('');

  /* -------------------------- lobby hook -------------------------- */
  const {
    lobbyId,
    lobbyData,
    createLobby,
    joinLobby,
    setReady: setLobbyReady,
  } = useLobby(username, uid);

  /* --------------------------- presence --------------------------- */
  const presenceSet = useRef(false);
  useEffect(() => {
    if (mode === 'multi' && lobbyId && !presenceSet.current) {
      setupPresence(lobbyId, uid);
      presenceSet.current = true;
    }
    if (mode !== 'multi') presenceSet.current = false;
  }, [mode, lobbyId]);

  /* ---------------- leave / refresh safety for multiplayer -------- */
  useEffect(() => {
    if (mode !== 'multi' || !lobbyId) return;
    const bye = () => { try { quickLeaveLobby(db, lobbyId, uid); } catch {} };
    window.addEventListener('pagehide',     bye, { capture: true });
    window.addEventListener('beforeunload', bye, { capture: true });
    return () => {
      window.removeEventListener('pagehide',     bye, { capture: true });
      window.removeEventListener('beforeunload', bye, { capture: true });
    };
  }, [mode, lobbyId]);

  /* -------------------- live in‑round snapshot -------------------- */
  const [gameState, setGameState] = useState(null);
  useEffect(() => {
    if (!lobbyId || lobbyData?.status !== 'playing') { setGameState(null); return; }
    const unsub = onSnapshot(
      doc(db, 'lobbies', lobbyId, 'game', 'state'),
      snap => setGameState(snap.data()),
    );
    return () => unsub();
  }, [lobbyId, lobbyData?.status]);

  /* ------- sync local balance after completed MP rounds ----------- */
  useEffect(() => {
    if (gameState?.balances && gameState.roundFinished) {
      const newBal = gameState.balances[uid];
      if (newBal !== undefined && newBal !== balance) setBalance(newBal);
    }
  }, [gameState]);

  /* ------------ mirror balance while waiting in lobby ------------- */
  useEffect(() => {
    if (lobbyData?.status !== 'waiting') return;
    const rawBal  = lobbyData.balances?.[uid] ?? 100;
    const currBet = lobbyData.bets?.[uid]     ?? 0;
    const isReady = lobbyData.ready?.[uid];
    setBalance(isReady ? rawBal - currBet : rawBal);
    setBet(currBet);
  }, [lobbyData?.status, lobbyData?.balances,
      lobbyData?.bets,   lobbyData?.ready]);

  /* --------------- write high‑score to leaderboard ---------------- */
  useEffect(() => { if (username) updateLeaderboard(uid, username, balance); }, [balance]);

  /* ======================= single‑player ========================= */
  const resetRound = () => {
    setDealerHand([]); setPlayerHand([]); setPlayerMsg('');
    setCanDouble(false); setShowActions(false);
    setBet(0); setRoundFinished(false);
  };
  const playDealer = (dck, dHand) => {
    while (calculateHandValue(dHand, true) < 17) dHand.push(dck.pop());
    return dHand;
  };

  const handleHitSingle = () => {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setDeck(newDeck); setPlayerHand(newHand);
    setCanDouble(false);                 // <-- cannot double after first action

    const tot = calculateHandValue(newHand);
    if (tot === 21) { handleStandSingle(newDeck, newHand); return; }
    if (tot > 21) {
      setPlayerMsg('Busted!'); setShowActions(false);
      setRoundFinished(true); if (balance === 0) setGameOver(true);
    }
  };
  const handleStandSingle = (dck = deck, ph = playerHand) => {
    setCanDouble(false);
    const dDeck = [...dck];
    const dReveal = [...dealerHand];
    if (dReveal[1]?.rank === 'Hidden') dReveal[1] = dDeck.pop();
    const dealerFinal = playDealer(dDeck, dReveal);
    setDeck(dDeck); setDealerHand(dealerFinal);

    const p = calculateHandValue(ph);
    const d = calculateHandValue(dealerFinal);
    if (d > 21 || p > d)           { setBalance(b => b + bet * 2); setPlayerMsg('Win!'); }
    else if (d === p)              { setBalance(b => b + bet    ); setPlayerMsg('Push — bet returned.'); }
    else                           { setPlayerMsg('Dealer wins.'); if (balance === 0) setGameOver(true); }

    setShowActions(false); setRoundFinished(true);
  };
  const handleDoubleSingle = () => {
    if (!canDouble || balance < bet) return;
    setCanDouble(false);
    setBalance(b => b - bet); setBet(bet * 2);
    handleHitSingle();                       // one card
    if (!roundFinished) handleStandSingle(); // auto‑stand if not busted
  };

  /* ===================== single/shared helpers ==================== */
  const handleAddChipBet = v => {
    if (!showActions && balance >= v) { setBet(b => b + v); setBalance(b => b - v); }
  };
  const handleClearBet = async () => {
    if (showActions) return;
    setBalance(b => b + bet); setBet(0);
    if (mode === 'multi' && lobbyData?.status === 'waiting') {
      try { await setLobbyReady(false, 0); } catch (err) { console.error(err); }
    }
  };

  /* ------------------------- “Deal” btn --------------------------- */
  const handleDeal = async () => {
    if (bet === 0) return;

    /* -------- single‑player -------- */
    if (mode === 'single') {
      const newDeck = shuffleDeck(createDeck());
      const player  = [newDeck.pop(), newDeck.pop()];
      const dealer  = [newDeck.pop(), { rank: 'Hidden', suit: 'Hidden' }];
      setDeck(newDeck); setPlayerHand(player); setDealerHand(dealer);
      setShowActions(true); setCanDouble(true);

      const p21 = calculateHandValue(player) === 21;
      const d21 = calculateHandValue([dealer[0], newDeck[newDeck.length - 1]]) === 21;
      if (p21) {
        setShowActions(false); setRoundFinished(true); setCanDouble(false);
        if (d21) setBalance(b => b + bet), setPlayerMsg('Push — both blackjack');
        else     setBalance(b => b + bet * 2.5), setPlayerMsg('Blackjack! You win!');
      }
      return;
    }

    /* -------- multiplayer: mark player ready -------- */
    try { await setLobbyReady(true, bet); }
    catch (err) { console.error('setLobbyReady failed', err); }
  };

  /* -------------------- lobby helpers ----------------------------- */
  const handleCreateLobby = async () => { await createLobby(); setMode('multi'); };
  const handleJoinLobby   = async () => {
    const code = lobbyInput.trim(); if (!code) return;
    await joinLobby(code); setMode('multi');
  };

  /* ---------------------- host controls --------------------------- */
  const allReady =
    lobbyData?.players?.length > 0 &&
    Object.values(lobbyData.ready || {}).every(Boolean);

  const hostStartGame = async () => {
    if (uid !== lobbyData.host || !allReady) return;
    try { await startGame(db, lobbyId, lobbyData); }
    catch (err) { console.error('startGame failed:', err); }
  };
  const hostNewRound = async () => {
    if (uid !== lobbyData.host) return;
    const finalBalances =
      (await getDoc(doc(db, 'lobbies', lobbyId, 'game', 'state')))
        .data()?.balances || lobbyData.balances;
    const ready = {}, bets = {};
    lobbyData.players.forEach(p => { ready[p] = false; bets[p] = 0; });
    await updateDoc(doc(db, 'lobbies', lobbyId), {
      status: 'waiting', ready, bets, balances: finalBalances,
    });
  };

  /* ========================= MP actions =========================== */
  const txHit = async () => {
    const ref = doc(db, 'lobbies', lobbyId, 'game', 'state');
    await runTransaction(db, async tx => {
      const g   = (await tx.get(ref)).data();
      const idx = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw new Error('Not your turn');

      g.hands[uid].push(g.deck.pop());
      const tot = calculateHandValue(g.hands[uid]);
      if (tot > 21 || tot === 21) g.currentIdx++;    // auto‑advance on bust or 21

      if (tot > 21) g.outcome[uid] = 'Busted!';

      /* -------- dealer / settle if last player -------- */
      if (g.currentIdx >= lobbyData.players.length) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17) g.dealerHand.push(g.deck.pop());

        const dealerTot = calculateHandValue(g.dealerHand);
        lobbyData.players.forEach(p => {
          if (g.outcome[p] === 'Busted!') return;
          const ptot = calculateHandValue(g.hands[p]);
          let msg='', bal=g.balances[p];
          if (dealerTot > 21 || ptot > dealerTot) { msg='Win!';  bal += g.bets[p]*2; }
          else if (ptot === dealerTot)            { msg='Push'; bal += g.bets[p];    }
          else                                    { msg='Lose'; }
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
      const g   = (await tx.get(ref)).data();
      const idx = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw new Error('Not your turn');

      g.currentIdx++;

      /* -------- dealer / settle if last player -------- */
      if (g.currentIdx >= lobbyData.players.length) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17) g.dealerHand.push(g.deck.pop());

        const dealerTot = calculateHandValue(g.dealerHand);
        lobbyData.players.forEach(p => {
          if (g.outcome[p] === 'Busted!') return;
          const ptot = calculateHandValue(g.hands[p]);
          let msg='', bal=g.balances[p];
          if (dealerTot > 21 || ptot > dealerTot) { msg='Win!';  bal += g.bets[p]*2; }
          else if (ptot === dealerTot)            { msg='Push'; bal += g.bets[p];    }
          else                                    { msg='Lose'; }
          g.outcome[p] = msg; g.balances[p] = bal;
        });
        g.roundFinished = true;
      }
      tx.update(ref, g);
    });
  };

  /* -------------------- Double (multiplayer) ---------------------- */
  const txDouble = async () => {
    const ref = doc(db, 'lobbies', lobbyId, 'game', 'state');
    await runTransaction(db, async tx => {
      const g   = (await tx.get(ref)).data();
      const idx = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw new Error('Not your turn');

      /* eligibility checks */
      if ((g.hands[uid] ?? []).length !== 2) throw new Error('Can only double on first action');
      if (g.balances[uid] < g.bets[uid])      throw new Error('Insufficient balance');

      /* perform double */
      g.balances[uid] -= g.bets[uid];
      g.bets[uid]     *= 2;
      g.hands[uid].push(g.deck.pop());

      const tot = calculateHandValue(g.hands[uid]);
      if (tot > 21) g.outcome[uid] = 'Busted!';

      g.currentIdx++;          // player automatically stands after doubling

      /* dealer / settle if last player */
      if (g.currentIdx >= lobbyData.players.length) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17) g.dealerHand.push(g.deck.pop());

        const dealerTot = calculateHandValue(g.dealerHand);
        lobbyData.players.forEach(p => {
          if (g.outcome[p] === 'Busted!') return;
          const ptot = calculateHandValue(g.hands[p]);
          let msg='', bal=g.balances[p];
          if (dealerTot > 21 || ptot > dealerTot) { msg='Win!';  bal += g.bets[p]*2; }
          else if (ptot === dealerTot)            { msg='Push'; bal += g.bets[p];    }
          else                                    { msg='Lose'; }
          g.outcome[p] = msg; g.balances[p] = bal;
        });
        g.roundFinished = true;
      }
      tx.update(ref, g);
    });
  };

  /* ----------------------- full leave ----------------------------- */
  const backToMenu = async () => {
    try { if (mode === 'multi' && lobbyId) await leaveLobby(db, lobbyId, uid); }
    catch (err) { console.error(err); }
    finally {
      setMode('menu'); resetRound();
      setBalance(100); setBet(0); setGameOver(false); setLobbyInput('');
    }
  };

  /* ============================= UI =============================== */
  if (!readyScrn) {
    return (
      <UsernameInput
        username={username}
        setUsername={setUsername}
        onReady={() => setReadyScrn(true)}
      />
    );
  }

  /* ------------------------------- MENU --------------------------- */
  if (mode === 'menu') {
    return (
      <div className="table-container">
        <h1 className="title-banner">Blackjack</h1>

        <div className="menu-row">
          {/* ---------- MENU BLOCK ---------- */}
          <div className="menu-screen-wrapper">
            <div className="menu-block">
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
                value={lobbyInput}
                onChange={e => setLobbyInput(e.target.value)}
                placeholder="Enter Lobby ID"
              />
            </div>

            {/* ---------- LEADERBOARD BLOCK ---------- */}
            <Leaderboard />
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------- SINGLE‑PLAYER ----------------------- */
  if (mode === 'single') {
    return (
      <SinglePlayerGame
        onBack={backToMenu}
        username={username}
        balance={balance}
        bet={bet}
        dealerHand={dealerHand}
        playerHand={playerHand}
        playerMessage={playerMsg}
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

  /* ------------------------- MULTI‑PLAYER ------------------------ */
  return (
    <MultiPlayerGame
      onBack={backToMenu}
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
      handleDouble={txDouble}
      hostNewRound={hostNewRound}
    />
  );
}
