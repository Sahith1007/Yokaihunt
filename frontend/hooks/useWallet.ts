"use client";

import { useEffect, useState, useCallback } from "react";
import { walletManager } from "../lib/wallet";

export type WalletState = {
  address: string | null;
  connected: boolean;
  connector: string | null;
};

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connector: null,
  });

  // Initialize wallet manager on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    walletManager.initialize();
    
    // Auto-restore session if previously connected
    const restoreSession = () => {
      const address = walletManager.getAddress();
      const connector = walletManager.getActiveProvider();
      const connected = walletManager.isConnected();

      if (connected && address) {
        setState({ address, connected, connector });
        console.log("Restored wallet session:", address);
      }
    };

    restoreSession();

    // Listen for wallet state changes
    const checkInterval = setInterval(() => {
      const address = walletManager.getAddress();
      const connector = walletManager.getActiveProvider();
      const connected = walletManager.isConnected();

      setState((prev) => {
        if (prev.address !== address || prev.connected !== connected) {
          return { address, connected, connector };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const connect = useCallback(async (providerId: string) => {
    const address = await walletManager.connect(providerId);
    if (address) {
      setState({
        address,
        connected: true,
        connector: providerId,
      });
    }
    return address;
  }, []);

  const disconnect = useCallback(async () => {
    await walletManager.disconnect();
    setState({
      address: null,
      connected: false,
      connector: null,
    });
  }, []);

  const formatAddress = useCallback((addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }, []);

  return {
    address: state.address,
    connected: state.connected,
    connector: state.connector,
    connect,
    disconnect,
    formatAddress,
  };
}
