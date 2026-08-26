import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
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
import { MetricCard } from "../components/MetricCard";
import { TransactionItem } from "../components/TransactionItem";
import { TransactionModal } from "../components/TransactionModal";
import { useApp } from "../context/AppContext";
import {
  getCategoryBreakdown,
  getFilteredTransactions,
  getPeriodSummary,
  seedDatabase,
} from "../database/database";
import { CategoryBreakdown, PeriodSummary, Transaction } from "../database/types";
import { TabScreenNavigationProp } from "../navigation/types";

export default function HomeScreen() {
  const navigation = useNavigation<TabScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { formatCurrency, settings, toggleHideBalance, refreshTrigger, theme } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<PeriodSummary>({
    income: 0,
    expenses: 0,
    netBalance: 0,
    transactionCount: 0,
    savingsRate: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryBreakdown[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const monthStr = String(currentMonth).padStart(2, "0");
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();

      const startDate = `${currentYear}-${monthStr}-01T00:00:00.000Z`;
      const endDate = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;

      // Parallel high-performance queries
      const [periodSummary, txResult, categories] = await Promise.all([
        getPeriodSummary(startDate, endDate),
        getFilteredTransactions({ limit: 8, orderBy: "created_at", orderDirection: "DESC" }),
        getCategoryBreakdown(startDate, endDate, "expense"),
      ]);

      setSummary(periodSummary);
      setRecentTransactions(txResult.transactions);
      setTopCategories(categories.slice(0, 4));
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  const handleSeedDemo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await seedDatabase();
    await fetchDashboardData();
  };

  const handleTransactionPress = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setModalVisible(true);
  };

  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
        }
      >
        {/* Executive Header Banner */}
        <View
          style={{
            paddingTop: Math.max(insets?.top ?? 0, 16),
            backgroundColor: '#0F172A',
          }}
          className="px-6 pb-12 rounded-b-[36px] shadow-2xl"
        >
          {/* Top Row: Greeting & Privacy Toggle */}
          <View className="flex-row justify-between items-center mb-6 pt-2">
            <View>
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Financial Overview
              </Text>
              <Text className="text-white text-2xl font-bold mt-0.5">Welcome back</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleHideBalance();
              }}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 items-center justify-center"
            >
              <MaterialIcons
                name={settings.hideBalance ? "visibility-off" : "visibility"}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          {/* Hero Net Balance Card */}
          <View
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.85)',
              borderColor: 'rgba(71, 85, 105, 0.4)',
            }}
            className="border rounded-3xl p-6 shadow-lg backdrop-blur-md"
          >
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Net Cash Flow • {monthName}
              </Text>
              <View
                className={`px-2.5 py-0.5 rounded-full ${
                  summary.netBalance >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    summary.netBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {summary.netBalance >= 0 ? "+" : ""}
                  {summary.savingsRate}% Saved
                </Text>
              </View>
            </View>

            <Text
              className={`text-4xl font-extrabold tracking-tight my-2 ${
                summary.netBalance >= 0 ? "text-white" : "text-rose-400"
              }`}
            >
              {formatCurrency(summary.netBalance, { showSign: true })}
            </Text>

            <View
              style={{ borderTopColor: 'rgba(71, 85, 105, 0.4)' }}
              className="flex-row items-center justify-between pt-4 mt-2 border-t"
            >
              <View className="flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                <Text className="text-slate-400 text-xs font-medium mr-1">Income:</Text>
                <Text className="text-emerald-400 text-xs font-bold">
                  {formatCurrency(summary.income)}
                </Text>
              </View>

              <View className="flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2" />
                <Text className="text-slate-400 text-xs font-medium mr-1">Expenses:</Text>
                <Text className="text-rose-400 text-xs font-bold">
                  {formatCurrency(summary.expenses)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Summary Metric Cards */}
        <View className="px-6 -mt-6 flex-row gap-3">
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

        {/* Quick Action Navigation Buttons */}
        <View className="px-6 mt-6">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-2xl p-3 shadow-sm flex-row justify-around"
          >
            <TouchableOpacity
              onPress={() => navigation.navigate("NewTransaction")}
              className="items-center py-1 flex-1"
            >
              <View
                style={{ backgroundColor: '#EEF2FF' }}
                className="w-11 h-11 rounded-2xl items-center justify-center mb-1.5"
              >
                <MaterialIcons name="add-circle" size={24} color="#6366F1" />
              </View>
              <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                New Entry
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Recurring")}
              className="items-center py-1 flex-1"
            >
              <View
                style={{ backgroundColor: '#F5F3FF' }}
                className="w-11 h-11 rounded-2xl items-center justify-center mb-1.5"
              >
                <MaterialIcons name="repeat" size={24} color="#A855F7" />
              </View>
              <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                Recurring
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Stats")}
              className="items-center py-1 flex-1"
            >
              <View
                style={{ backgroundColor: '#F0FDFA' }}
                className="w-11 h-11 rounded-2xl items-center justify-center mb-1.5"
              >
                <MaterialIcons name="pie-chart" size={24} color="#14B8A6" />
              </View>
              <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                Analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("History")}
              className="items-center py-1 flex-1"
            >
              <View
                style={{ backgroundColor: '#FFFBEB' }}
                className="w-11 h-11 rounded-2xl items-center justify-center mb-1.5"
              >
                <MaterialIcons name="receipt-long" size={24} color="#F59E0B" />
              </View>
              <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Spending Categories Preview */}
        {topCategories.length > 0 && (
          <View className="px-6 mt-6">
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm"
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text style={{ color: theme.textPrimary }} className="font-bold text-base">
                  Top Spending
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Stats")}>
                  <Text style={{ color: '#4F46E5' }} className="text-xs font-bold">
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
                    style={{ backgroundColor: '#F1F5F9' }}
                    className="h-2 rounded-full overflow-hidden"
                  >
                    <View
                      style={{
                        width: `${Math.min(100, Math.max(0, cat.percentage || 0))}%`,
                        backgroundColor: cat.color || "#6366F1",
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
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-3.5">
            <Text style={{ color: theme.textPrimary }} className="font-bold text-lg">
              Recent Activity
            </Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate("History")}
                className="flex-row items-center"
              >
                <Text style={{ color: '#4F46E5' }} className="text-xs font-bold mr-1">
                  See All
                </Text>
                <MaterialIcons name="arrow-forward" size={14} color="#4F46E5" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color="#6366F1" />
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
    </View>
  );
}
