/**
 * Client Website Audit & Proposal Generator for Zonaed AI.
 * Analyzes active websites for conversion friction, messaging clarity, and SEO,
 * then generates an executive client audit and actionable growth proposal.
 */

import { readActiveTabPage } from '@/lib/chrome';

export type AuditFocus = 'complete_growth' | 'cro_funnel' | 'seo_content';
export type ProposalTier = 'starter' | 'growth' | 'custom';

export interface AuditProposalConfig {
  focus: AuditFocus;
  tier: ProposalTier;
  clientBudget?: string;
  customNotes?: string;
}

export const AUDIT_FOCUS_LABELS: Record<AuditFocus, string> = {
  complete_growth: 'Complete Growth & Conversion Audit (SEO + CRO + Messaging)',
  cro_funnel: 'Conversion Rate Optimization (CRO) & Funnel Friction',
  seo_content: 'SEO, Content Gaps & Organic Traffic Opportunities',
};

export const PROPOSAL_TIER_LABELS: Record<ProposalTier, string> = {
  starter: 'Sprint Package (1-2 Weeks Quick Wins)',
  growth: 'Monthly Growth Retainer (Continuous Optimization)',
  custom: 'Custom High-Ticket Transformation',
};

export function buildAuditProposalPrompt(
  page: { title: string; url: string; text: string },
  config: AuditProposalConfig,
): string {
  return `You are a Senior Conversion Strategist and Growth Director at a top-tier digital agency.
You are performing a comprehensive Client Website Audit and Growth Proposal for the business on this page.

WEBSITE DETAILS:
URL: ${page.url}
Title: ${page.title}
Page Content Extract:
${page.text.slice(0, 9000)}

AUDIT PARAMETERS:
- Primary Focus: ${AUDIT_FOCUS_LABELS[config.focus]}
- Proposal Scope Tier: ${PROPOSAL_TIER_LABELS[config.tier]}
${config.clientBudget ? `- Target Client Budget/Scale: ${config.clientBudget}` : ''}
${config.customNotes ? `- Specific Areas to Review: ${config.customNotes}` : ''}

WRITING RULES:
1. ZERO EM DASHES OR EN DASHES: Do NOT use em dashes (—) or en dashes (–). Use standard commas, colons, or simple bullet points.
2. PROFESSIONAL HUMAN TONE: Write directly to the founder or marketing head with objective, high-value consulting language.
3. AVOID ROBOTIC CLICHÉS: Do not use buzzwords like "delve", "testament", "tapestry", "embark", "furthermore", "moreover", "in conclusion", "beacon", "game-changer", "unleash".
4. ACCURATE & ACTIONABLE: Pinpoint specific copy, offer, and layout improvements directly from what is visible on their site.

STRUCTURE YOUR REPORT AS FOLLOWS:

# 📊 Website Growth Audit & Client Proposal

## 1. Executive Summary & Health Diagnosis
- Estimated Conversion Health Score (Out of 100)
- Overall First Impression & Value Proposition Clarity
- Primary Leak: Where they are losing potential customers right now

## 2. Critical Friction Points & Gaps Found
- Hero Section & Messaging (Is the benefit clear in 3 seconds?)
- Call-to-Action (CTA) & Friction (Are the buttons compelling or weak?)
- Trust & Social Proof (Are testimonials, logos, or case studies placed where buying decisions happen?)
- Content & SEO Overview (Keywords and clarity gaps)

## 3. Top 3 Quick-Win Growth Opportunities
- Opportunity 1 (Highest Impact, Lowest Effort)
- Opportunity 2
- Opportunity 3

## 4. Proposed Scope of Work & Action Plan
- Phase 1: Immediate Conversion & Messaging Fixes (Week 1-2)
- Phase 2: Traffic Acquisition & Funnel Acceleration (Week 3-4)
- Phase 3: Retention, Email Automation & Scaling (Month 2)

## 5. Deliverables & Expected ROI
- What the client receives
- Key performance metrics we will measure (Conversion Rate, Cost per Lead, ROAS)
- Next Steps to kick off

Generate the complete, ready-to-present audit and proposal now.`;
}
