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

// In-memory state for single player
let gameState = {
  deck: [],
  playerHands: [[]], // Supports multiple hands if split occurs
  dealerHand: [],
  gameOver: false,
  message: '',
  bet: 0,
  balance: 300, // Starting balance
  currentHandIndex: 0,
  splitOccurred: false,
};

// Helper to reset or prepare a new round
function resetGameState() {
  gameState.deck = [];
  gameState.playerHands = [[]];
  gameState.dealerHand = [];
  gameState.gameOver = false;
  gameState.message = '';
  gameState.bet = 0;
  gameState.currentHandIndex = 0;
  gameState.splitOccurred = false;
  // Note: we do NOT reset balance here, so the player keeps winnings.
}

// Route to start a new game
app.post('/start', (req, res) => {
  const { bet } = req.body;

  // If there's already a game over, let's reset the deck
  // so we can start fresh
  if (gameState.gameOver || gameState.playerHands[0].length > 0) {
    resetGameState();
  }

  // Check if user has enough balance
  if (bet > gameState.balance) {
    return res.status(400).json({ message: 'Insufficient balance for this bet.' });
  }

  let deck = createDeck();
  deck = shuffleDeck(deck);

  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  // Prepare the in-memory state
  gameState.deck = deck;
  gameState.playerHands = [playerHand];
  gameState.dealerHand = dealerHand;
  gameState.gameOver = false;
  gameState.message = `Player: ${playerValue}, Dealer shows: ${dealerHand[0].rank} of ${dealerHand[0].suit}`;
  gameState.bet = bet;
  gameState.balance -= bet; // subtract bet from balance
  gameState.currentHandIndex = 0;
  gameState.splitOccurred = false;

  res.json({
    message: gameState.message,
    playerHand,
    dealerHand: [dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
    balance: gameState.balance,
  });
});

// Route to handle Hit action
app.post('/hit', (req, res) => {
  const { handIndex } = req.body;

  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }

  const newCard = gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const playerValue = calculateHandValue(gameState.playerHands[handIndex]);

  if (playerValue > 21) {
    gameState.message = `Hand ${handIndex + 1} busts with ${playerValue}.`;
    gameState.gameOver = true;
  } else {
    gameState.message = `Hand ${handIndex + 1} now has ${playerValue}.`;
  }

  res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    playerHands: gameState.playerHands,
    dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
  });
});

// Route to handle Stand action
app.post('/stand', (req, res) => {
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }

  let dealerValue = calculateHandValue(gameState.dealerHand);
  // Dealer draws until at least 17
  while (dealerValue < 17) {
    gameState.dealerHand.push(gameState.deck.pop());
    dealerValue = calculateHandValue(gameState.dealerHand);
  }

  let outcome = 'dealer-win';
  let message = '';

  // Compare each of the player's hands to the dealer
  gameState.playerHands.forEach((hand, idx) => {
    const playerVal = calculateHandValue(hand);

    if (playerVal > 21) {
      message += `Hand ${idx + 1} busts! `;
    } else if (dealerValue > 21 || playerVal > dealerValue) {
      outcome = 'player-win';
      message += `Hand ${idx + 1} wins with ${playerVal} vs dealer ${dealerValue}. `;
    } else if (playerVal === dealerValue) {
      outcome = 'tie';
      message += `Hand ${idx + 1} ties with ${playerVal}. `;
    } else {
      // dealer is strictly greater
      message += `Hand ${idx + 1} loses with ${playerVal} vs dealer ${dealerValue}. `;
    }
  });

  gameState.gameOver = true;
  gameState.message = message;

  // Adjust balance based on outcome
  if (outcome === 'player-win') {
    // normal: double the bet
    gameState.balance += gameState.bet * 2;
  } else if (outcome === 'tie') {
    // return bet
    gameState.balance += gameState.bet;
  }

  res.json({
    message,
    gameOver: true,
    outcome,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: gameState.dealerHand,
  });
});

// Route to handle Double action
app.post('/double', (req, res) => {
  const { handIndex } = req.body;

  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }

  if (gameState.balance < gameState.bet) {
    return res.json({ message: 'Insufficient balance to double down.' });
  }

  // Double the bet
  gameState.balance -= gameState.bet;
  gameState.bet *= 2;

  // Player draws exactly 1 card
  const newCard = gameState.deck.pop();
  gameState.playerHands[handIndex].push(newCard);

  const value = calculateHandValue(gameState.playerHands[handIndex]);
  let message = `Hand ${handIndex + 1} doubles to a final value of ${value}.`;

  if (value > 21) {
    // busted
    message += ` Hand ${handIndex + 1} busts!`;
    gameState.gameOver = true;
    return res.json({
      message,
      gameOver: true,
      balance: gameState.balance,
      playerHands: gameState.playerHands,
      dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
      outcome: 'dealer-win',
    });
  }

  // If not busted, we effectively "stand" for this hand
  // We'll reuse the existing stand logic to handle the dealer turn & results
  // Trick: call the stand route internally
  req.url = '/stand'; // rewrite URL
  req.method = 'POST';
  app._router.handle(req, res);
});

// Route to handle Split action
app.post('/split', (req, res) => {
  if (gameState.gameOver) {
    return res.json({ message: 'Game is already over.' });
  }

  // We only allow 1 split right now
  if (gameState.splitOccurred || gameState.playerHands.length !== 1) {
    return res.json({ message: 'Split not allowed.' });
  }

  const [hand] = gameState.playerHands;
  // Official Blackjack: if first 2 cards have the same "rank" or both are 10-value cards
  // We'll just check if exact same rank for simplicity
  const rank1 = hand[0].rank;
  const rank2 = hand[1].rank;
  if (hand.length !== 2 || rank1 !== rank2) {
    return res.json({ message: 'Cannot split unless both cards have the same rank.' });
  }

  if (gameState.balance < gameState.bet) {
    return res.json({ message: 'Insufficient balance to split.' });
  }

  // Double the bet for the second hand
  gameState.balance -= gameState.bet;
  gameState.bet *= 2;

  const newHand1 = [hand[0]];
  const newHand2 = [hand[1]];

  gameState.playerHands = [newHand1, newHand2];
  gameState.splitOccurred = true;
  gameState.message = 'You split your cards!';

  res.json({
    message: gameState.message,
    gameOver: gameState.gameOver,
    balance: gameState.balance,
    playerHands: gameState.playerHands,
    dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
  });
});

// OPTIONAL: If you'd like a "reset" route to let user start fresh
app.post('/reset', (req, res) => {
  resetGameState();
  // Keep the same balance or reset it—your choice
  gameState.balance = 300; // example if you want to restart from $300
  res.json({ message: 'Game reset.', balance: gameState.balance });
});
