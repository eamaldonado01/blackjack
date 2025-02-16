import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './styles.css';

// IP of Computer 1
const SERVER_IP = '192.168.86.220:3001';

// If you'd like more logs, set to true
const DEBUG = true;

// A local helper to display card images
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

export default function App() {
  /** Socket connection states */
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  /** Lobby states */
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [host, setHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentTurnSeat, setCurrentTurnSeat] = useState(null);

  /** Multi-player game states from server */
  const [playerHandsBySeat, setPlayerHandsBySeat] = useState({}); 
  const [dealerHand, setDealerHand] = useState([]);
  const [message, setMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);

  /** Single-player style states for bets/balance */
  const [balance, setBalance] = useState(300);
  const [currentBet, setCurrentBet] = useState(0);
  const [splitOccurred, setSplitOccurred] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);

  // Chip data
  const chipData = [
    { value: 5,   img: '/src/assets/chips/5.png' },
    { value: 10,  img: '/src/assets/chips/10.png' },
    { value: 25,  img: '/src/assets/chips/25.png' },
    { value: 50,  img: '/src/assets/chips/50.png' },
    { value: 100, img: '/src/assets/chips/100.png' },
  ];

  /** ========== Socket Setup ========== */
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

    // tableState includes seats + turn info + possibly partial game data
    newSocket.on('tableState', (data) => {
      if (DEBUG) console.log('[App] tableState =>', data);
      setPlayers(data.players || []);
      setMessage(data.message || '');
      setGameStarted(!!data.gameStarted);
      setCurrentTurnSeat(data.currentTurnSeat ?? null);
    });

    // multiBlackjack event => full game data
    newSocket.on('multiBlackjackUpdate', (data) => {
      if (DEBUG) console.log('[App] multiBlackjackUpdate =>', data);
      setPlayerHandsBySeat(data.playerHandsBySeat || {});
      setDealerHand(data.dealerHand || []);
      setGameOver(!!data.gameOver);
      setMessage(data.message || '');
    });

    // joinSuccess => seatIndex, gameStarted
    newSocket.on('joinSuccess', (data) => {
      if (DEBUG) console.log('[App] joinSuccess =>', data);
      setPlayers(data.players || []);
      setMySeatIndex(data.seatIndex);
      setHost(data.seatIndex === 0);
      setJoined(true);
      setGameStarted(data.gameStarted);
    });

    newSocket.on('joinError', (errMsg) => {
      alert(errMsg);
    });

    setSocket(newSocket);
    return () => {
      if (DEBUG) console.log('[App] cleanup');
      newSocket.disconnect();
    };
  }, []);

  /** ========== Lobby Logic ========== */
  function handleJoin() {
    if (DEBUG) console.log('[App] handleJoin, user=', username);
    if (!socket) {
      alert('Socket not connected');
      return;
    }
    if (!connected) {
      alert('Not connected to server. Check firewall / IP.');
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

  /** ========== Single-player-like Bets ========== */
  function handleAddChip(chipValue) {
    if (balance < chipValue) {
      alert('Not enough balance to add this chip.');
      return;
    }
    setBalance(bal => bal - chipValue);
    setCurrentBet(b => b + chipValue);
  }

  function handleClearBet() {
    setBalance(bal => bal + currentBet);
    setCurrentBet(0);
  }

  // Pressing "Deal" => calls /start (single-player style)
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
      if (data.message?.includes('Blackjack!')) {
        setGameOver(true);
      } else {
        setGameOver(false);
      }
      setMessage(data.message || '');
      // Because this is single-player logic, we store *our* hand in playerHandsBySeat
      setPlayerHandsBySeat(seatsObj => ({
        ...seatsObj,
        [mySeatIndex]: data.playerHand || [],
      }));
      setDealerHand(data.dealerHand || []);
      setBalance(data.balance ?? balance);

      setBetPlaced(true);
      setReadyOnServer();
    } catch (err) {
      console.error('Error on placeBet => /start:', err);
    }
  }

  /** 
   * Called when user (host) clicks "New Round"
   * => call /resetRound (server) to:
   *     - gameStarted = false
   *     - seats' isReady = false
   *     - reset any game states
   * Then client sees gameStarted=false => returns to lobby
   */
  async function handleNewRound() {
    if (!socket) return;
    try {
      const resp = await fetch(`http://${SERVER_IP}/resetRound`, {
        method: 'POST',
      });
      const data = await resp.json();
      console.log('[App] /resetRound =>', data);
      // Locally reset
      setMessage('');
      setBetPlaced(false);
      setGameOver(false);
      setSplitOccurred(false);
      setCurrentBet(0);
      setDealerHand([]);
      setPlayerHandsBySeat({});
      // The server will also broadcast gameStarted=false => we'll re-render the lobby
    } catch (err) {
      console.error('Error handleNewRound => /resetRound:', err);
    }
  }

  /**
   * Multi-seat HIT
   * For multi-seat logic, we call /hit with seatIndex.
   * For single-player, we still call the same route, but let the server handle it.
   */
  async function handleHit() {
    try {
      const resp = await fetch(`http://${SERVER_IP}/hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Provide seatIndex for multi-seat logic
        body: JSON.stringify({ seatIndex: mySeatIndex, handIndex: 0 }),
      });
      const data = await resp.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setMessage(data.message || '');
      setGameOver(data.gameOver || false);

      // If single-player updated info comes back, update local
      if (data.playerHands) {
        setPlayerHandsBySeat(ps => ({
          ...ps,
          [mySeatIndex]: data.playerHands[0] || [],
        }));
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);

      if (data.balance !== undefined) {
        setBalance(data.balance);
      }

      if (DEBUG) console.log('Hit =>', data);
    } catch (err) {
      console.error('Error hitting =>', err);
    }
  }

  /**
   * Multi-seat STAND
   */
  async function handleStand() {
    try {
      const resp = await fetch(`http://${SERVER_IP}/stand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Provide seatIndex for multi-seat logic
        body: JSON.stringify({ seatIndex: mySeatIndex }),
      });
      const data = await resp.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setMessage(data.message || '');
      setGameOver(data.gameOver || false);

      // If single-player updated info
      if (data.playerHands) {
        setPlayerHandsBySeat(ps => ({
          ...ps,
          [mySeatIndex]: data.playerHands[0] || [],
        }));
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);
      if (data.balance !== undefined) {
        setBalance(data.balance);
      }

      if (DEBUG) console.log('Stand =>', data);
    } catch (err) {
      console.error('Error standing =>', err);
    }
  }

  function canDouble() {
    if (!gameStarted || gameOver) return false;
    // Only for single-player approach
    const myCards = playerHandsBySeat[mySeatIndex] || [];
    // local check
    let total = 0; let aceCount=0;
    myCards.forEach((card) => {
      if (!card || card.rank==='Hidden') return;
      switch (card.rank) {
        case 'A': case 'Ace': aceCount++; total+=1; break;
        case 'K': case 'King':
        case 'Q': case 'Queen':
        case 'J': case 'Jack': total+=10; break;
        default: total += Number(card.rank) || 0; break;
      }
    });
    while (aceCount>0 && total+10<=21) { total+=10; aceCount--; }
    if (![9,10,11].includes(total)) return false;
    if (balance < currentBet) return false;
    return true;
  }

  async function handleDouble() {
    if (!canDouble()) return;
    try {
      setBalance(b => b - currentBet);
      setCurrentBet(b => b*2);
      const resp = await fetch(`http://${SERVER_IP}/double`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handIndex: 0 }),
      });
      const data = await resp.json();
      setMessage(data.message || '');
      setGameOver(data.gameOver||false);

      if (data.playerHands) {
        setPlayerHandsBySeat(ps => ({
          ...ps,
          [mySeatIndex]: data.playerHands[0] || [],
        }));
      }
      if (data.dealerHand) setDealerHand(data.dealerHand);
      setBalance(data.balance ?? balance);
    } catch (err) {
      console.error('Error double =>', err);
    }
  }

  // It's my turn if I'm the currentTurnSeat in a multi game,
  // or if single-player game is in progress and not over (we reuse the same flag).
  const isMyTurn = (currentTurnSeat === mySeatIndex) && gameStarted && !gameOver;

  // ====== Renders ======

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
          <button type="button" className="common-button" onClick={handleJoin}>
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

  // 2) Lobby/Loading
  if (!gameStarted && !gameOver) {
    const allReady = players.length > 0 && players.every(s => s.isReady);
    // Only seatIndex=0 is the host.
    const canHostStart = host && (
      (players.length === 1 && players[0].isReady)
      || (players.length>1 && allReady)
    );

    return (
      <div className="table-container">
        <h1 className="title-banner">Blackjack Lobby</h1>
        <div className="balance-section">
          <button className="common-button" disabled>Balance: ${balance}</button>
          <button className="common-button" disabled>Current Bet: ${currentBet}</button>
        </div>

        <div className="lobby-players">
          <h2>Players in Lobby:</h2>
          <ul>
            {players.map((p) => (
              <li key={p.seatIndex}>
                {p.username} {p.isReady ? '(Ready)' : '(Not Ready)'}
                {p.seatIndex===0 && ' [Host]'}
              </li>
            ))}
          </ul>
        </div>

        <div className="message-display">
          <p>{message}</p>
        </div>

        {/* If I'm not ready => show bet UI */}
        {!players.find(p=>p.seatIndex===mySeatIndex)?.isReady && (
          <>
            <div className="chips-row">
              {chipData.map(chip=>(
                <img
                  key={chip.value}
                  src={chip.img}
                  alt={`$${chip.value} chip`}
                  className="chip-image"
                  onClick={()=>handleAddChip(chip.value)}
                />
              ))}
            </div>
            {currentBet>0 && (
              <div className="bet-actions">
                <button className="common-button" onClick={handleClearBet}>Clear</button>
                <button className="common-button" onClick={handlePlaceBet}>Deal (Ready)</button>
              </div>
            )}
          </>
        )}

        {/* Host can start if conditions are met */}
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
      <div className="balance-section">
        <button className="common-button" disabled>Balance: ${balance}</button>
        <button className="common-button" disabled>Current Bet: ${currentBet}</button>
      </div>

      <div className="message-display">
        <p>{message}</p>
        {currentTurnSeat !== null && (
          <h2>It's {players.find(p=>p.seatIndex===currentTurnSeat)?.username}'s turn</h2>
        )}
      </div>

      {/* Dealer */}
      <div className="dealer-area">
        <h2>Dealer's Hand</h2>
        <div className="hand-display">
          {dealerHand.map((card, idx)=>(
            <img
              key={idx}
              src={getCardImage(card)}
              alt={`${card.rank} of ${card.suit}`}
              className="card-image"
            />
          ))}
        </div>
      </div>

      {/* Players (reverse order so that seat 0 is on the right, seat 1 on the left, etc.) */}
      <div className="player-area">
        {[...players].reverse().map((p)=> {
          const seatCards = playerHandsBySeat[p.seatIndex] || [];
          return (
            <div className="player-hand-container seat-block" key={p.seatIndex}>
              <h2>
                {p.username}{' '}
                {p.seatIndex===mySeatIndex && '(You)'}
                {p.seatIndex===currentTurnSeat && ' (Turn)'}
              </h2>
              <div className="hand-display">
                {seatCards.map((card, cIndex)=>(
                  <img
                    key={cIndex}
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

      {/* If it's my turn => show actions */}
      {isMyTurn && !gameOver && (
        <div className="action-buttons">
          <button className="common-button" onClick={handleHit}>Hit</button>
          <button className="common-button" onClick={handleStand}>Stand</button>
          {canDouble() && (
            <button className="common-button" onClick={handleDouble}>Double</button>
          )}
        </div>
      )}

      {/* Only host should see "New Round" when the game is over */}
      {host && gameOver && (
        <button onClick={handleNewRound} className="common-button new-round-button">
          New Round
        </button>
      )}
    </div>
  );
}
