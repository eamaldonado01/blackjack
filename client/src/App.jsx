import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';

import useLobby from './hooks/useLobby';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame  from './MultiPlayerGame';
import UsernameInput    from './components/UsernameInput';

import {
  createDeck, shuffleDeck, calculateHandValue
} from './utils/GameHelpers';

import { db } from './firebase';
import {
  doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction
} from 'firebase/firestore';

import './styles.css';

/* TEMP – replace with firebase/auth uid in production */
const uid = nanoid(8);

export default function App() {
  /* ------------- GLOBAL ------------------------------------------- */
  const [username, setUsername] = useState('');
  const [readyScreen, setReadyScreen] = useState(false);
  const [mode, setMode] = useState('menu');      // menu | single | multi

  /* ------------- SINGLE‑PLAYER STATE ------------------------------ */
  const [balance, setBalance]       = useState(100);
  const [bet,     setBet]           = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [deck, setDeck]             = useState([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [canDouble, setCanDouble]   = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [gameOver, setGameOver]     = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);

  /* ------------- MULTIPLAYER STATE -------------------------------- */
  const [lobbyInput, setLobbyInput] = useState('');

  const {
    lobbyId, lobbyData, joined: lobbyJoined,
    createLobby, joinLobby, setReady: setLobbyReady
  } = useLobby(username, uid);

  const [gameState, setGameState] = useState(null); // /game/state live snapshot

  /* subscribe to game doc when lobby is “playing” */
  useEffect(()=>{
    if (!lobbyId || lobbyData?.status !== 'playing') { setGameState(null); return; }
    const ref = doc(db,'lobbies',lobbyId,'game','state');
    const unsub = onSnapshot(ref, snap => setGameState(snap.data()));
    return () => unsub();
  },[lobbyId, lobbyData?.status]);

  /* ================================================================
   * SINGLE‑PLAYER HELPERS
   * ==============================================================*/
  const resetRound = () => {
    setDealerHand([]);
    setPlayerHand([]);
    setPlayerMessage('');
    setCanDouble(false);
    setShowActions(false);
    setBet(0);
    setRoundFinished(false);
  };

  const playDealer = (dck, dealer) => {
    while (calculateHandValue(dealer, true) < 17) {
      dealer.push(dck.pop());
    }
    return dealer;
  };

  const handleHitSingle = () => {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setDeck(newDeck);
    setPlayerHand(newHand);

    const total = calculateHandValue(newHand);
    if (total > 21) {
      setPlayerMessage(`Busted (${total}) — you lose!`);
      setShowActions(false);
      setRoundFinished(true);
    }
  };

  const handleStandSingle = () => {
    const newDeck = [...deck];
    const dealer  = playDealer(newDeck, [...dealerHand]);
    setDeck(newDeck);
    setDealerHand(dealer);

    const playerTot = calculateHandValue(playerHand);
    const dealerTot = calculateHandValue(dealer);

    if (dealerTot > 21 || playerTot > dealerTot) {
      setBalance(b => b + bet * 2);
      setPlayerMessage('You win!');
    } else if (dealerTot === playerTot) {
      setBalance(b => b + bet);
      setPlayerMessage('Push — bet returned.');
    } else {
      setPlayerMessage('Dealer wins.');
    }
    setShowActions(false);
    setRoundFinished(true);
  };

  const handleDoubleSingle = () => {
    if (balance < bet) return;
    setBalance(b => b - bet);
    setBet(bet * 2);
    handleHitSingle();
    if (!roundFinished) handleStandSingle();
  };

  /* ================================================================
   * CHIP / BET (shared)
   * ==============================================================*/
  const handleAddChipBet = (chipValue) => {
    if (!showActions && balance >= chipValue) {
      setBet(v => v + chipValue);
      setBalance(v => v - chipValue);
    }
  };

  const handleClearBet = async () => {
    if (showActions) return;
    setBalance(b => b + bet);
    setBet(0);
    if (mode === 'multi' && lobbyData?.status === 'waiting') {
      await setLobbyReady(false, 0);
    }
  };

  /* ================================================================
   * DEAL
   * ==============================================================*/
  const handleDeal = async () => {
    if (bet === 0) return;
    if (mode === 'single') {
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
        const winnings = bet * 2.5;
        setBalance(b => b + winnings);
        setPlayerMessage('Blackjack! You win!');
        setShowActions(false);
        setRoundFinished(true);
      }
    } else {
      await setLobbyReady(true, bet);
    }
  };

  /* ================================================================
   * LOBBY CREATION / JOIN
   * ==============================================================*/
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

  /* ================================================================
   * HOST START GAME  (all ready)
   * ==============================================================*/
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
      currentIdx: 0,
      roundFinished:false,
      outcome:{},
    });
    await updateDoc(doc(db,'lobbies',lobbyId),{ status:'playing' });
  };

  /* ================================================================
   * MP in‑game Hit / Stand (transactions)
   * ==============================================================*/
  const txHit = async () => {
    const gameRef = doc(db,'lobbies',lobbyId,'game','state');
    await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      const game = snap.data();
      const myIdx = lobbyData.players.indexOf(uid);
      if (game.currentIdx !== myIdx) throw 'Not your turn';

      const card = game.deck.pop();
      game.hands[uid].push(card);

      const total = calculateHandValue(game.hands[uid]);
      if (total > 21) {
        game.outcome[uid] = `Busted (${total})`;
        game.currentIdx ++;
      }
      tx.update(gameRef, game);
    });
  };

  const txStand = async () => {
    const gameRef = doc(db,'lobbies',lobbyId,'game','state');
    await runTransaction(db, async tx => {
      const snap = await tx.get(gameRef);
      const game = snap.data();
      const myIdx = lobbyData.players.indexOf(uid);
      if (game.currentIdx !== myIdx) throw 'Not your turn';

      game.currentIdx ++;

      /* everyone finished? */
      if (game.currentIdx >= lobbyData.players.length) {
        const dealer = game.dealerHand;
        if (dealer[1].rank === 'Hidden') dealer[1] = game.deck.pop();
        while (calculateHandValue(dealer, true) < 17) {
          dealer.push(game.deck.pop());
        }
        game.dealerHand = dealer;
        game.roundFinished = true;
      }
      tx.update(gameRef, game);
    });
  };

  /* ================================================================
   * HOST NEW ROUND
   * ==============================================================*/
  const hostNewRound = async () => {
    if (uid !== lobbyData.host) return;
    const lobbyRef = doc(db,'lobbies',lobbyId);

    const ready = {}, bets = {};
    lobbyData.players.forEach(p => { ready[p] = false; bets[p] = 0; });

    await updateDoc(lobbyRef, { status:'waiting', ready, bets });
    await deleteDoc(doc(db,'lobbies',lobbyId,'game','state'));
  };

  /* ================================================================
   * NAV
   * ==============================================================*/
  const handleBackToMenu = () => {
    setMode('menu');
    resetRound();
    setBalance(100);
    setLobbyInput('');
  };

  /* ================================================================
   * RENDER
   * ==============================================================*/
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
        handleHit={handleHitSingle}
        handleStand={handleStandSingle}
        handleDouble={handleDoubleSingle}
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
      onBack={handleBackToMenu}
      uid={uid}
      lobbyData={lobbyData}
      lobbyId={lobbyId}

      balance={balance}
      bet={bet}

      /* lobby waiting */
      allReady={allReady}
      hostStartGame={hostStartGame}

      /* betting */
      handleAddChipBet={handleAddChipBet}
      handleClearBet={handleClearBet}
      handleDeal={handleDeal}

      /* gameplay */
      gameState={gameState}
      handleHit={txHit}
      handleStand={txStand}
      hostNewRound={hostNewRound}
    />
  );
}
