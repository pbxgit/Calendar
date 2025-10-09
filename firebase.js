// Import Firebase modules from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    GoogleAuthProvider, 
    GithubAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    setDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
    authDomain: "calendar-pbx21.firebaseapp.com",
    projectId: "calendar-pbx21",
    storageBucket: "calendar-pbx21.firebasestorage.app",
    messagingSenderId: "304190482123",
    appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    measurementId: "G-YCNG7QXRR2"
};

// Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('Firebase initialized successfully');

// Auth providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Export for use in app.js
export {
    app,
    auth,
    db,
    googleProvider,
    githubProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setDoc,
    getDoc
};
