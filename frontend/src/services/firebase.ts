// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAKLl-xBUIOIfxwFvmwOj5NHr85Q8u4mXo",
  authDomain: "e-force-bot.firebaseapp.com",
  projectId: "e-force-bot",
  storageBucket: "e-force-bot.firebasestorage.app",
  messagingSenderId: "255667053401",
  appId: "1:255667053401:web:57effd8fc3b362fb2aa248",
  measurementId: "G-3MVJKTS2P1"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Analytics conditionally (handles environments where IndexedDB/cookies are disabled like WebViews)
export let analytics: any = null;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized successfully");
    }
  }).catch((err) => {
    console.warn("Firebase Analytics not supported in this environment:", err.message);
  });
}
