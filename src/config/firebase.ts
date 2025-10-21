import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCrOBniP7o6XaOgeZc_2VYASMRnOhirwQ",
  authDomain: "tyl-ai-coach-78ac7.firebaseapp.com",
  projectId: "tyl-ai-coach-78ac7",
  storageBucket: "tyl-ai-coach-78ac7.firebasestorage.app",
  messagingSenderId: "775616354831",
  appId: "1:775616354831:ios:6d258be4695409d5e2a17a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth }; 