// src/components/GameControls.jsx
import React from 'react';

export default function GameControls({ onHit, onStand, onDouble, onClear, onDeal, canDouble, showActions }) {
  return (
    <div className="action-buttons">
      {showActions && (
        <>
          <button className="common-button" onClick={onHit}>Hit</button>
          <button className="common-button" onClick={onStand}>Stand</button>
          {canDouble && <button className="common-button" onClick={onDouble}>Double</button>}
        </>
      )}
      {!showActions && (
        <>
          <button className="common-button" onClick={onClear}>Clear Bet</button>
          <button className="common-button" onClick={onDeal}>Deal</button>
        </>
      )}
    </div>
  );
}