import ReactDOM from 'react-dom/client';
import App from './App';
import { store } from './game/store';
import './index.css';

// Development only: inspect the colony from the browser console.
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;

// StrictMode is intentionally off: its double-mount would boot two Phaser/WebGL contexts in dev.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
