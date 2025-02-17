import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './styles.css';

const SERVER_IP = '192.168.86.220:3001';
const DEBUG = true;

// Helper to load card images
function getCardImage(card) {
  if (!card || card.rank === 'Hidden') {
    return '/src/assets/playing_cards/card_back.png';
  }
  const rankMap = {
    A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack',
    10: '10', 9: '9', 8: '8', 7: '7',
    6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
  };
  const suitMap = {
    Spades: 'spades',
    Hearts: 'hearts',
    Clubs: 'clubs',
    Diamonds: 'diamonds',
  };
  const rankStr = rankMap[card.rank] || card.rank;
  const suitStr = suitMap[card.suit] || card.suit.toLowerCase();
  return `/src/assets/playing_cards/${rankStr}_of_${suitStr}.png`;
}

// Calculate the blackjack total for a given hand
function calculateHandTotal(cards = []) {
  let total = 0;
  let aceCount = 0;
  cards.forEach((card) => {
    if (!card || card.rank === 'Hidden') return;
    switch (card.rank) {
      case 'A':
      case 'Ace':
        aceCount++;
        total += 1;
        break;
      case 'K':
      case 'Q':
      case 'J':
      case 'King':
      case 'Queen':
      case 'Jack':
        total += 10;
        break;
      default:
        total += Number(card.rank) || 0;
        break;
    }
  });
  while (aceCount > 0 && total + 10 <= 21) {
    total += 10;
    aceCount--;
  }
  return total;
}

/**
 * Utility to preserve the old dealerMessage if the new server message
 * doesn't contain "Dealer shows:". So we don't overwrite the dealer text
 * once players start moving.
 */
function parseMessagesAndPreserveDealer(oldDealerMessage, incomingMessage) {
  if (!incomingMessage) return [oldDealerMessage, ''];
  let newDealerMsg = oldDealerMessage;
  let newPlayerMsg = incomingMessage;

  const idx = incomingMessage.indexOf('Dealer shows:');
  if (idx !== -1) {
    // If there's "Dealer shows:", split it out
    newDealerMsg = incomingMessage.substring(idx).trim();
    newPlayerMsg = incomingMessage.substring(0, idx).trim();
  }
  return [newDealerMsg, newPlayerMsg];
}

