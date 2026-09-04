import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { ManageShortcutsModal } from "../components/ManageShortcutsModal";
import { MetricCard } from "../components/MetricCard";
import { NotificationCenterModal } from "../components/NotificationCenterModal";
import { CustomDialog } from "../components/CustomDialog";
import { TransactionItem } from "../components/TransactionItem";
import { TransactionModal } from "../components/TransactionModal";
import { useApp } from "../context/AppContext";
import { queryCache } from "../database/cache";
import {
  addTransaction,
  getBudgets,
  getCategoryBreakdown,
  getFilteredTransactions,
  getPeriodSummary,
  getQuickShortcuts,
  getUnreadNotificationCount,
  seedDatabase,
} from "../database/database";
import { Budget, CategoryBreakdown, PeriodSummary, QuickShortcut, Transaction } from "../database/types";
import { TabScreenNavigationProp } from "../navigation/types";

export default function HomeScreen() {
  const navigation = useNavigation<TabScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { formatCurrency, settings, toggleHideBalance, toggleTheme, isDark, refreshTrigger, triggerRefresh, theme } = useApp();

  // Instant SWR memory cache initialization (0ms latency, zero reload flash)
  const [summary, setSummary] = useState<PeriodSummary>(() => queryCache.get("home_summary") || {
    income: 0,
    expenses: 0,
    netBalance: 0,
    transactionCount: 0,
    savingsRate: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(() => queryCache.get("home_recent_tx") || []);
  const [topCategories, setTopCategories] = useState<CategoryBreakdown[]>(() => queryCache.get("home_categories") || []);
  const [budgets, setBudgets] = useState<Budget[]>(() => queryCache.get("home_budgets") || []);
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(() => queryCache.get("home_shortcuts") || []);
  const [unreadNotifs, setUnreadNotifs] = useState<number>(() => queryCache.get("unread_notifs") || 0);

  // If cached data exists, loading is false immediately
  const [loading, setLoading] = useState(() => !queryCache.get("home_summary"));
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Custom Dialog
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert' | 'danger' | 'success';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      if (!queryCache.get("home_summary") && !isManualRefresh) {
        setLoading(true);
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const monthStr = String(currentMonth).padStart(2, "0");
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();

      const startDate = `${currentYear}-${monthStr}-01T00:00:00.000Z`;
      const endDate = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;

      // Parallel high-performance queries with SWR in-memory caching
      const [periodRes, txRes, catRes, budgetRes, shortcutRes, unreadRes] = await Promise.all([
        queryCache.fetchWithCache("home_summary", () => getPeriodSummary(startDate, endDate), 30000, isManualRefresh),
        queryCache.fetchWithCache("home_recent_tx", () => getFilteredTransactions({ limit: 8, orderBy: "created_at", orderDirection: "DESC", skipCount: true }), 30000, isManualRefresh),
        queryCache.fetchWithCache("home_categories", () => getCategoryBreakdown(startDate, endDate, "expense"), 30000, isManualRefresh),
        queryCache.fetchWithCache("home_budgets", () => getBudgets(currentYear, currentMonth), 30000, isManualRefresh),
        queryCache.fetchWithCache("home_shortcuts", () => getQuickShortcuts(), 30000, isManualRefresh),
        queryCache.fetchWithCache("unread_notifs", () => getUnreadNotificationCount(), 30000, isManualRefresh),
      ]);

      setSummary(periodRes.data);
      setRecentTransactions(txRes.data.transactions);
      setTopCategories(catRes.data.slice(0, 4));
      setBudgets(budgetRes.data);
      setShortcuts(shortcutRes.data);
      setUnreadNotifs(unreadRes.data);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const isFocused = useIsFocused();
  const lastLoadedTriggerRef = useRef<number>(-1);

  useFocusEffect(
    useCallback(() => {
      if (lastLoadedTriggerRef.current !== refreshTrigger) {
        lastLoadedTriggerRef.current = refreshTrigger;
        fetchDashboardData();
      }
    }, [fetchDashboardData, refreshTrigger])
  );

  useEffect(() => {
    if (isFocused && lastLoadedTriggerRef.current !== refreshTrigger) {
      lastLoadedTriggerRef.current = refreshTrigger;
      fetchDashboardData();
    }
  }, [fetchDashboardData, isFocused, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData(true);
  };

  const handleSeedDemo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await seedDatabase();
      triggerRefresh();
      await fetchDashboardData(true);
    } catch (e) {
      console.error("Failed to seed demo:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionPress = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setModalVisible(true);
  };

  const handleQuickShortcutPress = async (item: QuickShortcut) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addTransaction({
        type: item.type,
        amount: item.amount,
        category_id: item.category_id,
        description: item.title,
        created_at: new Date().toISOString(),
      });
      triggerRefresh();
    } catch (error) {
      console.error("Quick shortcut error:", error);
      setDialogState({
        visible: true,
        title: "Error",
        message: "Failed to log quick expense.",
        type: "alert",
      });
    }
  };

  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - now.getDate());

  const totalBudgetLimit = budgets.reduce((acc, b) => acc + (b.monthly_limit || 0), 0);
  const totalBudgetSpent = budgets.reduce((acc, b) => acc + (b.spent_amount || 0), 0);
  const budgetPercentage = totalBudgetLimit > 0
    ? Math.min(100, Math.round((totalBudgetSpent / totalBudgetLimit) * 100))
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Revolut/Robinhood Minimalist Header */}
        <View style={{ paddingTop: Math.max(insets?.top ?? 0, 16) }} className="px-6 pb-2">
          <View className="flex-row justify-between items-center py-2">
            <View>
              <Text style={{ color: theme.textSecondary }} className="text-[11px] font-bold uppercase tracking-wider">
                Financial Overview
              </Text>
              <Text style={{ color: theme.textPrimary }} className="text-xl font-extrabold tracking-tight">
                Welcome back
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              {/* Notification Bell */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNotifModalVisible(true);
                }}
                style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                className="w-10 h-10 rounded-full items-center justify-center relative"
              >
                <MaterialIcons name="notifications-none" size={20} color={theme.textPrimary} />
                {unreadNotifs > 0 && (
                  <View className="absolute -top-1 -right-1 bg-rose-500 rounded-full min-w-[17px] h-[17px] px-1 items-center justify-center">
                    <Text className="text-white text-[9px] font-extrabold">{unreadNotifs}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Theme Toggle */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleTheme();
                }}
                style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <MaterialIcons
                  name={isDark ? "light-mode" : "dark-mode"}
                  size={19}
                  color={isDark ? "#FCD34D" : theme.textPrimary}
                />
              </TouchableOpacity>

              {/* Privacy Eye Toggle */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleHideBalance();
                }}
                style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <MaterialIcons
                  name={settings.hideBalance ? "visibility-off" : "visibility"}
                  size={19}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Hero Net Cash Flow Section (Robinhood Style) */}
        <View className="px-6 pt-3 pb-2">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="p-6 rounded-3xl"
          >
            <View className="flex-row justify-between items-center mb-1">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
                Net Cash Flow • {monthName}
              </Text>
              <View
                style={{
                  backgroundColor: summary.netBalance >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                }}
                className="px-2.5 py-0.5 rounded-full"
              >
                <Text
                  style={{ color: summary.netBalance >= 0 ? theme.success : theme.danger }}
                  className="text-xs font-bold"
                >
                  {summary.netBalance >= 0 ? "+" : ""}
                  {summary.savingsRate}% Saved
                </Text>
              </View>
            </View>

            <Text
              style={{
                color: summary.netBalance >= 0 ? theme.textPrimary : theme.danger,
              }}
              className="text-4xl font-extrabold tracking-tight my-2"
            >
              {formatCurrency(summary.netBalance, { showSign: true })}
            </Text>

            <View
              style={{ borderTopColor: theme.border }}
              className="flex-row items-center justify-between pt-4 mt-2 border-t"
            >
              <View className="flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                <Text style={{ color: theme.textSecondary }} className="text-xs font-medium mr-1">Income:</Text>
                <Text style={{ color: theme.success }} className="text-xs font-bold">
                  {formatCurrency(summary.income)}
                </Text>
              </View>

              <View className="flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2" />
                <Text style={{ color: theme.textSecondary }} className="text-xs font-medium mr-1">Expenses:</Text>
                <Text style={{ color: theme.danger }} className="text-xs font-bold">
                  {formatCurrency(summary.expenses)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Summary Metric Cards */}
        <View className="px-6 mt-3 flex-row gap-3">
          <MetricCard
            title="Total Income"
            amount={summary.income}
            type="income"
            iconName="trending-up"
            subtext="This month"
          />
          <MetricCard
            title="Total Spent"
            amount={summary.expenses}
            type="expense"
            iconName="trending-down"
            subtext="This month"
          />
        </View>

        {/* Revolut-style 4 Action Buttons */}
        <View className="px-6 mt-5">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-3.5 flex-row justify-around"
          >
            {[
              { label: "New Entry", icon: "add-circle", color: theme.primary, bg: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF", to: "NewTransaction" },
              { label: "Recurring", icon: "repeat", color: isDark ? "#C084FC" : "#8B5CF6", bg: isDark ? "rgba(168, 85, 247, 0.15)" : "#F5F3FF", to: "Recurring" },
              { label: "Analytics", icon: "pie-chart", color: isDark ? "#2DD4BF" : "#0D9488", bg: isDark ? "rgba(20, 184, 166, 0.15)" : "#F0FDFA", to: "Stats" },
              { label: "History", icon: "receipt-long", color: isDark ? "#FBBF24" : "#D97706", bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FFFBEB", to: "History" },
            ].map((btn, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.75}
                onPress={() => navigation.navigate(btn.to as any)}
                className="items-center py-1 flex-1"
              >
                <View
                  style={{ backgroundColor: btn.bg }}
                  className="w-12 h-12 rounded-2xl items-center justify-center mb-1.5"
                >
                  <MaterialIcons name={btn.icon as any} size={24} color={btn.color} />
                </View>
                <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick-Add Shortcuts (One-Tap Logging) */}
        <View className="px-6 mt-5">
          <View className="flex-row justify-between items-center mb-2.5">
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
              ⚡ Quick-Add
            </Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowShortcutsModal(true);
              }}
              style={{ backgroundColor: theme.cardSecondary }}
              className="flex-row items-center py-1 px-2.5 rounded-xl"
            >
              <MaterialIcons name="tune" size={13} color={theme.primary} />
              <Text style={{ color: theme.primary }} className="text-[11px] font-bold ml-1">
                Customize
              </Text>
            </TouchableOpacity>
          </View>

          {shortcuts.length === 0 ? (
            <TouchableOpacity
              onPress={() => setShowShortcutsModal(true)}
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="p-4 rounded-2xl flex-row items-center justify-center"
            >
              <MaterialIcons name="add-circle-outline" size={18} color={theme.primary} />
              <Text style={{ color: theme.primary }} className="text-xs font-bold ml-2">
                Configure Your Favorite Quick-Add Expenses
              </Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2.5">
                {shortcuts.map((sc) => (
                  <TouchableOpacity
                    key={sc.id}
                    activeOpacity={0.75}
                    onPress={() => handleQuickShortcutPress(sc)}
                    style={{
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      borderWidth: 1,
                    }}
                    className="p-3 rounded-2xl flex-row items-center"
                  >
                    <View
                      style={{ backgroundColor: theme.cardSecondary }}
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2.5"
                    >
                      <MaterialIcons name={sc.icon as any} size={18} color={theme.primary} />
                    </View>
                    <View>
                      <Text style={{ color: theme.textPrimary }} className="text-xs font-bold">
                        {sc.title}
                      </Text>
                      <Text style={{ color: theme.danger }} className="text-[11px] font-extrabold">
                        -{formatCurrency(sc.amount)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Monthly Budget Health Widget */}
        {totalBudgetLimit > 0 && (
          <View className="px-6 mt-5">
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5"
            >
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center">
                  <MaterialIcons
                    name="account-balance-wallet"
                    size={18}
                    color={budgetPercentage >= 100 ? theme.danger : theme.primary}
                  />
                  <Text style={{ color: theme.textPrimary }} className="font-bold text-sm ml-2">
                    Monthly Budget Health
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate("Stats")}>
                  <Text style={{ color: theme.primary }} className="text-xs font-bold">
                    Budgets →
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-end mb-2">
                <Text style={{ color: theme.textSecondary }} className="text-xs font-medium">
                  {formatCurrency(totalBudgetSpent)} spent of {formatCurrency(totalBudgetLimit)}
                </Text>
                <Text
                  style={{
                    color: budgetPercentage >= 100 ? theme.danger : budgetPercentage >= 80 ? "#F59E0B" : theme.success,
                  }}
                  className="font-extrabold text-xs"
                >
                  {budgetPercentage}% Used
                </Text>
              </View>

              <View
                style={{ backgroundColor: theme.cardSecondary }}
                className="h-2 rounded-full overflow-hidden mb-2"
              >
                <View
                  style={{
                    width: `${Math.min(100, budgetPercentage)}%`,
                    backgroundColor: budgetPercentage >= 100 ? theme.danger : budgetPercentage >= 80 ? "#F59E0B" : theme.primary,
                  }}
                  className="h-full rounded-full"
                />
              </View>

              <Text style={{ color: theme.textMuted }} className="text-[11px]">
                {totalBudgetSpent <= totalBudgetLimit
                  ? `${formatCurrency(totalBudgetLimit - totalBudgetSpent)} remaining for next ${daysRemaining} days (${formatCurrency((totalBudgetLimit - totalBudgetSpent) / daysRemaining)}/day)`
                  : `Over budget by ${formatCurrency(totalBudgetSpent - totalBudgetLimit)}!`}
              </Text>
            </View>
          </View>
        )}

        {/* Top Spending Categories Preview */}
        {topCategories.length > 0 && (
          <View className="px-6 mt-5">
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5"
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text style={{ color: theme.textPrimary }} className="font-bold text-base">
                  Top Spending
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Stats")}>
                  <Text style={{ color: theme.primary }} className="text-xs font-bold">
                    Full Report →
                  </Text>
                </TouchableOpacity>
              </View>

              {topCategories.map((cat) => (
                <View key={cat.category_id} className="mb-3.5 last:mb-0">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text style={{ color: theme.textSecondary }} className="font-medium text-xs">
                      {cat.name}
                    </Text>
                    <Text style={{ color: theme.textPrimary }} className="font-bold text-xs">
                      {formatCurrency(cat.total)} ({cat.percentage}%)
                    </Text>
                  </View>
                  <View
                    style={{ backgroundColor: theme.cardSecondary }}
                    className="h-1.5 rounded-full overflow-hidden"
                  >
                    <View
                      style={{
                        width: `${Math.min(100, Math.max(0, cat.percentage || 0))}%`,
                        backgroundColor: cat.color || theme.primary,
                      }}
                      className="h-full rounded-full"
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Transactions Section */}
        <View className="px-6 mt-5">
          <View className="flex-row justify-between items-center mb-3">
            <Text style={{ color: theme.textPrimary }} className="font-bold text-lg">
              Recent Activity
            </Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate("History")}
                className="flex-row items-center"
              >
                <Text style={{ color: theme.primary }} className="text-xs font-bold mr-1">
                  See All
                </Text>
                <MaterialIcons name="arrow-forward" size={14} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : recentTransactions.length === 0 ? (
            <EmptyState
              title="No Activity Yet"
              description="Start tracking your finances today or populate with sample demo data."
              actionText="Add Transaction"
              onAction={() => navigation.navigate("NewTransaction")}
              secondaryActionText="Load 3-Year Demo Dataset (600+ Entries)"
              onSecondaryAction={handleSeedDemo}
            />
          ) : (
            recentTransactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                onPress={handleTransactionPress}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Transaction Detail & Edit Modal */}
      <TransactionModal
        visible={modalVisible}
        transaction={selectedTransaction}
        onClose={() => setModalVisible(false)}
        onUpdated={fetchDashboardData}
      />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={notifModalVisible}
        onClose={() => {
          setNotifModalVisible(false);
          fetchDashboardData();
        }}
      />

      {/* Quick Shortcuts Configuration Modal */}
      <ManageShortcutsModal
        visible={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        onShortcutsUpdated={() => {
          triggerRefresh();
          fetchDashboardData();
        }}
      />

      {/* Custom Dialog */}
      <CustomDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={dialogState.onConfirm}
        onCancel={() => setDialogState(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
