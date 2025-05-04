import React from 'react';
import PropTypes from 'prop-types';

export default function GameMessage({ dealerMessage, playerMessage }) {
  return (
    <div className="message-display">
      {dealerMessage && <p>Dealer: {dealerMessage}</p>}
      {playerMessage && <p>{playerMessage}</p>}
    </div>
  );
}

GameMessage.propTypes = {
  dealerMessage: PropTypes.string,
  playerMessage: PropTypes.string,
};