export default function App() {
  // Socket
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // Lobby states
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [host, setHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentTurnSeat, setCurrentTurnSeat] = useState(null);

  // Game states
  const [playerHandsBySeat, setPlayerHandsBySeat] = useState({});
  const [dealerHand, setDealerHand] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  // Dealer & player messages
  const [dealerMessage, setDealerMessage] = useState('');
  const [playerMessage, setPlayerMessage] = useState('');

  // Bets & balances
  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [splitOccurred, setSplitOccurred] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);

  // Round-end statuses, e.g. {0:'Won',1:'Bust'}
  const [playerStatuses, setPlayerStatuses] = useState({});

  // ===== Socket setup =====
  useEffect(() => {
    if (DEBUG) console.log('[App] connecting to', SERVER_IP);

    const newSocket = io(`http://${SERVER_IP}`, {
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      if (DEBUG) console.log('[App] socket connected:', newSocket.id);
    });
    newSocket.on('connect_error', (err) => {
      setConnected(false);
      console.error('[App] connect_error:', err);
    });
    newSocket.on('disconnect', () => {
      setConnected(false);
      if (DEBUG) console.log('[App] socket disconnected');
    });

    // tableState => partial data
    newSocket.on('tableState', (data) => {
      if (DEBUG) console.log('[App] tableState =>', data);
      setPlayers(data.players || []);

      let msg = data.message || '';
      msg = msg.replace('Round ended. All players have taken their turn.', 'Round ended');
      msg = msg.replace('All players have taken their turn.', 'Round ended');
      setPlayerMessage(msg);

      setGameStarted(!!data.gameStarted);
      setCurrentTurnSeat(data.currentTurnSeat ?? null);
    });

    // multiBlackjackUpdate => full game data
    newSocket.on('multiBlackjackUpdate', (data) => {
      if (DEBUG) console.log('[App] multiBlackjackUpdate =>', data);

      setPlayerHandsBySeat(data.playerHandsBySeat || {});
      setDealerHand(data.dealerHand || []);
      setGameOver(!!data.gameOver);

      if (data.playerStatuses) setPlayerStatuses(data.playerStatuses);
      if (data.balance !== undefined) setBalance(data.balance);
      if (data.gameOver) setCurrentBet(0);

      // [CHANGED] => Only update dealerMessage if "Dealer shows:" is present
      let incomingMsg = data.message || '';
      incomingMsg = incomingMsg.replace(
        'Round ended. All players have taken their turn.',
        'Round ended'
      );
      incomingMsg = incomingMsg.replace('All players have taken their turn.', 'Round ended');

      const [dMsg, pMsg] = parseMessagesAndPreserveDealer(dealerMessage, incomingMsg);
      setDealerMessage(dMsg);
      setPlayerMessage(pMsg);
    });

    // joinSuccess => seatIndex
    newSocket.on('joinSuccess', (data) => {
      if (DEBUG) console.log('[App] joinSuccess =>', data);
      setPlayers(data.players || []);
      setMySeatIndex(data.seatIndex);
      setHost(data.seatIndex === 0);
      setJoined(true);
      setGameStarted(data.gameStarted);
    });

    // joinError
    newSocket.on('joinError', (errMsg) => {
      alert(errMsg);
    });

    setSocket(newSocket);
    return () => {
      if (DEBUG) console.log('[App] cleanup');
      newSocket.disconnect();
    };
    // eslint-disable-next-line
  }, []);

  // If game ends => reset local bet
  useEffect(() => {
    if (gameOver) {
      setCurrentBet(0);
    }
  }, [gameOver]);

  // ===== Lobby logic =====
  function handleJoin() {
    if (!socket) {
      alert('Socket not connected');
      return;
    }
    if (!connected) {
      alert('Not connected to server');
      return;
    }
    if (!username) {
      alert('Please enter a username');
      return;
    }
    socket.emit('joinTable', { username });
  }

  function setReadyOnServer() {
    if (!socket) return;
    socket.emit('playerReady');
  }

  function handleHostStartGame() {
    if (!socket || !host) return;
    socket.emit('startGame');
  }

  // ===== Bets =====
  function handleAddChip(chipValue) {
    if (balance < chipValue) {
      alert('Not enough balance');
      return;
    }
    setBalance((b) => b - chipValue);
    setCurrentBet((b) => b + chipValue);
  }

  function handleClearBet() {
    setBalance((b) => b + currentBet);
    setCurrentBet(0);
  }

  async function handlePlaceBet() {
    if (currentBet <= 0) {
      alert('Please place a bet first.');
      return;
    }
    try {
      const resp = await fetch(`http://${SERVER_IP}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: currentBet }),
      });
      if (!resp.ok) throw new Error(`HTTP error: ${resp.status}`);
      const data = await resp.json();

      setGameOver(data.message?.includes('Blackjack!') || false);

      let inMsg = data.message || '';
      const idx = inMsg.indexOf('Dealer shows:');
      let dMsg = dealerMessage; // [CHANGED]
      let pMsg = inMsg;

      if (idx !== -1) {
        dMsg = inMsg.substring(idx).trim();
        pMsg = inMsg.substring(0, idx).trim();
      }
      setDealerMessage(dMsg);
      setPlayerMessage(pMsg);

      setPlayerHandsBySeat((old) => ({
        ...old,
        [mySeatIndex]: data.playerHand || [],
      }));
      setDealerHand(data.dealerHand || []);
      setBalance(data.balance ?? balance);

      setBetPlaced(true);
      setReadyOnServer();
    } catch (err) {
      console.error('Error placing bet =>', err);
    }
  }

  // ===== New Round =====
  async function handleNewRound() {
    if (!socket) return;
    try {
      const resp = await fetch(`http://${SERVER_IP}/resetRound`, { method: 'POST' });
      await resp.json();
      setDealerMessage('');
      setPlayerMessage('');
      setBetPlaced(false);
      setGameOver(false);
      setSplitOccurred(false);
      setCurrentBet(0);
      setDealerHand([]);
      setPlayerHandsBySeat({});
      setPlayerStatuses({});
    } catch (err) {
      console.error('Error handleNewRound =>', err);
    }
  }

  // ===== Player actions =====
  async function handleHit() {
    if (!socket) return;
    try {
      const resp = await fetch(`http://${SERVER_IP}/hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatIndex: mySeatIndex, handIndex: 0 }),
      });
      const data = await resp.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setGameOver(data.gameOver || false);

      // [CHANGED] Preserve old dealerMessage if no "Dealer shows:"
      let [dMsg, pMsg] = parseMessagesAndPreserveDealer(dealerMessage, data.message || '');
      setDealerMessage(dMsg);
      setPlayerMessage(pMsg);

      if (data.playerHands) {
        setPlayerHandsBySeat((ps) => ({
          ...ps,
          [mySeatIndex]: data.playerHands[0] || [],
        }));
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);
      if (data.balance !== undefined) setBalance(data.balance);
    } catch (err) {
      console.error('Error handleHit =>', err);
    }
  }

  async function handleStand() {
    if (!socket) return;
    try {
      const resp = await fetch(`http://${SERVER_IP}/stand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatIndex: mySeatIndex }),
      });
      const data = await resp.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setGameOver(data.gameOver || false);

      // [CHANGED]
      let [dMsg, pMsg] = parseMessagesAndPreserveDealer(dealerMessage, data.message || '');
      setDealerMessage(dMsg);
      setPlayerMessage(pMsg);

      if (data.playerHands) {
        setPlayerHandsBySeat((ps) => ({
          ...ps,
          [mySeatIndex]: data.playerHands[0] || [],
        }));
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);
      if (data.balance !== undefined) setBalance(data.balance);
    } catch (err) {
      console.error('Error handleStand =>', err);
    }
  }

  function canDouble() {
    if (!gameStarted || gameOver) return false;
    const myCards = playerHandsBySeat[mySeatIndex] || [];
    const total = calculateHandTotal(myCards);
    if (![9, 10, 11].includes(total)) return false;
    if (balance < currentBet) return false;
    return true;
  }

  async function handleDouble() {
    if (!socket || !canDouble()) return;
    try {
      setBalance((b) => b - currentBet);
      setCurrentBet((b) => b * 2);

      const resp = await fetch(`http://${SERVER_IP}/double`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: 0 }),
      });
      const data = await resp.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setGameOver(data.gameOver || false);

      // [CHANGED]
      let [dMsg, pMsg] = parseMessagesAndPreserveDealer(dealerMessage, data.message || '');
      setDealerMessage(dMsg);
      setPlayerMessage(pMsg);

      if (data.playerHands) {
        setPlayerHandsBySeat((ps) => ({
          ...ps,
          [mySeatIndex]: data.playerHands[0] || [],
        }));
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);
      if (data.balance !== undefined) setBalance(data.balance);
    } catch (err) {
      console.error('Error handleDouble =>', err);
    }
  }

  // It's my turn if seat matches & game not over
  const isMyTurn = currentTurnSeat === mySeatIndex && gameStarted && !gameOver;

  // ====== RENDER ======

  // 1) Join screen
  if (!joined) {
    return (
      <div className="table-container">
        <div className="join-container">
          <h2>Enter your username:</h2>
          <input
            type="text"
            placeholder="Username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button className="common-button" onClick={handleJoin}>
            Join
          </button>
          {!connected && (
            <p style={{ color: 'red', marginTop: '10px' }}>
              Not connected to server at {SERVER_IP}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 2) Lobby
  if (!gameStarted && !gameOver) {
    const allReady = players.length > 0 && players.every((s) => s.isReady);
    const canHostStart = host && (
      (players.length === 1 && players[0].isReady) ||
      (players.length > 1 && allReady)
    );

    return (
      <div className="table-container">
        <h1 className="title-banner">Blackjack</h1>
        <div className="balance-section">
          <button className="common-button" disabled>
            Balance: ${balance}
          </button>
          <button className="common-button" disabled>
            Current Bet: ${currentBet}
          </button>
        </div>

        <div className="lobby-players">
          <h2>Players in Lobby:</h2>
          <ul>
            {players.map((p) => (
              <li key={p.seatIndex}>
                {p.username} {p.isReady ? '(Ready)' : '(Not Ready)'}
                {p.seatIndex === 0 && ' [Host]'}
              </li>
            ))}
          </ul>
        </div>

        <div className="message-display">
          <p>{playerMessage}</p>
        </div>

        {/* If I'm not ready => show bet UI */}
        {!players.find((p) => p.seatIndex === mySeatIndex)?.isReady && (
          <>
            <div className="chips-row">
              {[5, 10, 25, 50, 100].map((val) => (
                <img
                  key={val}
                  src={`/src/assets/chips/${val}.png`}
                  alt={`$${val} chip`}
                  className="chip-image"
                  onClick={() => handleAddChip(val)}
                />
              ))}
            </div>
            {currentBet > 0 && (
              <div className="bet-actions">
                <button className="common-button" onClick={handleClearBet}>
                  Clear
                </button>
                <button className="common-button" onClick={handlePlaceBet}>
                  Deal (Ready)
                </button>
              </div>
            )}
          </>
        )}

        {canHostStart && (
          <button className="common-button start-game-button" onClick={handleHostStartGame}>
            Start Game
          </button>
        )}
      </div>
    );
  }

  // 3) Actual Game
  return (
    <div className="table-container">
      {/* Dealer area - Moved dealer message INSIDE this block */}
      <div className="dealer-area">
        <h2>Dealer's Hand</h2>
        <div className="hand-display">
          {dealerHand.map((card, i) => {
            const displayCard = { ...card };
            if (i === 1 && !gameOver) {
              displayCard.rank = 'Hidden';
            }
            return (
              <img
                key={i}
                src={getCardImage(displayCard)}
                alt={`${card.rank} of ${card.suit}`}
                className="card-image"
              />
            );
          })}
        </div>

        {/* [CHANGED] The dealer message is now inside the .dealer-area */}
        <div className="dealer-message" style={{ marginTop: '10px' }}>
          <p>{dealerMessage}</p>
        </div>
      </div>

      {/* Turn message (only if 2+ players) */}
      <div className="turn-message">
        {!gameOver && currentTurnSeat !== null && players.length >= 2 && (
          <h2>
            {currentTurnSeat === mySeatIndex
              ? "It's your turn"
              : `It's ${players.find((p) => p.seatIndex === currentTurnSeat)?.username}'s turn`}
          </h2>
        )}
        {gameOver && <h2>Round ended</h2>}
      </div>

      {/* Player message */}
      <div className="player-message">
        <p>{playerMessage}</p>
      </div>

      {/* Balances & bets in top-right, plus new round button below */}
      <div className="balance-section">
        <button className="common-button" disabled>
          Balance: ${balance}
        </button>
        <button className="common-button" disabled>
          Current Bet: ${currentBet}
        </button>

        {host && gameOver && (
          <button className="common-button new-round-button" onClick={handleNewRound}>
            New Round
          </button>
        )}
      </div>

      {/* Players */}
      <div className="player-area">
        {[...players].reverse().map((p) => {
          const seatCards = playerHandsBySeat[p.seatIndex] || [];
          let resultText = '';
          if (gameOver && playerStatuses[p.seatIndex]) {
            resultText = ` (${playerStatuses[p.seatIndex]})`;
          }

          // Show total if it's the player's turn
          // (You can adjust this logic as needed.)
          let displayName = p.username;
          if (p.seatIndex === mySeatIndex) displayName += ' (You)';
          const total = calculateHandTotal(seatCards);
          if (p.seatIndex === currentTurnSeat) {
            if (total > 21) {
              displayName += `: ${total} (Bust)`;
            } else {
              displayName += `: ${total}`;
            }
          }

          return (
            <div className="player-hand-container seat-block" key={p.seatIndex}>
              <h2>
                {displayName}
                {resultText}
              </h2>
              <div className="hand-display">
                {seatCards.map((card, idx) => (
                  <img
                    key={idx}
                    src={getCardImage(card)}
                    alt={`${card.rank} of ${card.suit}`}
                    className="card-image"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons if it's my turn */}
      {isMyTurn && !gameOver && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>
            Hit
          </button>
          <button className="common-button" onClick={handleStand}>
            Stand
          </button>
          {canDouble() && (
            <button className="common-button" onClick={handleDouble}>
              Double
            </button>
          )}
        </div>
      )}
    </div>
  );
}
