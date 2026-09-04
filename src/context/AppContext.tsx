import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import { queryCache } from '../database/cache';
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
  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardSecondary: '#F3F4F6',
  headerBg: '#FFFFFF',
  border: '#E5E7EB',
  borderSubtle: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  inputBg: '#F9FAFB',
  primary: '#4F46E5',
  success: '#10B981',
  danger: '#EF4444',
  accent: '#8B5CF6',
};

export const darkTheme: ThemeColors = {
  bg: '#000000',
  card: '#111318',
  cardSecondary: '#1A1D24',
  headerBg: '#000000',
  border: '#1F242D',
  borderSubtle: '#161920',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  inputBg: '#111318',
  primary: '#6366F1',
  success: '#10B981',
  danger: '#F43F5E',
  accent: '#A78BFA',
};

interface AppContextType {
  settings: AppSettings;
  theme: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: 'light' | 'dark') => Promise<void>;
  toggleTheme: () => Promise<void>;
  updateCurrency: (currency: string, symbol: string, position?: 'prefix' | 'suffix') => Promise<void>;
  toggleHideBalance: () => Promise<void>;
  updateNotificationSettings: (
    key: 'notificationsEnabled' | 'notifyRecurring' | 'notifyMonthEnd' | 'notifyYearEnd' | 'notifyBudgets',
    value: boolean
  ) => Promise<void>;
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
  notificationsEnabled: true,
  notifyRecurring: true,
  notifyMonthEnd: true,
  notifyYearEnd: true,
  notifyBudgets: true,
};

const AppContext = createContext<AppContextType>({
  settings: defaultSettings,
  theme: lightTheme,
  isDark: false,
  setThemeMode: async () => {},
  toggleTheme: async () => {},
  updateCurrency: async () => {},
  toggleHideBalance: async () => {},
  updateNotificationSettings: async () => {},
  formatCurrency: () => '€0.00',
  refreshTrigger: 0,
  triggerRefresh: () => {},
  isLoading: true,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { setColorScheme } = useNativewindColorScheme();

  const isDark = settings.themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const loadSettings = React.useCallback(async () => {
    try {
      const s = await getAppSettings();
      setSettings(s);
      setColorScheme(s.themeMode === 'dark' ? 'dark' : 'light');
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setIsLoading(false);
    }
  }, [setColorScheme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const triggerRefresh = useCallback(() => {
    queryCache.invalidate();
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let prevAppState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (prevAppState.match(/inactive|background/) && nextAppState === 'active') {
        triggerRefresh();
      }
      prevAppState = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, [triggerRefresh]);

  const setThemeMode = useCallback(async (mode: 'light' | 'dark') => {
    await setSetting('theme_mode', mode);
    setSettings((prev) => ({ ...prev, themeMode: mode }));
    setColorScheme(mode === 'dark' ? 'dark' : 'light');
  }, [setColorScheme]);

  const toggleTheme = useCallback(async () => {
    const nextMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  const updateCurrency = useCallback(async (currency: string, symbol: string, position: 'prefix' | 'suffix' = 'suffix') => {
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
  }, [triggerRefresh]);

  const toggleHideBalance = useCallback(async () => {
    setSettings((prev) => {
      const nextVal = !prev.hideBalance;
      setSetting('hide_balance', nextVal ? 'true' : 'false').catch(console.error);
      return {
        ...prev,
        hideBalance: nextVal,
      };
    });
  }, []);

  const updateNotificationSettings = useCallback(async (
    key: 'notificationsEnabled' | 'notifyRecurring' | 'notifyMonthEnd' | 'notifyYearEnd' | 'notifyBudgets',
    value: boolean
  ) => {
    const dbKeyMap = {
      notificationsEnabled: 'notifications_enabled',
      notifyRecurring: 'notify_recurring',
      notifyMonthEnd: 'notify_month_end',
      notifyYearEnd: 'notify_year_end',
      notifyBudgets: 'notify_budgets',
    };

    await setSetting(dbKeyMap[key], value ? 'true' : 'false');
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const formatCurrency = useCallback((
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
  }, [settings.hideBalance, settings.currencyPosition, settings.currencySymbol]);

  const contextValue = useMemo(
    () => ({
      settings,
      theme,
      isDark,
      setThemeMode,
      toggleTheme,
      updateCurrency,
      toggleHideBalance,
      updateNotificationSettings,
      formatCurrency,
      refreshTrigger,
      triggerRefresh,
      isLoading,
    }),
    [
      settings,
      theme,
      isDark,
      setThemeMode,
      toggleTheme,
      updateCurrency,
      toggleHideBalance,
      updateNotificationSettings,
      formatCurrency,
      refreshTrigger,
      triggerRefresh,
      isLoading,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
