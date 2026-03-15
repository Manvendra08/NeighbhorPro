import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLa5-OsjK3iSTfHur4kKfRPJl9_fu8Pk0",
  authDomain: "neighbhorpro.firebaseapp.com",
  projectId: "neighbhorpro",
  storageBucket: "neighbhorpro.firebasestorage.app",
  messagingSenderId: "1078165325381",
  appId: "1:1078165325381:web:8cb8cc849068001ba0c52c",
  measurementId: "G-2YPP5GTF0B",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
