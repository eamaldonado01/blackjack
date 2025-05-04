import React, { useState } from 'react';
import SinglePlayerGame from './SinglePlayerGame';
import MultiPlayerGame from './MultiPlayerGame';
import UsernameInput from './components/UsernameInput';
import ModeSelector from './components/ModeSelector';
import { createDeck, shuffleDeck, calculateHandValue } from './utils/GameHelpers';
import './styles.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('menu');

  const [balance, setBalance] = useState(100);
  const [bet, setBet] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [dealerMessage, setDealerMessage] = useState('');
  const [playerMessage, setPlayerMessage] = useState('');
  const [canDouble, setCanDouble] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);
  const [lobbyJoined, setLobbyJoined] = useState(false);
  const [lobbyId, setLobbyId] = useState('');

  const resetRound = () => {
    setDealerHand([]);
    setPlayerHand([]);
    setDealerMessage('');
    setPlayerMessage('');
    setCanDouble(false);
    setShowActions(false);
    setBet(0);
    setRoundFinished(false);
  };

  const handleAddChipBet = (chipValue) => {
    if (!showActions && balance >= chipValue) {
      setBet(prev => prev + chipValue);
      setBalance(prev => prev - chipValue);
    }
  };

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
      setPlayerMessage('Blackjack! You win!');
      setBalance(prev => prev + bet * 2.5);
      setShowActions(false);
      setRoundFinished(true);
      if (balance + bet * 2.5 <= 0) setGameOver(true);
    } else {
      setPlayerMessage(`Your total: ${playerTotal}`);
      setDealerMessage(`Dealer shows: ${dealer[0].rank} of ${dealer[0].suit}`);
    }
  };

  const handleHit = () => {
    const newHand = [...playerHand, deck.pop()];
    setPlayerHand(newHand);
    setDeck(deck);

    const total = calculateHandValue(newHand);
    if (total > 21) {
      setPlayerMessage(`Busted with ${total}!`);
      setShowActions(false);
      setRoundFinished(true);
      if (balance <= 0) setGameOver(true);
    } else {
      setPlayerMessage(`Your total: ${total}`);
    }
  };

  const handleStand = () => {
    let dealerTotal = calculateHandValue(dealerHand);
    let newDeck = [...deck];
    let newDealerHand = [...dealerHand];

    while (dealerTotal < 17) {
      newDealerHand.push(newDeck.pop());
      dealerTotal = calculateHandValue(newDealerHand);
    }

    setDealerHand(newDealerHand);
    setDeck(newDeck);

    const playerTotal = calculateHandValue(playerHand);
    let result = '';

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      result = 'You win!';
      setBalance(prev => prev + bet * 2);
    } else if (dealerTotal === playerTotal) {
      result = 'Push (tie).';
      setBalance(prev => prev + bet);
    } else {
      result = 'Dealer wins.';
    }

    setDealerMessage(`Dealer total: ${dealerTotal}`);
    setPlayerMessage(result);
    setShowActions(false);
    setRoundFinished(true);
    if (balance <= 0) setGameOver(true);
  };

  const handleDouble = () => {
    if (balance < bet) {
      setPlayerMessage('Not enough balance to double.');
      return;
    }
    setBalance(prev => prev - bet);
    setBet(prev => prev * 2);
    handleHit();
    handleStand();
  };

  const handleClearBet = () => {
    setBalance(prev => prev + bet);
    setBet(0);
  };

  const handleNewRound = () => {
    if (balance <= 0) {
      setGameOver(true);
    } else {
      resetRound();
    }
  };

  const handleBackToMenu = () => {
    setMode('menu');
    resetRound();
    setBalance(100);
    setLobbyId('');
  };

  const handleCreateLobby = () => {
    setLobbyJoined(true);
  };

  const handleJoinLobby = () => {
    if (lobbyId.trim() !== '') {
      setLobbyJoined(true);
    }
  };

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
      lobbyJoined={lobbyJoined}
    />
  );
}
