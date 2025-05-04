import React from 'react';
import PlayerInfo from './components/PlayerInfo';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameMessage from './components/GameMessage';

export default function SinglePlayerGame({
  username, balance, bet, dealerHand, playerHand,
  dealerMessage, playerMessage, canDouble, showActions,
  handleHit, handleStand, handleDouble, handleClearBet, handleDeal
}) {
  return (
    <div className="singleplayer-container">
      <PlayerInfo username={username} balance={balance} currentBet={bet} />
      <GameBoard dealerHand={dealerHand} playerHand={playerHand} isSinglePlayer />
      <GameMessage dealerMessage={dealerMessage} playerMessage={playerMessage} />
      <GameControls
        onHit={handleHit}
        onStand={handleStand}
        onDouble={handleDouble}
        onClear={handleClearBet}
        onDeal={handleDeal}
        canDouble={canDouble}
        showActions={showActions}
      />
    </div>
  );
}