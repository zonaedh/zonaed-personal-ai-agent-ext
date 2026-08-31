import { useEffect, useState } from 'react';
import { listProfiles, type StoredProfile } from '@/db/db';
import { detectFormFields, fillFormFields, getActiveTab } from '@/lib/chrome';
import type { FormFieldInfo } from '@/shared/types';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

/**
 * Form autofill (Phase 3): pick a saved profile, optionally preview the page's
 * visible form fields, fill by matching field name/label/placeholder to keys.
 */
export function FillFormDialog() {
  const open = useToolsStore((s) => s.active) === 'fill';
  const close = useToolsStore((s) => s.close);

  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [profileId, setProfileId] = useState<string>('');
  const [fields, setFields] = useState<FormFieldInfo[] | null>(null);
  const [result, setResult] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listProfiles().then((ps) => {
      setProfiles(ps);
      setProfileId(ps[0]?.id !== undefined ? String(ps[0].id) : '');
    });
  }, [open]);

  const fill = async () => {
    const profile = profiles.find((p) => String(p.id) === profileId);
    if (!profile) {
      useToastStore.getState().push('error', 'No profile selected', 'Create one in Settings → Profiles.');
      return;
    }
    setBusy(true);
    try {
      const tab = await getActiveTab();
      if (tab.id === undefined) throw new Error('This tab cannot be scripted.');
      const res = await fillFormFields(tab.id, profile.fields);
      setResult(res.log);
      useToastStore.getState().push(
        res.ok ? 'success' : 'error',
        res.ok ? `Filled ${String((res.data as { filled?: number } | undefined)?.filled ?? '?')} field(s)` : 'No matching fields',
        res.ok ? undefined : 'No page fields matched this profile.',
      );
    } catch (err) {
      useToastStore.getState().push('error', 'Fill failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="Fill form from profile"
      description="Match page fields to a locally-saved profile by name / label / placeholder."
    >
      <div className="flex flex-col gap-3">
        {profiles.length === 0 ? (
          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            No profiles yet. Create one in <strong>Settings → Profiles</strong> with keys
            like “name”, “email”, “phone”, “address”.
          </p>
        ) : (
          <>
            <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({p.fields.length} fields)
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  void getActiveTab().then(async (t) => {
                    if (t.id === undefined) return;
                    setFields(await detectFormFields(t.id));
                    setResult(null);
                  })
                }
              >
                Detect fields
              </Button>
              <Button className="flex-1" onClick={() => void fill()} disabled={busy}>
                {busy ? 'Filling…' : 'Fill form'}
              </Button>
            </div>
            {fields ? (
              <div className="scroll-area max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
                {fields.map((f, i) => (
                  <p key={i} className="truncate py-0.5">
                    <span className="font-medium">{f.label || f.name || f.selector}</span>{' '}
                    <span className="text-muted-foreground">({f.type})</span>
                  </p>
                ))}
                {fields.length === 0 ? (
                  <p className="p-1 text-muted-foreground">No visible form fields found.</p>
                ) : null}
              </div>
            ) : null}
            {result ? (
              <div className="scroll-area max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
                {result.map((l, i) => (
                  <p key={i} className="py-0.5">
                    {l}
                  </p>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </ToolDialog>
  );
}