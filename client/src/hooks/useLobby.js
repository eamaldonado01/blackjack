// path: blackback/client/src/hooks/useLobby.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';

export function useLobby(username) {
  const [lobbyId, setLobbyId] = useState(null);
  const [lobbyData, setLobbyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create a new lobby
  const createLobby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'lobbies'), {
        hostId: username,
        players: [{ id: username, username, seat: 0 }],
        gameState: {},
        isActive: false,
        createdAt: serverTimestamp()
      });
      setLobbyId(docRef.id);
      console.log('Lobby created with ID:', docRef.id);
    } catch (e) {
      console.error('Error creating lobby:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Join an existing lobby by ID
  const joinLobby = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const lobbyRef = doc(db, 'lobbies', id);
      await updateDoc(lobbyRef, {
        players: arrayUnion({ id: username, username })
      });
      setLobbyId(id);
      console.log('Joined lobby:', id);
    } catch (e) {
      console.error('Error joining lobby:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Listen for lobby updates
  useEffect(() => {
    if (!lobbyId) return;

    const unsub = onSnapshot(doc(db, 'lobbies', lobbyId), (docSnap) => {
      if (docSnap.exists()) {
        setLobbyData(docSnap.data());
      } else {
        console.warn('Lobby no longer exists');
        setLobbyData(null);
      }
    });

    return () => unsub();
  }, [lobbyId]);

  return {
    lobbyId,
    lobbyData,
    loading,
    error,
    createLobby,
    joinLobby
  };
}
