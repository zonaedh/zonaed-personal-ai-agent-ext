import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { PopupApp } from '@/popup/App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<PopupApp />);
}