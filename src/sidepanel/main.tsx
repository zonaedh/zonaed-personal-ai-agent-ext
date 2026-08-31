import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { SidePanelApp } from '@/sidepanel/App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SidePanelApp />);
}