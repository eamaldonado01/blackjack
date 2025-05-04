import React, { useState } from 'react';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame from './MultiPlayerGame';
import UsernameInput from './components/UsernameInput';
import { createDeck, shuffleDeck, calculateHandValue } from './utils/GameHelpers';
import './styles.css';

export default function App() {
  /* --------------------------------------------------
   *  GLOBAL STATE
   * ------------------------------------------------*/
  const [username, setUsername] = useState('');
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('menu'); // menu | single | multi

  // single‑/multiplayer shared state
  const [balance, setBalance] = useState(100);
  const [bet, setBet] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [dealerMessage, setDealerMessage] = useState('');
  const [playerMessage, setPlayerMessage] = useState('');
  const [canDouble, setCanDouble] = useState(false);
  const [showActions, setShowActions] = useState(false); // whether HIT / STAND buttons are enabled for *this* client
  const [gameOver, setGameOver] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);

  // lightweight MP lobby fields (stub — real socket.io integration should replace this)
  const [lobbyJoined, setLobbyJoined] = useState(false);
  const [lobbyId, setLobbyId] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(true); // in MP only the active player has controls

  /* --------------------------------------------------
   *  HELPER—RESET STATE FOR A FRESH HAND
   * ------------------------------------------------*/
  const resetRound = () => {
    setDealerHand([]);
    setPlayerHand([]);
    setDealerMessage('');
    setPlayerMessage('');
    setCanDouble(false);
    setShowActions(false);
    setBet(0);
    setRoundFinished(false);
    setIsMyTurn(true); // give turn back to this client by default (single‑player behaviour)
  };

  /* --------------------------------------------------
   *  CHIP / BETTING
   * ------------------------------------------------*/
  const handleAddChipBet = (chipValue) => {
    if (!showActions && balance >= chipValue) {
      setBet((prev) => prev + chipValue);
      setBalance((prev) => prev - chipValue);
    }
  };

  const handleClearBet = () => {
    if (!showActions) {
      setBalance((prev) => prev + bet);
      setBet(0);
    }
  };

  /* --------------------------------------------------
   *  DEAL FIRST TWO CARDS
   * ------------------------------------------------*/
  const handleDeal = () => {
    if (bet <= 0) {
      setPlayerMessage('Place a bet first.');
      return;
    }

    const newDeck = shuffleDeck(createDeck());
    const player = [newDeck.pop(), newDeck.pop()];
    const dealer = [newDeck.pop(), newDeck.pop()];

    setDeck(newDeck);
    setPlayerHand(player);
    setDealerHand(dealer);
    setShowActions(true);
    setCanDouble(true);

    const playerTotal = calculateHandValue(player);
    if (playerTotal === 21) {
      // instant blackjack payout — 3:2 (≈2.5× bet including original)
      const winnings = bet * 2.5;
      const newBalance = balance + winnings;

      setBalance(newBalance);
      setPlayerMessage('Blackjack! You win!');
      setShowActions(false);
      setRoundFinished(true);
      if (newBalance <= 0) setGameOver(true);
    } else {
      setPlayerMessage('');     
    }
  };

  /* --------------------------------------------------
   *  HIT / STAND / DOUBLE (single‑player or *this* client’s turn)
   * ------------------------------------------------*/
  const applyBustCheck = (newBalance) => {
    if (newBalance <= 0) {
      setGameOver(true);
    }
  };

  const handleHit = () => {
    const newHand = [...playerHand, deck.pop()];
    setPlayerHand(newHand);
    setDeck([...deck]); // trigger re‑render

    const total = calculateHandValue(newHand);
    if (total > 21) {
      setPlayerMessage(`Busted with ${total}!`);
      setShowActions(false);
      setRoundFinished(true);
      applyBustCheck(balance);
    } 
  };

  const handleStand = () => {
    // ----- dealer plays out -----
    let dealerTotal = calculateHandValue(dealerHand);
    const newDeck = [...deck];
    const newDealer = [...dealerHand];

    while (dealerTotal < 17) {
      newDealer.push(newDeck.pop());
      dealerTotal = calculateHandValue(newDealer);
    }

    setDealerHand(newDealer);
    setDeck(newDeck);

    // ----- settle bets -----
    const playerTotal = calculateHandValue(playerHand);
    let result = '';
    let newBalance = balance;

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      result = 'You win!';
      newBalance += bet * 2;
    } else if (dealerTotal === playerTotal) {
      result = 'Push (tie).';
      newBalance += bet; // return original bet
    } else {
      result = 'Dealer wins.';
      // bet already deducted when placing chips, so nothing to add
    }

    setBalance(newBalance);

    setPlayerMessage(result);
    setShowActions(false);
    setRoundFinished(true);
    applyBustCheck(newBalance);
  };

  const handleDouble = () => {
    if (!showActions || bet === 0 || balance < bet) {
      setPlayerMessage('Cannot double right now.');
      return;
    }
    // take additional bet, double and play exactly one hit then stand
    setBalance((prev) => prev - bet);
    setBet((prev) => prev * 2);
    handleHit();
    if (!roundFinished) handleStand();
  };

  /* --------------------------------------------------
   *  NEW ROUND & NAVIGATION
   * ------------------------------------------------*/
  const handleNewRound = () => {
    // Always clear any lingering game‑over state first
    setGameOver(false);

    if (balance <= 0) {
      // player broke → immediate game‑over
      setGameOver(true);
      return;
    }
    resetRound();
  };

  const handleBackToMenu = () => {
    setMode('menu');
    setGameOver(false);
    resetRound();
    setBalance(100);
    setLobbyId('');
    setLobbyJoined(false);
  };

  /* --------------------------------------------------
   *  LIGHTWEIGHT LOBBY STUB (replace with socket.io)
   * ------------------------------------------------*/
  const handleCreateLobby = () => {
    setLobbyJoined(true);
    setMode('multi');
  };

  const handleJoinLobby = () => {
    if (lobbyId.trim()) {
      setLobbyJoined(true);
      setMode('multi');
    }
  };

  /* --------------------------------------------------
   *  RENDER SWITCHER
   * ------------------------------------------------*/
  if (!ready) {
    return (
      <div className="background">
        <UsernameInput
          username={username}
          setUsername={setUsername}
          onReady={() => setReady(true)}
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
            value={lobbyId}
            onChange={(e) => setLobbyId(e.target.value)}
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
        dealerMessage={dealerMessage}
        playerMessage={playerMessage}
        canDouble={canDouble}
        showActions={showActions}
        handleHit={handleHit}
        handleStand={handleStand}
        handleDouble={handleDouble}
        handleClearBet={handleClearBet}
        handleDeal={handleDeal}
        handleAddChipBet={handleAddChipBet}
        handleNewRound={handleNewRound}
        gameOver={gameOver}
        roundFinished={roundFinished}
      />
    );
  }

  // ────────────────────── MULTIPLAYER ──────────────────────
  return (
    <MultiPlayerGame
      onBack={handleBackToMenu}
      username={username}
      balance={balance}
      bet={bet}
      dealerHand={dealerHand}
      playerHand={playerHand}
      dealerMessage={dealerMessage}
      playerMessage={playerMessage}
      canDouble={canDouble}
      showActions={showActions && isMyTurn} // controls only display on this client’s turn
      handleHit={handleHit}
      handleStand={handleStand}
      handleDouble={handleDouble}
      handleClearBet={handleClearBet}
      handleDeal={handleDeal}
      handleAddChipBet={handleAddChipBet}
      handleNewRound={handleNewRound}
      gameOver={gameOver}
      roundFinished={roundFinished}
      lobbyJoined={lobbyJoined}
      isMyTurn={isMyTurn}
    />
  );
}
