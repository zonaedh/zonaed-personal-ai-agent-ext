import { create } from 'zustand';
import { uid } from '@/lib/util';

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'error';
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push(kind: Toast['kind'], title: string, description?: string, ttlMs?: number): void;
  dismiss(id: string): void;
}

/** Minimal toast store; the <Toaster/> component (ui/toaster.tsx) renders it. */
export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push(kind, title, description, ttlMs) {
    const id = uid();
    set({ toasts: [...get().toasts, { id, kind, title, description }] });
    const ttl = ttlMs ?? (kind === 'error' ? 6000 : 3600);
    setTimeout(() => get().dismiss(id), ttl);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));