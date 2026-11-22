import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const missing = Object.values(firebaseConfig).some(v => !v || v.includes("COLOCA_AQUI"));
if (missing) console.warn("Configura primeiro o ficheiro firebase-config.js.");
export const firebaseConfigured = !missing;
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
