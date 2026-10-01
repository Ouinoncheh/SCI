import type { Investment } from '../financial-engine';
export const voteLabels = {
  FAVORABLE: 'Favorable',
  TO_STUDY: 'À étudier',
  UNFAVORABLE: 'Défavorable',
} as const;
export type VoteChoice = keyof typeof voteLabels;
export type CollaborationData = {
  comments: { id: string; body: string; createdAt: string; author: string; mentions: string[] }[];
  nextCursor: string | null;
  votes: { memberId: string; name: string; choice: VoteChoice }[];
  members: { id: string; name: string }[];
  currentMemberId: string;
  activities: { id: string; action: string; createdAt: string; actor: string | null }[];
};
export type AnalysisHistory = {
  entries: {
    id: string;
    createdAt: string;
    engineVersion: string;
    inputs: Investment | null;
    metrics: { totalCost: number; cashFlowMonthly: number; netYield: number } | null;
  }[];
  nextCursor: string | null;
};
export type NotificationsData = {
  entries: { id: string; body: string; readAt: string | null; createdAt: string }[];
  nextCursor: string | null;
  unread: number;
};
