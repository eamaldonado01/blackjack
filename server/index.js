/**
 * FILE: index.js
 * LOCATION: ~/Downloads/blackjack/server/index.js
 */

const express = require('express');
const cors = require('cors');
const { createDeck, shuffleDeck, calculateHandValue } = require('./gameLogic');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// In-memory state
let gameState = {
  deck: [],
  playerHands: [[]],
  dealerHand: [],
  gameOver: false,
  message: '',
  bet: 0,
  balance: 300,
  currentHandIndex: 0,
  splitOccurred: false,
};

/**
 * Reset everything EXCEPT balance if the game
 * is still in progress, to preserve continuous play
 */
function resetGameStateIfNeeded() {
  // If game is over or no cards have been dealt, reset
  if (gameState.gameOver || gameState.playerHands[0].length === 0) {
    gameState.deck = [];
    gameState.playerHands = [[]];
    gameState.dealerHand = [];
    gameState.gameOver = false;
    gameState.message = '';
    gameState.bet = 0;
    gameState.currentHandIndex = 0;
    gameState.splitOccurred = false;
    // We do NOT reset `balance` here to allow continuous play
  }
}

// Check for Blackjack (two-card 21)
function checkForBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

// --------------------- ROUTES ---------------------

/**
 * POST /start
 * - Deducts bet from balance
 * - Deals initial cards
 * - Checks immediate Blackjack
 */
app.post('/start', (req, res) => {
  const { bet } = req.body;

  // Reset only if needed (game over or no round in progress)
  resetGameStateIfNeeded();

  // Validate bet
  if (bet > gameState.balance) {
    return res.status(400).json({ message: 'Insufficient balance for this bet.' });
  }
  if (bet <= 0) {
    return res.status(400).json({ message: 'Bet must be greater than 0.' });
  }

  // Create and shuffle the deck
  let deck = createDeck();
  deck = shuffleDeck(deck);

  // Deal initial hands
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  gameState.deck = deck;
  gameState.playerHands = [playerHand];
  gameState.dealerHand = dealerHand;
  gameState.gameOver = false;
  gameState.bet = bet;
  gameState.balance -= bet; // subtract bet
  gameState.currentHandIndex = 0;
  gameState.splitOccurred = false;

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  // Original message for dealer's visible card
  let message = `Dealer shows: ${dealerHand[0].rank} of ${dealerHand[0].suit}`;

  // Check for immediate Blackjack
  if (checkForBlackjack(playerHand)) {
    const blackjackWin = Math.round(gameState.bet * 2.5);
    gameState.balance += blackjackWin;
    gameState.gameOver = true;
    message = 'Blackjack! Player wins!';
  } else {
    // ✅ FIX: display the player's actual card total instead of "???"
    message = `Player: ${playerValue}, ` + message;
  }

  gameState.message = message;

  return res.json({
    message: gameState.message,
    playerHand,
    dealerHand: [dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }], // hide dealer's second card
    balance: gameState.balance,
  });
});

/**
 * POST /hit
 */
app.post('/hit', (req, res) => {
  const { handIndex } = req.body;

  if (gameState.gameOver) {
    return res.json({
      message: 'Game is already over.',
      playerHands: gameState.playerHands,
      dealerHand: gameState.dealerHand,
      gameOver: true,
    });
  }

  // If already blackJack => no further actions
  if (checkForBlackjack(gameState.playerHands[handIndex])) {
    return res.json({
      message: 'Blackjack already!',
      gameOver: true,
      playerHands: gameState.playerHands,
      dealerHand: gameState.dealerHand,
    });
  }

  const newCard = gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const playerValue = calculateHandValue(gameState.playerHands[handIndex]);
  if (playerValue > 21) {
    // If no split => "Player busts!"
    if (!gameState.splitOccurred) {
      gameState.message = 'Player busts!';
    } else {
      gameState.message = `Hand ${handIndex + 1} busts with ${playerValue}.`;
    }
    gameState.gameOver = true;
  } else {
    // If no split => "Player now has X"
    if (!gameState.splitOccurred) {
      gameState.message = `Player now has ${playerValue}.`;
    } else {
      gameState.message = `Hand ${handIndex + 1} now has ${playerValue}.`;
    }
  }

  return res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    playerHands: gameState.playerHands,
    dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
  });
});

/**
 * POST /stand
 */
