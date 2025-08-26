import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/coin-animation.css'
import './styles/jackpot-animations.css'
import { setupGlobalErrorHandling } from './lib/gameErrorHandler'

// Initialize global error handling
setupGlobalErrorHandling();

createRoot(document.getElementById("root")!).render(<App />);
