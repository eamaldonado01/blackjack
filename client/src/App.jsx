import React, { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';

import useLobby from './hooks/useLobby';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame from './MultiPlayerGame';
import UsernameInput from './components/UsernameInput';

import {
  createDeck,
  shuffleDeck,
  calculateHandValue
} from './utils/GameHelpers';

import { db } from './firebase';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';

import './styles.css';

const uid = nanoid(8);

export default function App() {
  const [username, setUsername] = useState('');
  const [readyScreen, setReadyScreen] = useState(false);
  const [mode, setMode] = useState('menu');

  const [balance, setBalance] = useState(100);
  const [bet, setBet] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [playerMessage, setPlayerMessage] = useState('');
  const [canDouble, setCanDouble] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [lobbyInput, setLobbyInput] = useState('');

  const {
    lobbyId,
    lobbyData,
    createLobby,
    joinLobby,
    setReady: setLobbyReady
  } = useLobby(username, uid);

  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    if (!lobbyId || lobbyData?.status !== 'playing') {
      setGameState(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'lobbies', lobbyId, 'game', 'state'), snap =>
      setGameState(snap.data())
    );
    return () => unsub();
  }, [lobbyId, lobbyData?.status]);

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
    while (calculateHandValue(dealer, true) < 17) dealer.push(dck.pop());
    return dealer;
  };

  const handleHitSingle = () => {
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setDeck(newDeck);
    setPlayerHand(newHand);
    const total = calculateHandValue(newHand);
    if (total > 21) {
      setPlayerMessage(`Busted!`);
      setShowActions(false);
      setRoundFinished(true);
      if (balance === 0) setGameOver(true);
    }
  };

  const handleStandSingle = () => {
    const newDeck = [...deck];
    const dealer = playDealer(newDeck, [...dealerHand]);
    setDeck(newDeck);
    setDealerHand(dealer);
    const p = calculateHandValue(playerHand);
    const d = calculateHandValue(dealer);
    if (d > 21 || p > d) {
      const nb = balance + bet * 2;
      setBalance(nb);
      setPlayerMessage('Win!');
    } else if (d === p) {
      const nb = balance + bet;
      setBalance(nb);
      setPlayerMessage('Push — bet returned.');
    } else {
      setPlayerMessage('Dealer wins.');
      if (balance === 0) setGameOver(true);
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

  const handleDeal = async () => {
    if (bet === 0) return;
    if (mode === 'single') {
      const newDeck = shuffleDeck(createDeck());
      const player = [newDeck.pop(), newDeck.pop()];
      const dealer = [newDeck.pop(), newDeck.pop()];
      setDeck(newDeck);
      setPlayerHand(player);
      setDealerHand(dealer);
      setShowActions(true);
      setCanDouble(true);
      const player21 = calculateHandValue(player) === 21;
      const dealer21 = calculateHandValue(dealer) === 21;
      if (player21) {
        setShowActions(false);
        setRoundFinished(true);
        if (dealer21) {
          setBalance(b => b + bet);
          setPlayerMessage('Push — both blackjack');
        } else {
          setBalance(b => b + bet * 2.5);
          setPlayerMessage('Blackjack! You win!');
        }
      }
    } else {
      await setLobbyReady(true, bet);
    }
  };

  const handleAddChipBet = v => {
    if (!showActions && balance >= v) {
      setBet(b => b + v);
      setBalance(b => b - v);
    }
  };

  const handleClearBet = async () => {
    if (showActions) return;
    setBalance(b => b + bet);
    setBet(0);
    if (mode === 'multi' && lobbyData?.status === 'waiting') await setLobbyReady(false, 0);
  };

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

  const allReady =
    lobbyData?.players?.length > 0 &&
    Object.values(lobbyData.ready || {}).every(Boolean);

  const hostStartGame = async () => {
    if (uid !== lobbyData.host || !allReady) return;
    const deck = shuffleDeck(createDeck());
    const hands = {};
    const balances = {};
    const bets = lobbyData.bets;
    let currentIdx = 0;
    lobbyData.players.forEach((p, i) => {
      const h = [deck.pop(), deck.pop()];
      hands[p] = h;
      const bal = 100 - bets[p];
      balances[p] = bal;
      if (calculateHandValue(h) === 21) {
        currentIdx++;
      }
    });
    await setDoc(doc(db, 'lobbies', lobbyId, 'game', 'state'), {
      deck,
      hands,
      dealerHand: [deck.pop(), { rank: 'Hidden', suit: 'Hidden' }],
      bets,
      balances,
      currentIdx,
      roundFinished: false,
      outcome: {}
    });
    await updateDoc(doc(db, 'lobbies', lobbyId), { status: 'playing' });
  };

  const txHit = async () => {
    const ref = doc(db, 'lobbies', lobbyId, 'game', 'state');
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const g = snap.data();
      const idx = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw '';
      g.hands[uid].push(g.deck.pop());
      const tot = calculateHandValue(g.hands[uid]);
      if (tot > 21) {
        g.outcome[uid] = 'Busted!';
        g.currentIdx++;
      }
      tx.update(ref, g);
    });
  };

  const txStand = async () => {
    const ref = doc(db, 'lobbies', lobbyId, 'game', 'state');
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const g = snap.data();
      const idx = lobbyData.players.indexOf(uid);
      if (g.currentIdx !== idx) throw '';
      g.currentIdx++;
      if (g.currentIdx >= lobbyData.players.length) {
        if (g.dealerHand[1].rank === 'Hidden') g.dealerHand[1] = g.deck.pop();
        while (calculateHandValue(g.dealerHand, true) < 17)
          g.dealerHand.push(g.deck.pop());
        const dealerTot = calculateHandValue(g.dealerHand);
        lobbyData.players.forEach(p => {
          if (g.outcome[p]) return;
          const tot = calculateHandValue(g.hands[p]);
          let msg = '';
          let bal = g.balances[p];
          if (dealerTot > 21 || tot > dealerTot) {
            msg = 'Win!';
            bal += g.bets[p] * 2;
          } else if (tot === dealerTot) {
            msg = 'Push';
            bal += g.bets[p];
          } else {
            msg = 'Lose';
          }
          g.outcome[p] = msg;
          g.balances[p] = bal;
        });
        g.roundFinished = true;
      }
      tx.update(ref, g);
    }).then(() => {
      const newBal = gameState?.balances?.[uid];
      if (newBal !== undefined) setBalance(newBal);
    });
  };

  const hostNewRound = async () => {
    if (uid !== lobbyData.host) return;
    const ready = {};
    const bets = {};
    lobbyData.players.forEach(p => {
      ready[p] = false;
      bets[p] = 0;
    });
    await updateDoc(doc(db, 'lobbies', lobbyId), {
      status: 'waiting',
      ready,
      bets
    });
    await deleteDoc(doc(db, 'lobbies', lobbyId, 'game', 'state'));
  };

  const handleBackToMenu = () => {
    setMode('menu');
    resetRound();
    setBalance(100);
    setLobbyInput('');
  };

  return !readyScreen ? (
    <UsernameInput
      username={username}
      setUsername={setUsername}
      onReady={() => setReadyScreen(true)}
    />
  ) : mode === 'menu' ? (
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
          onChange={e => setLobbyInput(e.target.value)}
        />
        <button className="common-button" onClick={handleJoinLobby}>
          Join Existing Lobby
        </button>
      </div>
    </div>
  ) : mode === 'single' ? (
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
      roundFinished={roundFinished}
      gameOver={gameOver}
      handleHit={handleHitSingle}
      handleStand={handleStandSingle}
      handleDouble={handleDoubleSingle}
      handleClearBet={handleClearBet}
      handleDeal={handleDeal}
      handleAddChipBet={handleAddChipBet}
      handleNewRound={resetRound}
    />
  ) : (
    <MultiPlayerGame
      onBack={handleBackToMenu}
      uid={uid}
      lobbyData={lobbyData}
      lobbyId={lobbyId}
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
