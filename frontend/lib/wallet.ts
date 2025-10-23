"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProviderId = "pera" | "myalgo" | "defly";

type WalletState = {
  address: string | null;
  provider: ProviderId | null;
  connected: boolean;
};

const LS_ADDR = "algorand_address";
const LS_PROVIDER = "algorand_provider";

async function connectWithPera(): Promise<string | null> {
  try {
    const mod: any = await import("@perawallet/connect");
    const PeraWalletConnect = mod.default || mod.PeraWalletConnect || mod;
    const pera = new PeraWalletConnect();
    // try reconnect
    const existing = await pera.reconnectSession().catch(() => null);
    if (existing && existing.length) return existing[0];
    const accounts: string[] = await pera.connect();
    return accounts?.[0] || null;
  } catch (e) {
    console.warn("Pera connect failed", e);
    return null;
  }
}

async function connectWithMyAlgo(): Promise<string | null> {
  try {
    const mod: any = await import("@randlabs/myalgo-connect");
    const MyAlgoConnect = mod.default || mod;
    const myalgo = new MyAlgoConnect();
    const res = await myalgo.connect({ shouldSelectOneAccount: true });
    const addr = res?.addresses?.[0] || res?.accounts?.[0]?.address || null;
    return addr || null;
  } catch (e) {
    console.warn("MyAlgo connect failed", e);
    return null;
  }
}

async function connectWithDefly(): Promise<string | null> {
  try {
    const mod: any = await import("@blockshake/defly-connect");
    const DeflyWalletConnect = mod.default || mod.DeflyWalletConnect || mod;
    const defly = new DeflyWalletConnect();
    const accounts: string[] = await defly.connect();
    return accounts?.[0] || null;
  } catch (e) {
    console.warn("Defly connect failed", e);
    return null;
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    if (typeof window === "undefined") return { address: null, provider: null, connected: false };
    const address = window.localStorage.getItem(LS_ADDR);
    const provider = (window.localStorage.getItem(LS_PROVIDER) as ProviderId | null) || null;
    return { address, provider, connected: !!address };
  });

  const setConnected = useCallback((address: string | null, provider: ProviderId | null) => {
    setState({ address, provider, connected: !!address });
    if (address && provider) {
      window.localStorage.setItem(LS_ADDR, address);
      window.localStorage.setItem(LS_PROVIDER, provider);
      console.log("Connected wallet:", address);
    } else {
      window.localStorage.removeItem(LS_ADDR);
      window.localStorage.removeItem(LS_PROVIDER);
    }
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!state.address && state.provider) {
        let addr: string | null = null;
        if (state.provider === "pera") addr = await connectWithPera();
        else if (state.provider === "myalgo") addr = await connectWithMyAlgo();
        else if (state.provider === "defly") addr = await connectWithDefly();
        if (mounted && addr) setConnected(addr, state.provider);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const connectWith = useCallback(async (provider: ProviderId) => {
    let addr: string | null = null;
    if (provider === "pera") addr = await connectWithPera();
    else if (provider === "myalgo") addr = await connectWithMyAlgo();
    else if (provider === "defly") addr = await connectWithDefly();
    if (addr) setConnected(addr, provider);
    return addr;
  }, [setConnected]);

  const disconnect = useCallback(async () => {
    setConnected(null, null);
  }, [setConnected]);

  const formatAddr = useCallback((addr: string) => (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : ""), []);

  return { address: state.address, provider: state.provider, connected: state.connected, connectWith, disconnect, formatAddr };
}

export type { ProviderId };
