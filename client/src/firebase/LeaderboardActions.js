import { db } from './firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

export async function updateLeaderboard(uid, username, balance) {
  const leaderboardRef = collection(db, 'leaderboard');
  const userRef = doc(leaderboardRef, uid);

  // 🔍 Check existing score first
  const existingSnap = await getDoc(userRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;

  const existingBalance = existingData?.balance ?? 0;

  // ✅ Only update if new balance is higher than their old score
  if (balance > existingBalance) {
    await setDoc(userRef, { username, balance });
  }

  // 🧹 Fetch all and prune outside top 10
  const q = query(leaderboardRef, orderBy('balance', 'desc'));
  const snapshot = await getDocs(q);

  const docs = [];
  snapshot.forEach(docSnap => {
    docs.push({ id: docSnap.id, ...docSnap.data() });
  });

  const toRemove = docs.slice(10);
  const deletePromises = toRemove.map(item =>
    deleteDoc(doc(leaderboardRef, item.id))
  );

  await Promise.all(deletePromises);
}
