import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Write the user’s best‑ever balance to the “leaderboard” collection.
 * If they already have an entry, only overwrites when the new balance is higher.
 */
export const updateLeaderboard = async (uid, username, balance) => {
  if (!uid || !username) return;          // nothing to do

  const ref = doc(db, 'leaderboard', uid);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() ? snap.data().balance : 0;

      if (balance > prev) {
        tx.set(ref, { username, balance });   // ← overwrite with new high‑score
      }
    });
  } catch (err) {
    console.error('updateLeaderboard failed:', err);
  }
};
