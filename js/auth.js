/**
 * auth.js — Handles Firebase Authentication (Google sign-in).
 * Manages login/logout state and shows/hides the app accordingly.
 */

const Auth = (() => {
    let currentUser = null;

    /** Get current authenticated user */
    function getUser() {
        return currentUser;
    }

    /** Get current user's UID (used as document path in Firestore) */
    function getUid() {
        return currentUser ? currentUser.uid : null;
    }

    /** Sign in with Google popup */
    function signIn() {
        const provider = new firebase.auth.GoogleAuthProvider();
        return auth.signInWithPopup(provider);
    }

    /** Sign out */
    function signOut() {
        return auth.signOut();
    }

    /** Initialize auth state listener */
    function init(onLogin, onLogout) {
        // Google sign-in button
        document.getElementById('btn-google-login').addEventListener('click', () => {
            signIn().catch(err => {
                console.error('Sign-in error:', err);
                alert('Sign-in failed: ' + err.message);
            });
        });

        // Logout button
        document.getElementById('nav-logout').addEventListener('click', () => {
            signOut();
        });

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            if (user) {
                // User signed in — hide login, show app
                document.getElementById('login-screen').classList.add('hidden');
                document.querySelector('.nav-bar').classList.remove('hidden');
                document.getElementById('app-content').classList.remove('hidden');
                if (onLogin) onLogin(user);
            } else {
                // User signed out — show login, hide app
                document.getElementById('login-screen').classList.remove('hidden');
                document.querySelector('.nav-bar').classList.add('hidden');
                document.getElementById('app-content').classList.add('hidden');
                if (onLogout) onLogout();
            }
        });
    }

    return { init, getUser, getUid, signIn, signOut };
})();
