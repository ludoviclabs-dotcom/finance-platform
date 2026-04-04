'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { NeuralStore, getNeuralStore } from './store';
import { NeuralGlobalParams, NeuralComputedResults, InterAgentDataFlow } from './types';

interface NeuralContextValue {
  params: NeuralGlobalParams;
  results: NeuralComputedResults;
  flow: InterAgentDataFlow;
  store: NeuralStore;
  isHydrated: boolean;
}

const NeuralContext = createContext<NeuralContextValue | null>(null);

export function NeuralProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => getNeuralStore());
  const [, tick] = useState(0);

  // Subscribe to store changes
  useEffect(() => {
    return store.subscribe(() => tick(n => n + 1));
  }, [store]);

  // Fetch real Excel data on mount (once)
  useEffect(() => {
    if (store.isHydrated()) return;

    fetch('/api/data')
      .then(res => {
        if (!res.ok) throw new Error(`API /api/data returned ${res.status}`);
        return res.json();
      })
      .then(data => {
        store.hydrateFromExcel(data);
      })
      .catch(err => {
        console.warn('Failed to load Excel data, using defaults:', err);
      });
  }, [store]);

  const value = useMemo<NeuralContextValue>(() => ({
    params: store.getParams(),
    results: store.computeResults(),
    flow: store.getInterAgentFlow(),
    store,
    isHydrated: store.isHydrated(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [store, tick]);

  return <NeuralContext.Provider value={value}>{children}</NeuralContext.Provider>;
}

export function useNeural(): NeuralContextValue {
  const ctx = useContext(NeuralContext);
  if (!ctx) throw new Error('useNeural doit être utilisé dans un NeuralProvider');
  return ctx;
}
