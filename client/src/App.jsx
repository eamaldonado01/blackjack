// App.jsx

import React, { useState } from 'react';

function App() {
  const [message, setMessage] = useState('');
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameOver, setGameOver] = useState(false);

  const handleStart = async () => {
    try {
      console.log("Sending request to /start");
      const response = await fetch('http://127.0.0.1:3001/start', {
        method: 'POST',
      });
  
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
  
      const data = await response.json();
      console.log("Received response:", data);
      setMessage(data.message);
      setPlayerHand(data.playerHand);
      setDealerHand(data.dealerHand);
      setGameOver(false);
    } catch (error) {
      console.error('Error starting game:', error.message);
    }
  };
  

  const handleHit = async () => {
    try {
      console.log("Sending request to /hit");
      const response = await fetch('http://127.0.0.1:3001/start', {
        method: 'POST',
      });
      
      const data = await response.json();
      console.log("Received response:", data);
      setMessage(data.message);
      setPlayerHand(data.playerHand);
      setDealerHand(data.dealerHand);
      setGameOver(data.gameOver);
    } catch (error) {
      console.error('Error hitting:', error);
    }
  };

  const handleStand = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3001/stand', {
        method: 'POST',
      });
      const data = await response.json();
      setMessage(data.message);
      setPlayerHand(data.playerHand);
      setDealerHand(data.dealerHand);
      setGameOver(data.gameOver);
    } catch (error) {
      console.error('Error standing:', error);
    }
  };

  return (
    <div>
      <h1>Blackjack</h1>
      <p>{message}</p>

      <button onClick={handleStart}>Start</button>
      {!gameOver && (
        <>
          <button onClick={handleHit}>Hit</button>
          <button onClick={handleStand}>Stand</button>
        </>
      )}

      <div>
        <h2>Player Hand:</h2>
        {playerHand.map((card, index) => (
          <p key={index}>
            {card.rank} of {card.suit}
          </p>
        ))}
      </div>

      <div>
        <h2>Dealer Hand:</h2>
        {dealerHand.map((card, index) => (
          <p key={index}>
            {card.rank} of {card.suit}
          </p>
        ))}
      </div>
    </div>
  );
}

export default App;
