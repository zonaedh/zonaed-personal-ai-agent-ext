import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { OptionsApp } from '@/options/App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<OptionsApp />);
}