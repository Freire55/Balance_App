import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAppSettings, setSetting } from '../database/database';
import { AppSettings } from '../database/types';

export interface ThemeColors {
  bg: string;
  card: string;
  cardSecondary: string;
  headerBg: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  primary: string;
  success: string;
  danger: string;
  accent: string;
}

export const lightTheme: ThemeColors = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardSecondary: '#F1F5F9',
  headerBg: '#0F172A',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  inputBg: '#F8FAFC',
  primary: '#6366F1',
  success: '#10B981',
  danger: '#F43F5E',
  accent: '#8B5CF6',
};

interface AppContextType {
  settings: AppSettings;
  theme: ThemeColors;
  updateCurrency: (currency: string, symbol: string, position?: 'prefix' | 'suffix') => Promise<void>;
  toggleHideBalance: () => Promise<void>;
  formatCurrency: (amount: number, options?: { showSign?: boolean; forceVisible?: boolean }) => string;
  refreshTrigger: number;
  triggerRefresh: () => void;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  currency: 'EUR',
  currencySymbol: '€',
  currencyPosition: 'suffix',
  hideBalance: false,
  themeMode: 'light',
  dateFormat: 'MMM D, YYYY',
};

const AppContext = createContext<AppContextType>({
  settings: defaultSettings,
  theme: lightTheme,
  updateCurrency: async () => {},
  toggleHideBalance: async () => {},
  formatCurrency: () => '€0.00',
  refreshTrigger: 0,
  triggerRefresh: () => {},
  isLoading: true,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const s = await getAppSettings();
      setSettings(s);
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const updateCurrency = async (currency: string, symbol: string, position: 'prefix' | 'suffix' = 'suffix') => {
    await setSetting('currency', currency);
    await setSetting('currency_symbol', symbol);
    await setSetting('currency_position', position);
    setSettings((prev) => ({
      ...prev,
      currency,
      currencySymbol: symbol,
      currencyPosition: position,
    }));
    triggerRefresh();
  };

  const toggleHideBalance = async () => {
    const nextVal = !settings.hideBalance;
    await setSetting('hide_balance', nextVal ? 'true' : 'false');
    setSettings((prev) => ({
      ...prev,
      hideBalance: nextVal,
    }));
  };

  const formatCurrency = (
    amount: number,
    options: { showSign?: boolean; forceVisible?: boolean } = {}
  ): string => {
    if (settings.hideBalance && !options.forceVisible) {
      return '••••••';
    }

    const safeAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;

    const absVal = Math.abs(safeAmount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const isNegative = safeAmount < 0;
    const sign = isNegative ? '-' : options.showSign && safeAmount > 0 ? '+' : '';

    if (settings.currencyPosition === 'prefix') {
      return `${sign}${settings.currencySymbol}${absVal}`;
    }
    return `${sign}${absVal} ${settings.currencySymbol}`;
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        theme: lightTheme,
        updateCurrency,
        toggleHideBalance,
        formatCurrency,
        refreshTrigger,
        triggerRefresh,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
