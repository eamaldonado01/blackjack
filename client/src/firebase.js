// path: blackback/client/src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';


// blackjack Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAirwRItdKlcMsEWjQ5aNSZ4toeUAwOevg",
  authDomain: "blackjack-52623.firebaseapp.com",
  projectId: "blackjack-52623",
  storageBucket: "blackjack-52623.firebasestorage.app",
  messagingSenderId: "503128417986",
  appId: "1:503128417986:web:f015f46e337ef9953cbd5b",
  measurementId: "G-VRNGTWMWLY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export { db };