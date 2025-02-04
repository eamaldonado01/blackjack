// index.jsx

const express = require('express');
const cors = require('cors');
const { createDeck, shuffleDeck, calculateHandValue } = require('./gameLogic');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());  // Ensures frontend can call backend
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// Route to start a new game or reset
app.post('/start', (req, res) => {
    // 1. Create and shuffle a new deck
    let deck = createDeck();
    deck = shuffleDeck(deck);
  
    // 2. Deal two cards to player, two to dealer
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
  
    // 3. Calculate initial message, or any game rules
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);
  
    let message = `Player: ${playerValue}, Dealer shows: ${dealerHand[0].rank} of ${dealerHand[0].suit}`;
  
    // 4. Update the in-memory state
    gameState = {
      deck,
      playerHand,
      dealerHand,
      gameOver: false,
      message,
    };
  
    // 5. Respond with the initial state
    res.json({
      playerHand,
      dealerHand: [dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }], // Hide dealer's second card
      message,
    });
  });

app.post('/hit', (req, res) => {
    if (gameState.gameOver) {
      return res.json({ message: 'Game is already over.' });
    }
  
    // 1. Player takes top card from deck
    const newCard = gameState.deck.pop();
    gameState.playerHand.push(newCard);
  
    // 2. Calculate player value
    const playerValue = calculateHandValue(gameState.playerHand);
  
    // 3. Check for bust
    if (playerValue > 21) {
      gameState.gameOver = true;
      gameState.message = `Player busts with ${playerValue}. Dealer wins.`;
    } else {
      gameState.message = `Player hits and now has ${playerValue}.`;
    }
  
    // 4. Respond
    res.json({
      playerHand: gameState.playerHand,
      dealerHand: [gameState.dealerHand[0], { suit: 'Hidden', rank: 'Hidden' }],
      message: gameState.message,
      gameOver: gameState.gameOver,
    });
  });

app.post('/stand', (req, res) => {
    if (gameState.gameOver) {
      return res.json({ message: 'Game is already over.' });
    }
  
    // 1. Reveal the dealer's second card and do dealer's turn
    let dealerValue = calculateHandValue(gameState.dealerHand);
    while (dealerValue < 17) {
      const newDealerCard = gameState.deck.pop();
      gameState.dealerHand.push(newDealerCard);
      dealerValue = calculateHandValue(gameState.dealerHand);
    }
  
    // 2. Compare totals
    const playerValue = calculateHandValue(gameState.playerHand);
  
    let resultMessage;
    if (dealerValue > 21) {
      resultMessage = `Dealer busts with ${dealerValue}. Player wins!`;
    } else if (dealerValue > playerValue) {
      resultMessage = `Dealer has ${dealerValue}, Player has ${playerValue}. Dealer wins.`;
    } else if (dealerValue < playerValue) {
      resultMessage = `Dealer has ${dealerValue}, Player has ${playerValue}. Player wins!`;
    } else {
      resultMessage = `Tie! Dealer and Player both have ${playerValue}.`;
    }
  
    // 3. Set state to game over
    gameState.gameOver = true;
    gameState.message = resultMessage;
  
    // 4. Respond with the full dealer hand
    res.json({
      playerHand: gameState.playerHand,
      dealerHand: gameState.dealerHand,
      message: resultMessage,
      gameOver: true,
    });
  });
  
  
