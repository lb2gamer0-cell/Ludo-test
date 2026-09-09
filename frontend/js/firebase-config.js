// Firebase Web SDK configuration for ludo-prime1
// measurementId is optional. Keep this config limited to public Firebase Web App values.
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDHGZJM5wezR3bRoxsldD8h1T100PWJeF0",
  authDomain: "ludo-prime1.firebaseapp.com",
  databaseURL: "https://ludo-prime1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ludo-prime1",
  storageBucket: "ludo-prime1.firebasestorage.app",
  messagingSenderId: "634974489555",
  appId: "1:634974489555:web:63f058ee33981fa1027d26",
  measurementId: "G-FCB44JVPTB"
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
