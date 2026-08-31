import { AttachTabsDialog } from '@/components/tools/attach-tabs-dialog';
import { AuditDialog } from '@/components/tools/audit-dialog';
import { AutomateDialog } from '@/components/tools/automate-dialog';
import { FillFormDialog } from '@/components/tools/fill-form-dialog';
import { MarketingPlanDialog } from '@/components/tools/marketing-plan-dialog';
import { OcrDialog } from '@/components/tools/ocr-dialog';
import { OutreachDialog } from '@/components/tools/outreach-dialog';
import { RecipesDialog } from '@/components/tools/recipes-dialog';
import { ScrapeDialog } from '@/components/tools/scrape-dialog';
import { SocialDialog } from '@/components/tools/social-dialog';
import { SpyDialog } from '@/components/tools/spy-dialog';
import { WatchDialog } from '@/components/tools/watch-dialog';
import { WhatsAppDialog } from '@/components/tools/whatsapp-dialog';
import { YouTubeDialog } from '@/components/tools/youtube-dialog';

/** All tool dialogs, mounted once in the side panel. */
export function ToolDialogs() {
  return (
    <>
      <WhatsAppDialog />
      <YouTubeDialog />
      <MarketingPlanDialog />
      <AuditDialog />
      <SpyDialog />
      <OutreachDialog />
      <AttachTabsDialog />
      <OcrDialog />
      <ScrapeDialog />
      <FillFormDialog />
      <AutomateDialog />
      <SocialDialog />
      <RecipesDialog />
      <WatchDialog />
    </>
  );
}