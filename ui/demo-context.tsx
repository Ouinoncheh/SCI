'use client';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { properties, type DemoProperty } from '@/data/demo';
import type { Investment } from '@/financial-engine';
import type { WorkspaceData } from './workspace-types';
import { api } from './http';
import type { PropertyDetails } from '../property-details';
type DemoState = {
  items: DemoProperty[];
  workspace?: WorkspaceData;
  persistent: boolean;
  canEdit: boolean;
  basePath: string;
  busy: boolean;
  error: string;
  clearError: () => void;
  toggleFavorite: (id: string) => Promise<void>;
  add: (p: DemoProperty) => Promise<string | null>;
  setStatus: (id: string, status: string) => Promise<void>;
  saveInvestment: (id: string, investment: Investment) => Promise<boolean>;
  saveDetails: (id: string, details: PropertyDetails, version?: number) => Promise<boolean>;
};
const Context = createContext<DemoState | null>(null);
export function DemoProvider({
  children,
  workspace,
}: {
  children: ReactNode;
  workspace?: WorkspaceData;
}) {
  const [items, setItems] = useState(workspace?.items ?? properties);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false);
  const endpoint = workspace?.sci ? `/api/workspace/scis/${workspace.sci.id}/properties` : null;
  async function mutate<T>(operation: () => Promise<T>): Promise<T | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      return await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function reload() {
    if (endpoint) setItems(await api<DemoProperty[]>(endpoint));
  }
  const value: DemoState = {
    items,
    workspace,
    persistent: Boolean(workspace),
    canEdit: !workspace || workspace.role === 'ADMIN' || workspace.role === 'MEMBER',
    basePath: workspace ? '/espace' : '',
    busy,
    error,
    clearError: () => setError(''),
    saveDetails: async (id, details, version) => {
      if (!workspace) {
        setItems((ps) =>
          ps.map((p) =>
            p.id === id
              ? { ...p, ...details, district: details.address || 'Adresse non renseignée' }
              : p,
          ),
        );
        return true;
      }
      if (!endpoint) return false;
      return (
        (await mutate(async () => {
          await api(`${endpoint}/${id}`, 'PATCH', { details, version });
          await reload();
          return true;
        })) ?? false
      );
    },
    toggleFavorite: async (id) => {
      const p = items.find((p) => p.id === id);
      if (!p) return;
      if (!workspace) {
        setItems((ps) => ps.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)));
        return;
      }
      if (!endpoint) return;
      await mutate(async () => {
        await api(`${endpoint}/${id}/favorite`, 'PUT', { favorite: !p.favorite });
        await reload();
      });
    },
    add: async (p) => {
      if (!workspace) {
        setItems((ps) => [...ps, p]);
        return p.id;
      }
      if (!endpoint) return null;
      return mutate(async () => {
        const result = await api<{ id: string }>(endpoint, 'POST', {
          title: p.title,
          city: p.city,
          postcode: p.postcode,
          rooms: p.rooms,
          dpe: p.dpe,
          description: p.description,
          address: p.address ?? undefined,
          listing: p.listing,
          investment: p.investment,
        });
        await reload();
        return result.id;
      });
    },
    setStatus: async (id, status) => {
      if (!workspace) {
        setItems((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
        return;
      }
      const p = items.find((p) => p.id === id);
      if (!p || !endpoint) return;
      await mutate(async () => {
        await api(`${endpoint}/${id}`, 'PATCH', { status, version: p.version });
        await reload();
      });
    },
    saveInvestment: async (id, investment) => {
      if (!workspace) {
        setItems((rows) => rows.map((p) => (p.id === id ? { ...p, investment } : p)));
        return true;
      }
      const p = items.find((p) => p.id === id);
      if (!p || !endpoint) return false;
      return (
        (await mutate(async () => {
          await api(`${endpoint}/${id}`, 'PATCH', { investment, version: p.version });
          await reload();
          return true;
        })) ?? false
      );
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDemo() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('DemoProvider missing');
  return ctx;
}
