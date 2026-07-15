/**
 * firebase-config.js — Firebase project configuration.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (e.g. "sanjay-trading-system")
 * 3. Add a Web App in Project Settings
 * 4. Copy your config values below
 * 5. Enable Authentication > Google sign-in provider
 * 6. Enable Firestore Database (start in test mode, then add rules below)
 * 
 * FIRESTORE SECURITY RULES (paste in Firebase Console > Firestore > Rules):
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId}/{document=**} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */

const firebaseConfig = {
    apiKey: "AIzaSyCEhWnuGY3av80RcflRIayJeKPUOyC3mX8",
    authDomain: "trading-journal-8412.firebaseapp.com",
    projectId: "trading-journal-8412",
    storageBucket: "trading-journal-8412.firebasestorage.app",
    messagingSenderId: "158195650040",
    appId: "1:158195650040:web:5caa757f3d7bd655279a0d",
    measurementId: "G-X1PS1B1J33"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
