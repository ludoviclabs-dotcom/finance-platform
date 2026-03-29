'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { NeuralStore, getNeuralStore } from './store';
import { NeuralGlobalParams, NeuralComputedResults, InterAgentDataFlow } from './types';

interface NeuralContextValue {
  params: NeuralGlobalParams;
  results: NeuralComputedResults;
  flow: InterAgentDataFlow;
  store: NeuralStore;
}

const NeuralContext = createContext<NeuralContextValue | null>(null);

export function NeuralProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => getNeuralStore());
  const [, tick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => tick(n => n + 1));
  }, [store]);

  const value = useMemo<NeuralContextValue>(() => ({
    params: store.getParams(),
    results: store.computeResults(),
    flow: store.getInterAgentFlow(),
    store,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [store, tick]);

  return <NeuralContext.Provider value={value}>{children}</NeuralContext.Provider>;
}

export function useNeural(): NeuralContextValue {
  const ctx = useContext(NeuralContext);
  if (!ctx) throw new Error('useNeural doit être utilisé dans un NeuralProvider');
  return ctx;
}
