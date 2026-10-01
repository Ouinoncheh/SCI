import type { DemoProperty } from '@/data/demo';
export type WorkspaceData = {
  user: { id: string; name: string; email: string };
  scis: { id: string; name: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }[];
  role: 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  sci: null | {
    id: string;
    name: string;
    capital: number;
    taxRegime: string;
    members: { id: string; role: string; shares: number; user: { name: string; email: string } }[];
    activities: { id: string; action: string; createdAt: string }[];
  };
  items: DemoProperty[];
};
