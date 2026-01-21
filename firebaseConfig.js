import { initializeApp } from "firebase/app";
// ASYNC STORAGE EKLENTİSİ (BU İKİ SATIR YENİ)
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBubz3Sqv8qKnHZvN2nJSewaVKXqL94qrw",
  authDomain: "virasocial-c7263.firebaseapp.com",
  projectId: "virasocial-c7263",
  storageBucket: "virasocial-c7263.firebasestorage.app",
  messagingSenderId: "287273538802",
  appId: "1:287273538802:web:fe90981f04c87d53202c6b",
  measurementId: "G-E6RWQRCH9L"
};
// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// AUTH KISMINI BU ŞEKİLDE GÜNCELLİYORUZ (BU ÇOK ÖNEMLİ)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);