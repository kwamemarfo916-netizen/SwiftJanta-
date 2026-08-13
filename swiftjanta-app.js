// swiftjanta-app.js
// Shared Firebase setup + helpers for every logged-in SwiftJanta page.
// Import what you need — this file does not render anything on its own.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, doc, onSnapshot, collection, query, where, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsc21SzOKkxIcGBfv0gAC5g4x-hZ7DQU0",
  authDomain: "swiftjanta-fcaf9.firebaseapp.com",
  projectId: "swiftjanta-fcaf9",
  storageBucket: "swiftjanta-fcaf9.firebasestorage.app",
  messagingSenderId: "515717504429",
  appId: "1:515717504429:web:89260041f7f353e4f3d524",
  measurementId: "G-SB86ZNN11Q"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Gates a page behind login + email verification (Google accounts are exempt —
// Google already verifies the email). Expects <div id="gate"> in the page;
// hides it and calls onReady(user) once confirmed, otherwise redirects to login.
export function requireAuth(onReady){
  const gate = document.getElementById('gate');
  onAuthStateChanged(auth, (user) => {
    const isGoogleUser = user && user.providerData.some(p => p.providerId === 'google.com');
    if (!user || (!user.emailVerified && !isGoogleUser)) {
      window.location.href = 'login.html';
      return;
    }
    if (gate) gate.hidden = true;
    onReady(user);
  });
}

// Live wallet balance — fires immediately and again on every change
// (e.g. once a Cloud Function credits or debits it).
export function watchBalance(uid, onChange){
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const data = snap.data();
    const balance = data && typeof data.walletBalance === 'number' ? data.walletBalance : 0;
    onChange(balance);
  }, () => onChange(0));
}

export function wireLogout(buttonId){
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  });
}

// Loads active plans for a given type ('bundle' | 'mashup' | 'sms') + network
// from the admin-managed products catalog, cheapest first.
export async function loadProducts(type, network){
  const q = query(
    collection(db, 'products'),
    where('type', '==', type),
    where('network', '==', network),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  items.sort((a, b) => (a.sellPriceGHS || 0) - (b.sellPriceGHS || 0));
  return items;
}

// Writes a pending order. This does NOT deduct the wallet or deliver anything —
// a Cloud Function is what should call Reloadly, then move this to
// completed/failed and adjust the balance. Client code only ever writes "pending".
export async function createOrder({ uid, productType, network, recipientPhone, amountGHS }){
  return addDoc(collection(db, 'orders'), {
    userId: uid, productType, network, recipientPhone, amountGHS,
    status: 'pending', createdAt: serverTimestamp()
  });
}

// Same idea for money transfers — pending only, a Cloud Function settles it.
export async function createTransfer({ uid, recipientPhone, network, amountGHS }){
  return addDoc(collection(db, 'transfers'), {
    senderId: uid, recipientPhone, network, amountGHS,
    status: 'pending', createdAt: serverTimestamp()
  });
}
