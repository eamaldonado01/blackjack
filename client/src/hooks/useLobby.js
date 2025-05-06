/* client/src/hooks/useLobby.js */
import { useEffect, useState, useRef }          from 'react';
import {
  collection, doc, onSnapshot, setDoc,
  addDoc, updateDoc, runTransaction, deleteDoc
}                                               from 'firebase/firestore';
import {
  getDatabase, ref as rtdbRef,     // alias so we don’t clash with Firestore’s ref
  onDisconnect, set as rtdbSet
}                                               from 'firebase/database';
import { initializeApp }                        from 'firebase/app';

import { db }                                   from '../firebase/firebaseConfig';   // Firestore
import { firebaseConfig } from '../firebase/firebaseConfig';


// ────────────────────────────────────────────────────────────────────────────
// Realtime Database presence setup  (called once per tab)
// ────────────────────────────────────────────────────────────────────────────
const rtdbApp  = initializeApp(firebaseConfig, 'presence');
const rtdb     = getDatabase(rtdbApp);

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
  const [lobbyId , setLobbyId ] = useState(null);
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
    const lobbyDoc = await addDoc(collection(db, 'lobbies'), {
      host     : uid,
      players  : [uid],
      usernames: { [uid]: username },
      balances : { [uid]: 100 },
      bets     : { [uid]: 0 },
      ready    : { [uid]: false },
      status   : 'waiting',
    });
    setLobbyId(lobbyDoc.id);
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

  const setReady = async (isReady, bet = 0) => {
    if (!lobbyId) return;
    await updateDoc(doc(db, 'lobbies', lobbyId), {
      [`ready.${uid}`]: isReady,
      [`bets.${uid}`] : bet,
    });
  };

  return { lobbyId, lobbyData, createLobby, joinLobby, setReady };
}
