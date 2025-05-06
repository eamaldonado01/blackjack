import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  doc, setDoc, updateDoc, onSnapshot, runTransaction
} from 'firebase/firestore';

const DBG = true;
const dlog = (...args) => DBG && console.log('[useLobby]', ...args);

export default function useLobby(username, uid) {
  const [lobbyId, setLobbyId] = useState(null);
  const [lobbyData, setLobbyData] = useState(null);

  /* SNAPSHOT LISTENER */
  useEffect(() => {
    if (!lobbyId) return;
    dlog('Subscribing to lobby doc', lobbyId);
    const unsub = onSnapshot(
      doc(db, 'lobbies', lobbyId),
      snap => {
        dlog('Lobby snapshot update:', snap.exists() ? snap.data() : 'doc deleted');
        setLobbyData(snap.data());
      },
      err => console.error('snapshot error', err)
    );
    return () => {
      dlog('Unsubscribing from lobby doc', lobbyId);
      unsub();
    };
  }, [lobbyId]);

  /* CREATE LOBBY */
  const createLobby = async () => {
    const id = Math.random().toString(36).substring(2, 8);
    const ref = doc(db, 'lobbies', id);
    const initial = {
      createdAt: Date.now(),
      status: 'waiting',
      players: [uid],
      host: uid,
      ready: { [uid]: false },
      bets: { [uid]: 0 },
      balances: { [uid]: 100 },
      usernames: { [uid]: username },
    };
    dlog('Creating lobby', id, initial);
    await setDoc(ref, initial);
    dlog('Lobby created successfully:', id);
    setLobbyId(id);
  };

  /* JOIN LOBBY */
  const joinLobby = async (id) => {
    dlog('Joining lobby', id);
    const ref = doc(db, 'lobbies', id);
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Lobby does not exist');
      const lobby = snap.data();
      lobby.players.push(uid);
      lobby.ready[uid] = false;
      lobby.bets[uid] = 0;
      lobby.balances[uid] = 100;
      lobby.usernames[uid] = username;
      tx.update(ref, lobby);
    });
    dlog('Joined lobby successfully:', id);
    setLobbyId(id);
  };

  /* SET READY */
  const setReady = async (ready, betAmount) => {
    dlog('Setting ready state', lobbyId, uid, ready, betAmount);
    const ref = doc(db, 'lobbies', lobbyId);
    await updateDoc(ref, {
      [`ready.${uid}`]: ready,
      [`bets.${uid}`]: betAmount,
    });
    dlog('Ready state updated for', uid);
  };

  return {
    lobbyId,
    lobbyData,
    createLobby,
    joinLobby,
    setReady,
  };
}
