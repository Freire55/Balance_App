import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "../components/CategoryIcon";
import { MetricCard } from "../components/MetricCard";
import { useApp } from "../context/AppContext";
import {
  getCategoryBreakdown,
  getMonthlyTrends,
  getPeriodSummary,
  getWeeklyTrends,
} from "../database/database";
import { CategoryBreakdown, PeriodSummary, TrendDataPoint } from "../database/types";

type StatsPeriod = "this_month" | "last_month" | "this_year" | "last_year";

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { formatCurrency, refreshTrigger, theme } = useApp();

  const [period, setPeriod] = useState<StatsPeriod>("this_month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<PeriodSummary>({
    income: 0,
    expenses: 0,
    netBalance: 0,
    transactionCount: 0,
    savingsRate: 0,
    avgDailySpend: 0,
    largestExpense: 0,
  });
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdown[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [breakdownType, setBreakdownType] = useState<"expense" | "income">("expense");

  // Dynamic Date Range Calculation
  const dateParams = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    if (period === "this_month") {
      const mStr = String(currentMonth).padStart(2, "0");
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      return {
        startDate: `${currentYear}-${mStr}-01T00:00:00.000Z`,
        endDate: `${currentYear}-${mStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`,
        year: currentYear,
        month: currentMonth,
        isMonthly: true,
        label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    } else if (period === "last_month") {
      const prevDate = new Date(currentYear, currentMonth - 2, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;
      const mStr = String(prevMonth).padStart(2, "0");
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      return {
        startDate: `${prevYear}-${mStr}-01T00:00:00.000Z`,
        endDate: `${prevYear}-${mStr}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`,
        year: prevYear,
        month: prevMonth,
        isMonthly: true,
        label: prevDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    } else if (period === "this_year") {
      return {
        startDate: `${currentYear}-01-01T00:00:00.000Z`,
        endDate: `${currentYear}-12-31T23:59:59.999Z`,
        year: currentYear,
        month: undefined,
        isMonthly: false,
        label: `Year ${currentYear}`,
      };
    } else {
      const prevYear = currentYear - 1;
      return {
        startDate: `${prevYear}-01-01T00:00:00.000Z`,
        endDate: `${prevYear}-12-31T23:59:59.999Z`,
        year: prevYear,
        month: undefined,
        isMonthly: false,
        label: `Year ${prevYear}`,
      };
    }
  }, [period]);

  const fetchStats = useCallback(async () => {
    try {
      const { startDate, endDate, year, month, isMonthly } = dateParams;

      const [periodSummary, expenses, incomes, trends] = await Promise.all([
        getPeriodSummary(startDate, endDate),
        getCategoryBreakdown(startDate, endDate, "expense"),
        getCategoryBreakdown(startDate, endDate, "income"),
        isMonthly && month ? getWeeklyTrends(year, month) : getMonthlyTrends(year),
      ]);

      setSummary(periodSummary);
      setExpenseBreakdown(expenses);
      setIncomeBreakdown(incomes);
      setTrendData(trends);
    } catch (error) {
      console.error("Stats fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateParams]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
  };

  const handlePeriodChange = (newPeriod: StatsPeriod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeriod(newPeriod);
  };

  // Max value for trend chart scaling
  const maxTrendValue = useMemo(() => {
    let max = 1;
    for (const item of trendData) {
      max = Math.max(max, item.income || 0, item.expenses || 0);
    }
    return Math.max(1, max);
  }, [trendData]);

  const activeCategories = breakdownType === "expense" ? expenseBreakdown : incomeBreakdown;

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
          className="px-6 pb-8 rounded-b-[36px] shadow-xl"
        >
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider pt-2">
            Performance & Insights
          </Text>
          <Text className="text-white text-2xl font-bold mt-0.5 mb-4">Financial Analytics</Text>

          {/* Period Selector Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {[
                { key: "this_month" as const, label: "This Month" },
                { key: "last_month" as const, label: "Last Month" },
                { key: "this_year" as const, label: "This Year" },
                { key: "last_year" as const, label: "Last Year" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => handlePeriodChange(p.key)}
                  className={`px-4 py-2 rounded-xl border ${
                    period === p.key
                      ? "bg-indigo-600 border-indigo-500"
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      period === p.key ? "text-white" : "text-slate-300"
                    }`}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Net Flow & Savings Rate Hero */}
          <View
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.85)',
              borderColor: 'rgba(71, 85, 105, 0.4)',
            }}
            className="border rounded-3xl p-5 shadow-lg"
          >
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Net Savings • {dateParams.label}
              </Text>
              <View
                className={`px-2.5 py-0.5 rounded-full ${
                  summary.netBalance >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    summary.netBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {summary.savingsRate}% Rate
                </Text>
              </View>
            </View>

            <Text
              className={`text-3xl font-extrabold tracking-tight my-1.5 ${
                summary.netBalance >= 0 ? "text-white" : "text-rose-400"
              }`}
            >
              {formatCurrency(summary.netBalance, { showSign: true })}
            </Text>

            <Text className="text-slate-400 text-xs mt-1">
              Based on {summary.transactionCount} transactions analyzed
            </Text>
          </View>
        </View>

        {/* Metric Cards Row */}
        <View className="px-6 -mt-4 flex-row gap-3">
          <MetricCard
            title="Income"
            amount={summary.income}
            type="income"
            iconName="arrow-upward"
            subtext={dateParams.label}
          />
          <MetricCard
            title="Expenses"
            amount={summary.expenses}
            type="expense"
            iconName="arrow-downward"
            subtext={dateParams.label}
          />
        </View>

        {/* Secondary KPI Row */}
        <View className="px-6 mt-3 flex-row gap-3">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="flex-1 p-4 rounded-2xl shadow-sm"
          >
            <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
              Avg Daily Spend
            </Text>
            <Text style={{ color: theme.textPrimary }} className="text-lg font-bold mt-1">
              {formatCurrency(summary.avgDailySpend || 0)}
            </Text>
            <Text style={{ color: theme.textMuted }} className="text-[11px] mt-0.5">Per day in period</Text>
          </View>

          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="flex-1 p-4 rounded-2xl shadow-sm"
          >
            <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
              Largest Expense
            </Text>
            <Text style={{ color: theme.textPrimary }} className="text-lg font-bold mt-1">
              {formatCurrency(summary.largestExpense || 0)}
            </Text>
            <Text style={{ color: theme.textMuted }} className="text-[11px] mt-0.5">Single transaction</Text>
          </View>
        </View>

        {/* Cash Flow Trend Chart */}
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
              <View>
                <Text style={{ color: theme.textPrimary }} className="font-bold text-base">Cash Flow Trend</Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  {dateParams.isMonthly ? "Weekly breakdown" : "Monthly breakdown"}
                </Text>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1.5" />
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-medium">Income</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-sm bg-rose-500 mr-1.5" />
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-medium">Expense</Text>
                </View>
              </View>
            </View>

            {loading ? (
              <View className="h-44 items-center justify-center">
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : trendData.length === 0 ? (
              <View className="h-36 items-center justify-center">
                <Text style={{ color: theme.textMuted }} className="text-xs font-medium">No trend data available</Text>
              </View>
            ) : (
              <View
                style={{ borderBottomColor: theme.border }}
                className="flex-row items-end justify-between h-44 pt-4 border-b"
              >
                {trendData.map((item, index) => {
                  const incomeHeight = Math.max(3, (item.income / maxTrendValue) * 110);
                  const expenseHeight = Math.max(3, (item.expenses / maxTrendValue) * 110);

                  return (
                    <View key={index} className="flex-1 items-center">
                      <View className="flex-row items-end gap-1 h-32">
                        {/* Income Bar */}
                        <View
                          style={{ height: incomeHeight }}
                          className="w-2.5 bg-emerald-500 rounded-t-sm"
                        />
                        {/* Expense Bar */}
                        <View
                          style={{ height: expenseHeight }}
                          className="w-2.5 bg-rose-500 rounded-t-sm"
                        />
                      </View>
                      <Text
                        style={{ color: theme.textSecondary }}
                        className="text-[10px] font-semibold mt-2"
                      >
                        {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Category Breakdown Section */}
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
              <Text style={{ color: theme.textPrimary }} className="font-bold text-base">Category Breakdown</Text>
              <View
                style={{ backgroundColor: '#F1F5F9' }}
                className="rounded-xl p-1 flex-row"
              >
                <TouchableOpacity
                  onPress={() => setBreakdownType("expense")}
                  style={{
                    backgroundColor: breakdownType === "expense" ? theme.card : "transparent",
                  }}
                  className="px-3 py-1 rounded-lg"
                >
                  <Text
                    style={{
                      color: breakdownType === "expense" ? '#F43F5E' : theme.textSecondary,
                    }}
                    className="text-xs font-bold"
                  >
                    Expenses
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setBreakdownType("income")}
                  style={{
                    backgroundColor: breakdownType === "income" ? theme.card : "transparent",
                  }}
                  className="px-3 py-1 rounded-lg"
                >
                  <Text
                    style={{
                      color: breakdownType === "income" ? '#10B981' : theme.textSecondary,
                    }}
                    className="text-xs font-bold"
                  >
                    Income
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : activeCategories.length === 0 ? (
              <View className="py-8 items-center">
                <Text style={{ color: theme.textMuted }} className="text-xs font-medium">
                  No {breakdownType} records for this period.
                </Text>
              </View>
            ) : (
              activeCategories.map((cat) => (
                <View key={cat.category_id} className="mb-4 last:mb-0">
                  <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <CategoryIcon
                        icon={cat.icon}
                        color={cat.color}
                        size={16}
                        containerSize={32}
                      />
                      <View className="ml-2.5 flex-1">
                        <Text style={{ color: theme.textPrimary }} className="font-semibold text-xs" numberOfLines={1}>
                          {cat.name}
                        </Text>
                        <Text style={{ color: theme.textMuted }} className="text-[10px]">
                          {cat.count} {cat.count === 1 ? "transaction" : "transactions"}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text style={{ color: theme.textPrimary }} className="font-bold text-xs">
                        {formatCurrency(cat.total)}
                      </Text>
                      <Text style={{ color: theme.textSecondary }} className="text-[10px] font-semibold">
                        {cat.percentage}%
                      </Text>
                    </View>
                  </View>

                  {/* Visual Progress Bar */}
                  <View
                    style={{ backgroundColor: '#F1F5F9' }}
                    className="h-2 rounded-full overflow-hidden"
                  >
                    <View
                      style={{
                        width: `${Math.min(100, Math.max(0, cat.percentage || 0))}%`,
                        backgroundColor: cat.color || (breakdownType === "expense" ? "#E11D48" : "#059669"),
                      }}
                      className="h-full rounded-full"
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
