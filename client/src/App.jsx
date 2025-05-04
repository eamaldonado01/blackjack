import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';

import useLobby from './hooks/useLobby';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame  from './MultiPlayerGame';
import UsernameInput    from './components/UsernameInput';

import {
  createDeck, shuffleDeck, calculateHandValue
} from './utils/GameHelpers';

import {
  db
} from './firebase';
import {
  doc, setDoc, updateDoc, onSnapshot, runTransaction
} from 'firebase/firestore';

import './styles.css';

/* TEMP – replace with firebase/auth uid in production */
const uid = nanoid(8);

export default function App() {
  /* -------------------------------- GLOBAL -------------------------- */
  const [username, setUsername] = useState('');
  const [readyScreen, setReadyScreen] = useState(false);     // reached menu?
  const [mode, setMode] = useState('menu');                  // menu | single | multi

  /* -------------------- single‑player local state ------------------- */
  const [balance, setBalance]           = useState(100);
  const [bet,     setBet]               = useState(0);
  const [dealerHand, setDealerHand]     = useState([]);
  const [playerHand, setPlayerHand]     = useState([]);
  const [deck, setDeck]                 = useState([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [canDouble, setCanDouble]       = useState(false);
  const [showActions, setShowActions]   = useState(false);
  const [gameOver, setGameOver]         = useState(false);
  const [roundFinished, setRoundFinished]=useState(false);

  /* -------------------- lobby & game (multiplayer) ------------------ */
  const [lobbyInput, setLobbyInput]     = useState('');

  const {
    lobbyId, lobbyData, joined: lobbyJoined,
    createLobby, joinLobby, setReady: setLobbyReady
  } = useLobby(username, uid);

  const [gameState, setGameState]       = useState(null); // /game/state snapshot

  /* subscribe to /game/state when lobby switches to 'playing' */
  useEffect(()=>{
    if (!lobbyId || lobbyData?.status !== 'playing') { setGameState(null); return; }
    const ref  = doc(db,'lobbies',lobbyId,'game','state');
    const unsub = onSnapshot(ref, snap=> setGameState(snap.data()));
    return () => unsub();
  },[lobbyId, lobbyData?.status]);

  /* ------------------------------------------------------------------
   *  LOCAL HELPERS (single player)
   * ----------------------------------------------------------------*/
  const resetRound = () => {
    setDealerHand([]);
    setPlayerHand([]);
    setPlayerMessage('');
    setCanDouble(false);
    setShowActions(false);
    setBet(0);
    setRoundFinished(false);
  };

  /* ------------------------------------------------------------------
   *  CHIP / BETTING
   * ----------------------------------------------------------------*/
  const handleAddChipBet = (chipValue) => {
    if (!showActions && balance >= chipValue) {
      setBet(v => v + chipValue);
      setBalance(v => v - chipValue);
    }
  };

  const handleClearBet = async () => {
    if (showActions) return;
    setBalance(v => v + bet);
    setBet(0);
    if (mode === 'multi' && lobbyData?.status === 'waiting') {
      await setLobbyReady(false, 0);
    }
  };

  /* ------------------------------------------------------------------
   *  DEAL (single or sets ready in MP)
   * ----------------------------------------------------------------*/
  const handleDeal = async () => {
    if (bet === 0) return;
    if (mode === 'single') {
      /* single‑player keeps existing logic */
      const newDeck = shuffleDeck(createDeck());
      const player  = [newDeck.pop(), newDeck.pop()];
      const dealer  = [newDeck.pop(), newDeck.pop()];

      setDeck(newDeck);
      setPlayerHand(player);
      setDealerHand(dealer);
      setShowActions(true);
      setCanDouble(true);

      const total = calculateHandValue(player);
      if (total === 21) {
        const winnings   = bet * 2.5;
        const newBalance = balance + winnings;
        setBalance(newBalance);
        setPlayerMessage('Blackjack! You win!');
        setShowActions(false);
        setRoundFinished(true);
        if (newBalance <= 0) setGameOver(true);
      }
    } else {
      /* multiplayer → just mark ready + bet in lobby doc */
      await setLobbyReady(true, bet);
    }
  };

  /* ------------------------------------------------------------------
   *  CREATE / JOIN LOBBY
   * ----------------------------------------------------------------*/
  const handleCreateLobby = async () => {
    await createLobby();
    setMode('multi');
  };

  const handleJoinLobby = async () => {
    if (lobbyInput.trim()) {
      await joinLobby(lobbyInput);
      setMode('multi');
    }
  };

  /* ------------------------------------------------------------------
   *  HOST: START GAME (after everyone ready)
   * ----------------------------------------------------------------*/
  const allReady =
  lobbyData?.players?.length > 0 &&
  lobbyData?.ready &&
  Object.values(lobbyData.ready).every(Boolean);

  const hostStartGame = async () => {
    if (uid !== lobbyData.host || !allReady) return;

    const deck   = shuffleDeck(createDeck());
    const hands  = {};
    lobbyData.players.forEach(p => {
      hands[p] = [deck.pop(), deck.pop()];
    });
    const dealerHand = [deck.pop(), { rank:'Hidden', suit:'Hidden' }];

    const gameRef = doc(db,'lobbies',lobbyId,'game','state');
    await setDoc(gameRef,{
      deck,
      hands,
      dealerHand,
      bets: lobbyData.bets,
      balances: lobbyData.players.reduce((o,p)=>{
        o[p] = 100 - lobbyData.bets[p];
        return o;
      },{}),
      currentIdx: 0,                  // right‑most player (joined first)
      roundFinished:false,
      outcome:{},
    });
    await updateDoc(doc(db,'lobbies',lobbyId),{ status:'playing' });
  };

  /* ------------------------------------------------------------------
   *  MULTIPLAYER ACTIONS (hit/stand via transaction)
   * ----------------------------------------------------------------*/
  const txHit = async () => {
    const gameRef = doc(db,'lobbies',lobbyId,'game','state');
    await runTransaction(db, async (tx)=>{
      const snap  = await tx.get(gameRef);
      const game  = snap.data();
      const myIdx = lobbyData.players.indexOf(uid);
      if (game.currentIdx !== myIdx) throw 'Not your turn';

      const card = game.deck.pop();
      game.hands[uid].push(card);

      const total = calculateHandValue(game.hands[uid]);
      if (total > 21) {
        game.outcome[uid] = `Busted (${total})`;
        game.currentIdx ++;            // next player
      }

      tx.update(gameRef, game);
    });
  };

  const txStand = async () => {
    const gameRef = doc(db,'lobbies',lobbyId,'game','state');
    await runTransaction(db, async (tx)=>{
      const snap  = await tx.get(gameRef);
      const game  = snap.data();
      const myIdx = lobbyData.players.indexOf(uid);
      if (game.currentIdx !== myIdx) throw 'Not your turn';

      game.currentIdx ++;              // next player
      tx.update(gameRef, game);
    });
  };

  /* ------------------------------------------------------------------
   *  NAVIGATION
   * ----------------------------------------------------------------*/
  const handleBackToMenu = () => {
    setMode('menu');
    resetRound();
    setBalance(100);
    setLobbyInput('');
  };

  /* ------------------------------------------------------------------
   *  RENDER
   * ----------------------------------------------------------------*/
  if (!readyScreen) {
    return (
      <div className="background">
        <UsernameInput
          username={username}
          setUsername={setUsername}
          onReady={() => setReadyScreen(true)}
        />
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="table-container background">
        <h1 className="title-banner">Blackjack</h1>
        <div className="join-container background">
          <h2>Welcome, {username}!</h2>

          <p>Play Singleplayer</p>
          <button className="common-button" onClick={() => setMode('single')}>
            Single Player
          </button>

          <p className="section-spacing">Play Multiplayer</p>
          <button className="common-button" onClick={handleCreateLobby}>
            Create New Lobby
          </button>

          <input
            type="text"
            placeholder="Enter Lobby ID"
            value={lobbyInput}
            onChange={(e) => setLobbyInput(e.target.value)}
          />
          <button className="common-button" onClick={handleJoinLobby}>
            Join Existing Lobby
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'single') {
    return (
      <SinglePlayerGame
        onBack={handleBackToMenu}
        username={username}
        balance={balance}
        bet={bet}
        dealerHand={dealerHand}
        playerHand={playerHand}
        playerMessage={playerMessage}
        canDouble={canDouble}
        showActions={showActions}
        handleHit={() => { setShowActions(false); /* not needed here */}}
        handleStand={() => {}}
        handleDouble={() => {}}
        handleClearBet={handleClearBet}
        handleDeal={handleDeal}
        handleAddChipBet={handleAddChipBet}
        handleNewRound={resetRound}
        gameOver={gameOver}
        roundFinished={roundFinished}
      />
    );
  }

  /* -------------------------- MULTIPLAYER --------------------------- */
  return (
    <MultiPlayerGame
      /* nav + lobby */
      onBack={handleBackToMenu}
      uid={uid}
      lobbyData={lobbyData}
      lobbyId={lobbyId}

      /* waiting/playing state */
      gameState={gameState}
      allReady={allReady}
      hostStartGame={hostStartGame}

      /* betting */
      bet={bet}
      balance={balance}
      handleAddChipBet={handleAddChipBet}
      handleClearBet={handleClearBet}
      handleDeal={handleDeal}

      /* in‑game actions */
      handleHit={txHit}
      handleStand={txStand}
    />
  );
}
