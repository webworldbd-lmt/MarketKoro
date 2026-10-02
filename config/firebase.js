/**
 * Firebase Configuration for MarketKoro
 *
 * NOTE: Web config values (apiKey, authDomain, etc.) are public by design.
 * Security is enforced via Firestore Security Rules and Firebase Authentication.
 * NO server secrets or admin SDK credentials should ever be stored here.
 */

export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY_PLACEHOLDER",
  authDomain: "marketkoro-app.firebaseapp.com",
  projectId: "marketkoro-app",
  storageBucket: "marketkoro-app.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

/* Un-comment in Phase 2 when initializing Firebase SDK:
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
*/
