/* client/src/hooks/useLobby.js */
import { useEffect, useState } from 'react';
import { runTransaction, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  getDatabase, ref as rtdbRef,     // alias so we don’t clash with Firestore’s ref
  onDisconnect, set as rtdbSet
}                                               from 'firebase/database';
import { initializeApp }                        from 'firebase/app';

import { db, firebaseConfig } from '../firebase/firebaseConfig';
import { createLobby as createLobbyHelper } from '../firebase/GameActions';


// ────────────────────────────────────────────────────────────────────────────
// Realtime Database presence setup  (called once per tab)
// ────────────────────────────────────────────────────────────────────────────
const rtdbApp  = initializeApp(firebaseConfig, 'presence');
const rtdb     = getDatabase(rtdbApp);

const PRESENCE_ROOT = 'lobbies';   // or 'presence'



/** Register a heartbeat node under `/lobbies/$lobbyId/$uid` that is removed
 *  by the backend when the websocket closes (tab refresh, close, connection drop).
 */
export function setupPresence(lobbyId, uid) {
  const presenceRef = rtdbRef(rtdb, `lobbies/${lobbyId}/${uid}`);
  // Mark this client present
  rtdbSet(presenceRef, { online: true });
  // Auto‑remove when the socket disconnects
  onDisconnect(presenceRef).remove();
}

// ────────────────────────────────────────────────────────────────────────────
// Lobby hook  (all the Firestore logic you already had)
// ────────────────────────────────────────────────────────────────────────────
export function useLobby(username, uid) {
  const [lobbyId, setLobbyId] = useState(null);
  const [lobbyData, setLobbyData] = useState(null);

  /* live listener on the lobby doc */
  useEffect(() => {
    if (!lobbyId) { setLobbyData(null); return; }
    const unsub = onSnapshot(doc(db, 'lobbies', lobbyId), snap => {
      setLobbyData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [lobbyId]);

  /* ───────────── public helpers ───────────── */
  const createLobby = async () => {
    const newLobbyId = await createLobbyHelper(db, {
      players: [uid],
      host: uid,
      ready: { [uid]: false },
      bets: { [uid]: 0 },
      balances: { [uid]: 100 },
      usernames: { [uid]: username || 'Player' },
      status: 'waiting',
    });
    setLobbyId(newLobbyId);
    const snap = await getDoc(doc(db, 'lobbies', newLobbyId));
    setLobbyData(snap.data());
  };

  const joinLobby = async code => {
    await runTransaction(db, async tx => {
      const ref  = doc(db, 'lobbies', code);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Lobby not found');
      const data = snap.data();
      if (data.players.includes(uid)) return;      // re‑joining same tab?
      tx.update(ref, {
        players  : [...data.players, uid],
        usernames: { ...data.usernames, [uid]: username },
        balances : { ...data.balances,  [uid]: 100 },
        bets     : { ...data.bets,      [uid]: 0 },
        ready    : { ...data.ready,     [uid]: false },
      });
    });
    setLobbyId(code);
  };

  const setReady = async (isReady, bet) => {
    if (!lobbyId) return;
    const docRef = doc(db, 'lobbies', lobbyId);
    await updateDoc(docRef, {
      [`ready.${uid}`]: isReady,
      [`bets.${uid}`]: bet,
    });
  };

  return {
    lobbyId,
    lobbyData,
    createLobby,
    joinLobby,
    setReady,
  };
}
