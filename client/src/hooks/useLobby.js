import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';                 // ←  adjust path if needed
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  arrayUnion
} from 'firebase/firestore';
import { nanoid } from 'nanoid';

/**
 * React hook that owns everything under lobbies/{id}
 * @param {string} username – display name
 * @param {string} uid      – unique player id (auth uid or random)
 */
export default function useLobby(username, uid) {
  const [lobbyId,   setLobbyId]   = useState('');
  const [lobbyData, setLobbyData] = useState(null);
  const [joined,    setJoined]    = useState(false);
  const [error,     setError]     = useState(null);

  /* -------------------- create --------------------------------------- */
  const createLobby = useCallback(async () => {
    try {
      const id  = nanoid(6).toUpperCase();                 // e.g. 3F7A2C
      const ref = doc(db, 'lobbies', id);
      await setDoc(ref, {
        host: uid,
        players: [uid],
        usernames: { [uid]: username },
        ready:     { [uid]: false },
        bets:      { [uid]: 0     },
        status:    'waiting',
        createdAt: Date.now(),
      });
      setLobbyId(id);
      setJoined(true);
    } catch (err) {
      setError(err.message);
    }
  }, [uid, username]);

  /* -------------------- join ----------------------------------------- */
  const joinLobby = useCallback(async (id) => {
    try {
      const ref  = doc(db, 'lobbies', id.trim().toUpperCase());
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Lobby does not exist');

      const data = snap.data();
      if (data.players.length >= 3) throw new Error('Lobby is full (3)');

      await updateDoc(ref, {
        players:   arrayUnion(uid),
        [`usernames.${uid}`]: username,
        [`ready.${uid}`]: false,
        [`bets.${uid}`] : 0,
      });
      setLobbyId(ref.id);
      setJoined(true);
    } catch (err) {
      setError(err.message);
    }
  }, [uid, username]);

  /* -------------------- realtime listener ---------------------------- */
  useEffect(() => {
    if (!lobbyId) return;
    const unsub = onSnapshot(doc(db, 'lobbies', lobbyId), (snap) => {
      setLobbyData({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [lobbyId]);

  /* -------------------- ready / bet ---------------------------------- */
  const setReady = useCallback(
    async (flag, bet = 0) => {
      if (!lobbyId) return;
      const ref = doc(db, 'lobbies', lobbyId);
      await updateDoc(ref, {
        [`ready.${uid}`]: flag,
        [`bets.${uid}`] : bet,
      });
    },
    [lobbyId, uid]
  );

  return {
    lobbyId,
    lobbyData,
    joined,
    error,
    createLobby,
    joinLobby,
    setReady,
  };
}