app.post('/stand', (req, res) => {
  if (gameState.gameOver) {
    return res.json({
      message: 'Game is already over.',
      playerHands: gameState.playerHands,
      dealerHand: gameState.dealerHand,
      gameOver: true,
    });
  }

  // If immediate blackjack => no further actions
  if (checkForBlackjack(gameState.playerHands[0])) {
    return res.json({
      message: 'You already have Blackjack!',
      gameOver: true,
      playerHands: gameState.playerHands,
      dealerHand: gameState.dealerHand,
      balance: gameState.balance,
    });
  }

  // Dealer draws to 17
  let dealerValue = calculateHandValue(gameState.dealerHand);
  while (dealerValue < 17) {
    gameState.dealerHand.push(gameState.deck.pop());
    dealerValue = calculateHandValue(gameState.dealerHand);
  }

  let outcome = 'dealer-win';
  let finalMessage = '';

  gameState.playerHands.forEach((hand, idx) => {
    const pVal = calculateHandValue(hand);

    if (pVal > 21) {
      if (!gameState.splitOccurred) {
        finalMessage += 'Player busts! ';
      } else {
        finalMessage += `Hand ${idx + 1} busts! `;
      }
    } else if (dealerValue > 21 || pVal > dealerValue) {
      outcome = 'player-win';
      if (!gameState.splitOccurred) {
        finalMessage += 'Player wins! ';
      } else {
        finalMessage += `Hand ${idx + 1} wins! `;
      }
    } else if (pVal === dealerValue) {
      outcome = 'tie';
      finalMessage += 'Tie! ';
    } else {
      finalMessage += 'Dealer wins! ';
    }
  });

  gameState.gameOver = true;
  gameState.message = finalMessage.trim();

  // Handle balance
  if (outcome === 'player-win') {
    gameState.balance += gameState.bet * 2;
  } else if (outcome === 'tie') {
    gameState.balance += gameState.bet;
  }

  return res.json({
    message: gameState.message,
    gameOver: true,
    outcome,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: gameState.dealerHand,
  });
});

/**
 * POST /double
 */
app.post('/double', (req, res) => {
  const { handIndex } = req.body;

  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }
  if (checkForBlackjack(gameState.playerHands[handIndex])) {
    return res.json({
      message: 'Cannot double after Blackjack!',
      gameOver: true,
      balance: gameState.balance,
      playerHands: gameState.playerHands,
      dealerHand: gameState.dealerHand,
    });
  }
  if (gameState.balance < gameState.bet) {
    return res.json({ message: 'Insufficient balance to double down.' });
  }

  gameState.balance -= gameState.bet;
  gameState.bet *= 2;

  const newCard = gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const value = calculateHandValue(gameState.playerHands[handIndex]);
  if (value > 21) {
    if (!gameState.splitOccurred) {
      gameState.message = 'Player busts after Double!';
    } else {
      gameState.message = `Hand ${handIndex + 1} busts after double!`;
    }
    gameState.gameOver = true;
    return res.json({
      message: gameState.message,
      gameOver: true,
      balance: gameState.balance,
      playerHands: gameState.playerHands,
      dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
      outcome: 'dealer-win',
    });
  }

  // If not busted, effectively stand
  req.url = '/stand'; 
  req.method = 'POST';
  app._router.handle(req, res);
});

/**
 * POST /split
 */
app.post('/split', (req, res) => {
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }
  if (gameState.splitOccurred || gameState.playerHands.length !== 1) {
    return res.json({ message: 'Split not allowed.' });
  }

  const [hand] = gameState.playerHands;
  if (hand.length !== 2 || hand[0].rank !== hand[1].rank) {
    return res.json({ message: 'Cannot split unless both cards have the same rank.' });
  }
  if (gameState.balance < gameState.bet) {
    return res.json({ message: 'Insufficient balance to split.' });
  }

  gameState.balance -= gameState.bet;
  gameState.bet *= 2;

  const newHand1 = [hand[0]];
  const newHand2 = [hand[1]];

  gameState.playerHands = [newHand1, newHand2];
  gameState.splitOccurred = true;
  gameState.message = 'You split your cards!';

  return res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
  });
});

/**
 * Optional: reset route
 */
app.post('/reset', (req, res) => {
  gameState.deck = [];
  gameState.playerHands = [[]];
  gameState.dealerHand = [];
  gameState.gameOver = false;
  gameState.message = '';
  gameState.bet = 0;
  gameState.currentHandIndex = 0;
  gameState.splitOccurred = false;
  gameState.balance = 300;

  return res.json({ message: 'Game reset.', balance: gameState.balance });
});

/** 
 * Why the bug was happening:
 * - The logic for the first round displayed "???": 
 *     message = `Player: ???, Dealer shows: ...`
 * - We replaced "???" with the correct playerValue:
 *     message = `Player: ${playerValue}, Dealer shows: ...`
 * 
 * Now, the first round will correctly show 
 * the player's total instead of "???".
 */
