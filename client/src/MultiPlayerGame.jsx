import React from 'react';
import PlayerInfo from './components/PlayerInfo';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameMessage from './components/GameMessage';
import LobbySelector from './components/LobbySelector';

export default function MultiPlayerGame({
  username, balance, bet, dealerHand, playerHand,
  dealerMessage, playerMessage, canDouble, showActions,
  handleHit, handleStand, handleDouble, handleClearBet, handleDeal,
  handleCreateLobby, handleJoinLobby
}) {
  return (
    <div className="multiplayer-container">
      <LobbySelector onCreate={handleCreateLobby} onJoin={handleJoinLobby} />
      <PlayerInfo username={username} balance={balance} currentBet={bet} />
      <GameBoard dealerHand={dealerHand} playerHand={playerHand} />
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