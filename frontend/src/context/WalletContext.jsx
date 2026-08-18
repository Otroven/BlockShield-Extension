import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CHAIN_ID } from "../lib/config";
import { connectWallet, ensureExpectedNetwork, getConnectedWallet } from "../lib/web3";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const connected = await getConnectedWallet();
      setWallet(connected);
      return connected;
    } catch {
      setWallet(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!window.ethereum) return undefined;

    const onChange = () => {
      refresh();
    };
    window.ethereum.on?.("accountsChanged", onChange);
    window.ethereum.on?.("chainChanged", onChange);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onChange);
      window.ethereum.removeListener?.("chainChanged", onChange);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const connected = await connectWallet({ expectedChainId: CHAIN_ID });
      setWallet(connected);
      return connected;
    } catch (error) {
      await refresh();
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const switchNetwork = useCallback(async () => {
    await ensureExpectedNetwork(CHAIN_ID);
    return refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    try {
      if (window.ethereum?.request) {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      }
    } catch {
      // MetaMask 버전에 따라 revoke가 없을 수 있음
    }
    setWallet(null);
  }, []);

  const value = useMemo(
    () => ({
      wallet,
      connecting,
      connect,
      disconnect,
      refresh,
      switchNetwork,
      walletReady: !!wallet,
      wrongNetwork: !!wallet && Number(wallet.chainId) !== CHAIN_ID,
    }),
    [wallet, connecting, connect, disconnect, refresh, switchNetwork]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider.");
  return ctx;
}
