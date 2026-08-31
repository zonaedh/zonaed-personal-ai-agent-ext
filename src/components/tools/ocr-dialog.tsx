import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { captureVisibleTab } from '@/lib/chrome';
import { ocrImage, ocrAvailable } from '@/lib/ocr';
import { copyToClipboard } from '@/lib/util';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/input';

const LANGS = ['eng', 'deu', 'fra', 'spa', 'ita', 'por', 'nld', 'rus', 'jpn', 'chi_sim'];

/**
 * OCR (Phase 2): capture the visible viewport (activeTab), run tesseract.js
 * fully offline, then attach the extracted text as context or copy it.
 */
export function OcrDialog() {
  const open = useToolsStore((s) => s.active) === 'ocr';
  const close = useToolsStore((s) => s.close);
  const addContextSlot = useChatStore((s) => s.addContextSlot);

  const [lang, setLang] = useState('eng');
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const capture = async () => {
    setCapturing(true);
    try {
      const dataUrl = await captureVisibleTab();
      setImage(dataUrl);
      setText('');
    } catch (err) {
      useToastStore.getState().push(
        'error',
        'Capture failed',
        err instanceof Error ? err.message : 'Click the extension icon once to grant this tab access, then retry.',
      );
    } finally {
      setCapturing(false);
    }
  };

  const runOcr = async () => {
    if (!image) return;
    setRecognizing(true);
    setProgress(0);
    try {
      const availability = await ocrAvailable([lang]);
      if (!availability.ok) {
        useToastStore
          .getState()
          .push('error', `Language data missing: ${availability.missing.join(', ')}`,
            'Run `node scripts/fetch-tessdata.mjs ' + availability.missing.join(' ') + '` and rebuild.');
        return;
      }
      const result = await ocrImage(image, lang, (p, s) => {
        setProgress(p);
        setStatus(s);
      });
      setText(result);
    } catch (err) {
      useToastStore.getState().push('error', 'OCR failed', err instanceof Error ? err.message : String(err));
    } finally {
      setRecognizing(false);
    }
  };

  const attach = async () => {
    if (!text.trim()) return;
    await addContextSlot({
      kind: 'image',
      label: 'OCR result',
      content: text,
      addedAt: Date.now(),
    });
    useToastStore.getState().push('success', 'OCR text attached', 'It will be used as context for your next message.');
    close();
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="Screenshot OCR"
      description="Capture the visible part of the current tab and extract its text — processed 100% locally."
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Select value={lang} onChange={(e) => setLang(e.target.value)} className="w-40">
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Button className="flex-1" onClick={() => void capture()} loading={capturing}>
            <Camera className="h-4 w-4" /> Capture visible tab
          </Button>
        </div>

        {image ? (
          <img src={image} alt="Captured screenshot preview" className="max-h-40 rounded-md border object-contain" />
        ) : null}

        {image ? (
          <Button onClick={() => void runOcr()} disabled={recognizing} variant="secondary">
            {recognizing ? <Loader2 className="animate-spin" /> : null}
            {recognizing ? `Recognizing… ${Math.round(progress * 100)}% ${status}` : 'Extract text'}
          </Button>
        ) : null}

        {text ? (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="text-xs" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void copyToClipboard(text).then((ok) => ok && useToastStore.getState().push('success', 'Copied'))}>
                Copy
              </Button>
              <Button onClick={() => void attach()}>Attach as context</Button>
            </div>
          </>
        ) : null}
      </div>
    </ToolDialog>
  );
}