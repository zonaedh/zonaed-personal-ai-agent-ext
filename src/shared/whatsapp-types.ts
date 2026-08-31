/**
 * Shared types for WhatsApp Web Lead Extraction & Safe Follow-Up Automation.
 */

export interface WhatsAppLead {
  id: string;
  name: string;
  phone?: string;
  lastMessage?: string;
  time?: string;
  isUnread?: boolean;
  unreadCount?: number;
  status: 'new' | 'contacted' | 'interested' | 'replied' | 'converted';
  tags?: string[];
  extractedAt: number;
}

export interface WhatsAppQueueItem {
  id: string;
  leadId: string;
  name: string;
  phone?: string;
  customMessage: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'paused';
  scheduledDelaySec: number;
  sentAt?: number;
  error?: string;
}

export interface WhatsAppFollowUpConfig {
  baseMessage: string;
  enableAiSpintax: boolean;
  minDelaySec: number;
  maxDelaySec: number;
  batchSize: number;
  batchPauseMinutes: number;
}

export interface WhatsAppAutoResponderConfig {
  enabled: boolean;
  businessContext: string;
  meetingLink: string;
  pricingNotes: string;
  triggerMode: 'unread_all' | 'keywords';
  triggerKeywords: string[];
  cooldownHours: number;
  minDelaySec: number;
  maxDelaySec: number;
}

export interface WhatsAppAutoReplyLog {
  id: string;
  leadName: string;
  leadPhone?: string;
  incomingMessage: string;
  replyMessage: string;
  timestamp: number;
  status: 'sent' | 'failed' | 'skipped_cooldown';
}

