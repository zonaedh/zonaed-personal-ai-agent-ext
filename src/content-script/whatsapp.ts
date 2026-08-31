/**
 * WhatsApp Web Lead Extraction & Safe DOM Message Dispatcher.
 * Operates client-side on https://web.whatsapp.com/*.
 */
import type { WhatsAppLead } from '@/shared/whatsapp-types';

export function isWhatsAppWeb(): boolean {
  return window.location.hostname.includes('web.whatsapp.com');
}

/**
 * Extract all visible / scrollable leads and contacts from WhatsApp Web's chatlist.
 */
export async function extractWhatsAppChatlistLeads(): Promise<WhatsAppLead[]> {
  if (!isWhatsAppWeb()) {
    throw new Error('Please open WhatsApp Web (web.whatsapp.com) to extract leads.');
  }

  const leadsMap = new Map<string, WhatsAppLead>();

  // 1. Locate the chat pane container
  const paneSide =
    document.querySelector('#pane-side') ||
    document.querySelector('div[aria-label="Chat list"]') ||
    document.querySelector('div[role="grid"]');

  if (!paneSide) {
    throw new Error('WhatsApp Web chat list not found. Make sure you are logged in.');
  }

  // Helper to extract currently visible rows
  const parseVisibleRows = () => {
    // Find all chat list items
    const rows = paneSide.querySelectorAll(
      'div[role="listitem"], div[role="row"], div[tabindex="-1"], div._ak72, div.x10l6tqk',
    );

    rows.forEach((row) => {
      // Find contact name or phone number
      const titleEl =
        row.querySelector('span[title]') ||
        row.querySelector('span[dir="auto"].x1lliihq') ||
        row.querySelector('span.x1c4vz4f');

      const rawTitle = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
      if (!rawTitle || rawTitle.toLowerCase().includes('archived')) return;

      // Extract phone number if title looks like a phone number, or detect clean format
      const isPhoneLike = /^[+]?[0-9\s\-()]{7,}$/.test(rawTitle);
      const cleanPhone = isPhoneLike ? rawTitle.replace(/[^\d+]/g, '') : undefined;
      const id = cleanPhone || rawTitle;

      // Find last message preview
      const msgSpans = row.querySelectorAll('span[dir="ltr"], span.x1lliihq');
      let lastMsg = '';
      msgSpans.forEach((s) => {
        const text = s.textContent?.trim() || '';
        if (text && text !== rawTitle && text.length > lastMsg.length) {
          lastMsg = text;
        }
      });

      // Find timestamp
      const timeEl = row.querySelector('div.x1c4vz4f, div._ak8i, span.x1rg5ohu');
      const time = timeEl?.textContent?.trim() || '';

      // Find unread count/badge
      const unreadEl = row.querySelector(
        'span[aria-label*="unread"], span._ak8q, span.x1n2onr6[aria-label]',
      );
      const isUnread = Boolean(unreadEl);
      const unreadCount = unreadEl ? parseInt(unreadEl.textContent || '1', 10) || 1 : 0;

      if (!leadsMap.has(id)) {
        leadsMap.set(id, {
          id,
          name: rawTitle,
          phone: cleanPhone,
          lastMessage: lastMsg.slice(0, 150),
          time,
          isUnread,
          unreadCount,
          status: isUnread ? 'new' : 'contacted',
          extractedAt: Date.now(),
        });
      }
    });
  };

  // Initial parse
  parseVisibleRows();

  // Smooth micro-scroll passes to collect virtualized rows
  const scrollHeight = paneSide.scrollHeight;
  const clientHeight = paneSide.clientHeight;
  const steps = Math.min(6, Math.ceil(scrollHeight / (clientHeight || 600)));

  for (let i = 1; i <= steps; i++) {
    paneSide.scrollTop = (scrollHeight / steps) * i;
    await new Promise((r) => setTimeout(r, 250));
    parseVisibleRows();
  }

  // Restore scroll to top
  paneSide.scrollTop = 0;

  return Array.from(leadsMap.values());
}

/**
 * Type and send a message into the currently open WhatsApp chat.
 */
export async function sendWhatsAppChatMessage(text: string): Promise<boolean> {
  if (!isWhatsAppWeb()) return false;

  // Locate the input box
  const inputBox =
    (document.querySelector('footer div[contenteditable="true"]') as HTMLElement) ||
    (document.querySelector('div[data-tab="10"][contenteditable="true"]') as HTMLElement) ||
    (document.querySelector('div[aria-placeholder="Type a message"]') as HTMLElement);

  if (!inputBox) {
    throw new Error('WhatsApp message input box not found. Please open a chat first.');
  }

  // Focus and insert text
  inputBox.focus();
  document.execCommand('selectAll', false, undefined);
  document.execCommand('delete', false, undefined);

  // Dispatch human-like text input
  const success = document.execCommand('insertText', false, text);
  if (!success) {
    inputBox.innerText = text;
  }
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));

  await new Promise((r) => setTimeout(r, 300));

  // Find send button
  const sendBtn =
    (document.querySelector('button[aria-label="Send"]') as HTMLElement) ||
    (document.querySelector('span[data-icon="send"]')?.closest('button') as HTMLElement) ||
    (document.querySelector('button span[data-icon="send"]')?.parentElement as HTMLElement);

  if (sendBtn) {
    sendBtn.click();
    return true;
  }

  // Fallback: Press Enter key
  inputBox.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
    }),
  );
  return true;
}

/**
 * Open a specific chat by clicking on its contact title in the chat list.
 */
export async function openWhatsAppChatByName(nameOrPhone: string): Promise<boolean> {
  if (!isWhatsAppWeb()) return false;

  const paneSide =
    document.querySelector('#pane-side') ||
    document.querySelector('div[aria-label="Chat list"]');
  if (!paneSide) return false;

  // Search through contact titles
  const titles = paneSide.querySelectorAll('span[title], span[dir="auto"]');
  for (const el of Array.from(titles)) {
    const text = el.getAttribute('title') || el.textContent?.trim() || '';
    if (text.toLowerCase() === nameOrPhone.toLowerCase() || (text && nameOrPhone.includes(text))) {
      (el.closest('div[role="listitem"], div[role="row"], div[tabindex="-1"]') as HTMLElement)?.click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }
  }

  return false;
}
