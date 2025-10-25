"use client";

import { WalletManager } from "@txnlab/use-wallet";
import { DeflyWalletConnect } from "@blockshake/defly-connect";
import { PeraWalletConnect } from "@perawallet/connect";
import MyAlgoConnect from "@randlabs/myalgo-connect";

const STORAGE_KEY = "txnlab-use-wallet";

// Wallet manager instance (singleton)
let walletManagerInstance: WalletManager | null = null;

export const walletManager = {
  initialize(): WalletManager {
    if (walletManagerInstance) return walletManagerInstance;

    // Initialize wallet providers
    const providers = [
      { id: "pera", clientStatic: PeraWalletConnect },
      { id: "myalgo", clientStatic: MyAlgoConnect },
      { id: "defly", clientStatic: DeflyWalletConnect },
    ];

    walletManagerInstance = new WalletManager({
      wallets: providers,
      network: "testnet", // Change to "mainnet" for production
      algod: {
        baseServer: "https://testnet-api.algonode.cloud",
        port: "",
        token: "",
      },
    });

    return walletManagerInstance;
  },

  getInstance(): WalletManager | null {
    return walletManagerInstance;
  },

  async connect(providerId: string): Promise<string | null> {
    const manager = this.getInstance();
    if (!manager) return null;

    try {
      const wallet = manager.wallets?.find((w) => w.id === providerId);
      if (!wallet) return null;

      await wallet.connect();
      const accounts = wallet.accounts || [];
      const address = accounts[0]?.address || null;

      if (address) {
        console.log("Connected wallet:", address);
      }

      return address;
    } catch (error) {
      console.warn(`Failed to connect to ${providerId}:`, error);
      return null;
    }
  },

  async disconnect(): Promise<void> {
    const manager = this.getInstance();
    if (!manager) return;

    const activeWallet = manager.activeWallet;
    if (activeWallet) {
      await activeWallet.disconnect();
    }
  },

  isConnected(): boolean {
    const manager = this.getInstance();
    return manager?.activeWallet?.isConnected || false;
  },

  getAddress(): string | null {
    const manager = this.getInstance();
    const accounts = manager?.activeWallet?.accounts || [];
    return accounts[0]?.address || null;
  },

  getActiveProvider(): string | null {
    const manager = this.getInstance();
    return manager?.activeWallet?.id || null;
  },
};
