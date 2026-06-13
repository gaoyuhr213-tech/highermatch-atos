/**
 * TrustedSessionProvider — 全局信任会话上下文
 * PRD §9: 入场流写入，全局可读
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { TrustedSessionContext, type TrustedIdentity } from './session';

interface Props {
  children: ReactNode;
  /** 初始身份（可选，用于测试/Demo直接注入） */
  initialIdentity?: TrustedIdentity | null;
}

export function TrustedSessionProvider({ children, initialIdentity = null }: Props) {
  const [identity, setIdentityState] = useState<TrustedIdentity | null>(initialIdentity);

  const setIdentity = useCallback((id: TrustedIdentity) => {
    setIdentityState(id);
  }, []);

  const clearIdentity = useCallback(() => {
    setIdentityState(null);
  }, []);

  const getSignerDisplay = useCallback(() => {
    if (!identity) return '';
    return `${identity.enterprise}（企业U盾·SM2:${identity.certSerial.slice(-4)}_）`;
  }, [identity]);

  const getOperatorDisplay = useCallback(() => {
    if (!identity) return '';
    return `${identity.operator}（席位授权）`;
  }, [identity]);

  const value = useMemo(() => ({
    identity,
    isAuthenticated: identity !== null,
    setIdentity,
    clearIdentity,
    getSignerDisplay,
    getOperatorDisplay,
  }), [identity, setIdentity, clearIdentity, getSignerDisplay, getOperatorDisplay]);

  return (
    <TrustedSessionContext.Provider value={value}>
      {children}
    </TrustedSessionContext.Provider>
  );
}
