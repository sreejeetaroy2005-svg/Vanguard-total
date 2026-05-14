import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
apiKey: "AIzaSyBCyxGoENtjrfd5sAd-8FGohPSrMmHD4yU",
  authDomain: "vanguard-8b1e2.firebaseapp.com",
  databaseURL: "https://vanguard-8b1e2-default-rtdb.firebaseio.com",
  projectId: "vanguard-8b1e2",
  storageBucket: "vanguard-8b1e2.firebasestorage.app",
  messagingSenderId: "535323003689",
  appId: "1:535323003689:web:58d28bc75492eb88508538",
  measurementId: "G-DKQDWBW48R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);