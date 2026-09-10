// Firebase Web SDK configuration for ludo-prime1
// measurementId is optional. Keep this config limited to public Firebase Web App values.
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCfHxlNeJfaYk-O3Mk14Vo_Ygn-WvpIWZY",
  authDomain: "test-9a5e3.firebaseapp.com",
  projectId: "test-9a5e3",
  storageBucket: "test-9a5e3.firebasestorage.app",
  messagingSenderId: "169564541912",
  appId: "1:169564541912:web:6ab66c8fd164f490bbd8ad",
  measurementId: "G-4YTG0FXLWY"
};


let auth = null;
let googleProvider = null;
let facebookProvider = null;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        googleProvider = new firebase.auth.GoogleAuthProvider();
        facebookProvider = new firebase.auth.FacebookAuthProvider();

        // Account picker and email scope.
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        facebookProvider.addScope('email');

        // Keep the Firebase session available after page/app restarts.
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
            console.warn('Firebase persistence setup failed:', e);
        });

        console.log('Firebase Auth initialized successfully:', firebaseConfig.projectId);
    }
} catch (e) {
    console.error('Firebase Auth Init Error:', e);
}
