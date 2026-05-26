import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgVh9fmwib7ox-I1Q9c5IU-B4909XkhkU",
  authDomain: "svl-app-65204.firebaseapp.com",
  projectId: "svl-app-65204",
  storageBucket: "svl-app-65204.firebasestorage.app",
  messagingSenderId: "512772798709",
  appId: "1:512772798709:web:d28cb5154b15fccae26dbc",
  measurementId: "G-XYZMESKJRM"
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});
