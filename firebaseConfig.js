import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWEggSHbP-3ynie4WhF82rYs3xq_JH0vg",
  authDomain: "tyl-ai-coach-78ac7.firebaseapp.com",
  projectId: "tyl-ai-coach-78ac7",
  storageBucket: "tyl-ai-coach-78ac7.firebasestorage.app",
  messagingSenderId: "775616354831",
  appId: "1:775616354831:web:ab286d3f21de50f0e2a17a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); 