/**
 * Google Sheets 1-Click Sync & Export Engine.
 * Converts markdown tables and structured text into Tab-Separated Values (TSV),
 * copies to clipboard, and activates/opens Google Sheets for instant grid paste.
 */

import { copyToClipboard } from '@/lib/util';

/**
 * Converts Markdown tables or bullet lists into clean Tab-Separated Values (TSV)
 * so that pasting into Google Sheets distributes data perfectly into cells.
 */
export function convertToTsv(markdown: string): string {
  const lines = markdown.split('\n');
  const tsvLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip markdown separator lines like |---|---|
    if (/^\|?(\s*:?-+:?\s*\|?)+$/.test(trimmed)) continue;

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim().replace(/\t/g, ' '));
      tsvLines.push(cells.join('\t'));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // Bullet items -> clean row
      tsvLines.push(trimmed.replace(/^[-*]\s+/, '').replace(/[—–]/g, ' - '));
    } else if (trimmed.startsWith('#')) {
      // Headers -> Section row
      tsvLines.push(trimmed.replace(/^#+\s+/, '').toUpperCase());
    } else if (trimmed.length > 0) {
      tsvLines.push(trimmed.replace(/[—–]/g, ' - '));
    } else {
      tsvLines.push('');
    }
  }

  return tsvLines.join('\n').trim();
}

/**
 * Exports formatted data to Google Sheets:
 * 1. Converts to TSV and copies to clipboard.
 * 2. Focuses open Google Sheet tab or opens https://sheets.new.
 */
export async function exportToGoogleSheets(content: string): Promise<{
  success: boolean;
  openedNew: boolean;
  sheetUrl: string;
}> {
  const tsv = convertToTsv(content);
  await copyToClipboard(tsv);

  const sheetTabs = await chrome.tabs.query({ url: '*://docs.google.com/spreadsheets/*' });
  const targetTab = sheetTabs.find((t) => t.id !== undefined);

  if (targetTab && targetTab.id !== undefined) {
    await chrome.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId !== undefined) {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    }
    return {
      success: true,
      openedNew: false,
      sheetUrl: targetTab.url ?? 'https://docs.google.com/spreadsheets',
    };
  }

  const newTab = await chrome.tabs.create({ url: 'https://sheets.new' });
  return {
    success: true,
    openedNew: true,
    sheetUrl: newTab.url ?? 'https://sheets.new',
  };
}
