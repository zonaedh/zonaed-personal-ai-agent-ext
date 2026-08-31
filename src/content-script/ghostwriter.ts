/**
 * Inline Floating Ghostwriter Copilot for Web Input Fields & Selections.
 * Injects a subtle floating "Z" icon near active inputs/selections.
 */

let ghostwriterEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let lastSelectedText = '';
let lastTargetElement: HTMLElement | null = null;

export function initGhostwriter() {
  if (typeof document === 'undefined') return;

  // Listen to selection changes
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  document.addEventListener('mousedown', (e) => {
    // Dismiss popup if clicked outside
    if (popupEl && !popupEl.contains(e.target as Node) && !ghostwriterEl?.contains(e.target as Node)) {
      hideGhostwriter();
    }
  });
}

function handleSelectionChange(e: MouseEvent | KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (popupEl?.contains(target) || ghostwriterEl?.contains(target)) return;

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || '';

  const isInput =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable;

  if (selectedText.length > 3 || (isInput && (target as any).value?.length > 10)) {
    lastSelectedText = selectedText || (target as any).value || target.innerText || '';
    lastTargetElement = target;

    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    let rect: DOMRect | null = null;

    if (range && selectedText.length > 0) {
      rect = range.getBoundingClientRect();
    } else if (isInput) {
      rect = target.getBoundingClientRect();
    }

    if (rect && rect.width > 0 && rect.height > 0) {
      showFloatingBadge(rect.left + rect.width / 2, rect.top - 8);
      return;
    }
  }

  // If selection cleared, hide
  if (!selectedText && !isInput) {
    hideGhostwriter();
  }
}

function showFloatingBadge(x: number, y: number) {
  if (!ghostwriterEl) {
    ghostwriterEl = document.createElement('div');
    ghostwriterEl.id = 'zonaed-ghostwriter-badge';
    ghostwriterEl.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #a855f7, #06b6d4);
      color: white;
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 900;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      cursor: pointer;
      user-select: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
      border: 1.5px solid rgba(255, 255, 255, 0.3);
    `;
    ghostwriterEl.innerText = 'Z';
    ghostwriterEl.title = 'Zonaed AI Ghostwriter';
    ghostwriterEl.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGhostwriterPopup();
    });
    document.body.appendChild(ghostwriterEl);
  }

  ghostwriterEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 38, x - 14))}px`;
  ghostwriterEl.style.top = `${Math.max(10, y - 32)}px`;
  ghostwriterEl.style.display = 'flex';
}

function hideGhostwriter() {
  if (ghostwriterEl) ghostwriterEl.style.display = 'none';
  if (popupEl) popupEl.style.display = 'none';
}

function toggleGhostwriterPopup() {
  if (!ghostwriterEl) return;

  if (popupEl && popupEl.style.display !== 'none') {
    popupEl.style.display = 'none';
    return;
  }

  if (!popupEl) {
    popupEl = document.createElement('div');
    popupEl.id = 'zonaed-ghostwriter-popup';
    popupEl.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      width: 220px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      color: #f8fafc;
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      font-size: 12px;
    `;
    document.body.appendChild(popupEl);
  }

  const badgeRect = ghostwriterEl.getBoundingClientRect();
  popupEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 230, badgeRect.left - 90))}px`;
  popupEl.style.top = `${badgeRect.bottom + 8}px`;

  popupEl.innerHTML = `
    <div style="font-size: 10px; font-weight: 700; color: #818cf8; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
      Zonaed AI Ghostwriter
    </div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <button class="zg-btn" data-action="polish" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; background: transparent; border: none; color: #e2e8f0; font-size: 11px; font-weight: 600; text-align: left; border-radius: 6px; cursor: pointer;">
        ✍️ Humanize &amp; Polish
      </button>
      <button class="zg-btn" data-action="reply" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; background: transparent; border: none; color: #e2e8f0; font-size: 11px; font-weight: 600; text-align: left; border-radius: 6px; cursor: pointer;">
        💬 Viral Reply / Comment
      </button>
      <button class="zg-btn" data-action="translate-en" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; background: transparent; border: none; color: #e2e8f0; font-size: 11px; font-weight: 600; text-align: left; border-radius: 6px; cursor: pointer;">
        🌐 Translate to English
      </button>
      <button class="zg-btn" data-action="translate-bn" style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; background: transparent; border: none; color: #e2e8f0; font-size: 11px; font-weight: 600; text-align: left; border-radius: 6px; cursor: pointer;">
        🇧🇩 Translate to Bengali
      </button>
    </div>
    <div id="zg-status" style="display: none; font-size: 10px; color: #a5b4fc; padding: 4px 8px; text-align: center;">
      Thinking...
    </div>
  `;

  // Hover styles
  popupEl.querySelectorAll('.zg-btn').forEach((b) => {
    b.addEventListener('mouseenter', () => {
      (b as HTMLElement).style.background = 'rgba(99, 102, 241, 0.2)';
      (b as HTMLElement).style.color = '#ffffff';
    });
    b.addEventListener('mouseleave', () => {
      (b as HTMLElement).style.background = 'transparent';
      (b as HTMLElement).style.color = '#e2e8f0';
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = (b as HTMLElement).getAttribute('data-action');
      if (action) void executeGhostwriterAction(action);
    });
  });

  popupEl.style.display = 'block';
}

async function executeGhostwriterAction(action: string) {
  if (!popupEl) return;
  const statusEl = popupEl.querySelector('#zg-status') as HTMLElement;
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerText = 'AI is writing... ✨';
  }

  // Ask background / sidepanel to process prompt
  try {
    let instruction = '';
    if (action === 'polish') {
      instruction = `Rewrite this text to be clearer, engaging, and polished with a natural human tone. Strictly avoid AI clichés like 'delve', 'testament', 'tapestry', 'embark', 'furthermore'. Return ONLY the rewritten text:\n\n${lastSelectedText}`;
    } else if (action === 'reply') {
      instruction = `Write an engaging, high-converting social comment/reply to this post/message. Sound like a knowledgeable human marketer with a positive insight. Return ONLY the comment:\n\n${lastSelectedText}`;
    } else if (action === 'translate-en') {
      instruction = `Translate this text into natural English. Return ONLY the translation:\n\n${lastSelectedText}`;
    } else if (action === 'translate-bn') {
      instruction = `Translate this text into natural Bengali (বাংলা). Return ONLY the translation:\n\n${lastSelectedText}`;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'GHOSTWRITER_REQUEST', prompt: instruction },
        (res) => {
          if (res?.text) {
            insertTextIntoElement(res.text);
          }
          hideGhostwriter();
        },
      );
    }
  } catch {
    hideGhostwriter();
  }
}

function insertTextIntoElement(text: string) {
  if (!lastTargetElement) {
    navigator.clipboard.writeText(text);
    return;
  }

  if (lastTargetElement instanceof HTMLInputElement || lastTargetElement instanceof HTMLTextAreaElement) {
    const start = lastTargetElement.selectionStart ?? 0;
    const end = lastTargetElement.selectionEnd ?? lastTargetElement.value.length;
    const val = lastTargetElement.value;
    lastTargetElement.value = val.slice(0, start) + text + val.slice(end);
    lastTargetElement.dispatchEvent(new Event('input', { bubbles: true }));
    lastTargetElement.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (lastTargetElement.isContentEditable) {
    lastTargetElement.focus();
    document.execCommand('insertText', false, text);
  } else {
    navigator.clipboard.writeText(text);
  }
}
