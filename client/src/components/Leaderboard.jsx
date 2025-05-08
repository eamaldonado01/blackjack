import React, { useEffect, useState } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export default function Leaderboard() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('balance', 'desc'),
      limit(10),
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => d.data()));
    });
    return () => unsub();
  }, []);

  const getMedalOrRank = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  return (
    <div className="leaderboard">
      <h2>Leaderboard</h2>
      <ol>
        {entries.map((e, i) => (
          <li key={`${e.username}-${i}`}>
            {getMedalOrRank(i)} {e.username} — ${e.balance}
          </li>
        ))}
        {Array.from({ length: 10 - entries.length }).map((_, i) => (
          <li key={`empty-${i}`}>{entries.length + i + 1}. —</li>
        ))}
      </ol>
    </div>
  );
}
