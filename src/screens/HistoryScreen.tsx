import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { TransactionItem } from "../components/TransactionItem";
import { TransactionModal } from "../components/TransactionModal";
import { useApp } from "../context/AppContext";
import {
  getCategories,
  getFilteredTransactions,
} from "../database/database";
import { exportTransactionsToCsv } from "../database/exportImport";
import { Category, Transaction, TransactionType } from "../database/types";

const PAGE_SIZE = 30;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { formatCurrency, refreshTrigger, theme } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "this_month" | "this_year" | "custom">("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showCategoryFilterModal, setShowCategoryFilterModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Load Categories
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, [refreshTrigger]);

  // Compute date range from period filter
  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodFilter === "this_month") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      return {
        startDate: `${y}-${m}-01T00:00:00.000Z`,
        endDate: `${y}-${m}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`,
      };
    }
    if (periodFilter === "this_year") {
      return {
        startDate: `${selectedYear}-01-01T00:00:00.000Z`,
        endDate: `${selectedYear}-12-31T23:59:59.999Z`,
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [periodFilter, selectedYear]);

  // Fetch first page
  const fetchInitialTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getFilteredTransactions({
        type: typeFilter,
        categoryId: selectedCategory,
        searchQuery: searchQuery.trim(),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: PAGE_SIZE,
        offset: 0,
      });

      setTransactions(result.transactions);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setOffset(PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, selectedCategory, searchQuery, dateRange]);

  // Debounced refetch on filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitialTransactions();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchInitialTransactions, refreshTrigger]);

  // Load more on scroll
  const loadMoreTransactions = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const result = await getFilteredTransactions({
        type: typeFilter,
        categoryId: selectedCategory,
        searchQuery: searchQuery.trim(),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: PAGE_SIZE,
        offset,
      });

      setTransactions((prev) => [...prev, ...result.transactions]);
      setHasMore(result.hasMore);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (error) {
      console.error("Error loading more transactions:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Calculate filtered aggregates
  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const tx of transactions) {
      if (tx.type === "income") income += tx.amount;
      else expenses += tx.amount;
    }
    return { income, expenses, net: income - expenses };
  }, [transactions]);

  const handleExportCsv = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await exportTransactionsToCsv();
  };

  const handleTransactionPress = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setModalVisible(true);
  };

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === "all") return "All Categories";
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat ? cat.name : "Category";
  }, [selectedCategory, categories]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="dark" />
      {/* Top Header */}
      <View
        style={{
          paddingTop: Math.max(insets?.top ?? 0, 16),
          backgroundColor: '#0F172A',
        }}
        className="px-6 pb-6 rounded-b-3xl shadow-xl"
      >
        <View className="flex-row justify-between items-center mb-4 pt-2">
          <View>
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Transactions & Records
            </Text>
            <Text className="text-white text-2xl font-bold mt-0.5">History</Text>
          </View>

          <TouchableOpacity
            onPress={handleExportCsv}
            className="flex-row items-center bg-slate-800 border border-slate-700 px-3.5 py-2 rounded-xl"
          >
            <MaterialIcons name="file-download" size={18} color="#94A3B8" />
            <Text className="text-slate-300 font-semibold text-xs ml-1.5">Export CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2.5 flex-row items-center mb-3">
          <MaterialIcons name="search" size={20} color="#94A3B8" />
          <TextInput
            className="flex-1 text-white text-sm ml-2.5 font-medium"
            placeholder="Search description, category, or amount..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <View className="flex-row gap-2">
          {/* Category Filter Pill */}
          <TouchableOpacity
            onPress={() => setShowCategoryFilterModal(true)}
            className={`flex-row items-center px-3 py-1.5 rounded-xl border ${
              selectedCategory !== "all"
                ? "bg-indigo-600 border-indigo-500"
                : "bg-slate-800 border-slate-700"
            }`}
          >
            <MaterialIcons
              name="category"
              size={14}
              color={selectedCategory !== "all" ? "white" : "#94A3B8"}
            />
            <Text
              className={`text-xs font-semibold ml-1.5 ${
                selectedCategory !== "all" ? "text-white" : "text-slate-300"
              }`}
              numberOfLines={1}
            >
              {selectedCategoryName}
            </Text>
            <MaterialIcons
              name="arrow-drop-down"
              size={16}
              color={selectedCategory !== "all" ? "white" : "#94A3B8"}
            />
          </TouchableOpacity>

          {/* Period Filter Pill */}
          <TouchableOpacity
            onPress={() => setShowPeriodModal(true)}
            className={`flex-row items-center px-3 py-1.5 rounded-xl border ${
              periodFilter !== "all"
                ? "bg-indigo-600 border-indigo-500"
                : "bg-slate-800 border-slate-700"
            }`}
          >
            <MaterialIcons
              name="calendar-today"
              size={14}
              color={periodFilter !== "all" ? "white" : "#94A3B8"}
            />
            <Text
              className={`text-xs font-semibold ml-1.5 ${
                periodFilter !== "all" ? "text-white" : "text-slate-300"
              }`}
            >
              {periodFilter === "all"
                ? "All Time"
                : periodFilter === "this_month"
                ? "This Month"
                : `Year ${selectedYear}`}
            </Text>
            <MaterialIcons
              name="arrow-drop-down"
              size={16}
              color={periodFilter !== "all" ? "white" : "#94A3B8"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Type Switcher Bar */}
      <View className="px-6 -mt-3 mb-3">
        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
          }}
          className="rounded-2xl shadow-sm p-1 flex-row"
        >
          {(
            [
              { key: "all", label: "All Transactions" },
              { key: "expense", label: "Expenses" },
              { key: "income", label: "Income" },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTypeFilter(t.key);
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                typeFilter === t.key
                  ? t.key === "income"
                    ? "bg-emerald-500"
                    : t.key === "expense"
                    ? "bg-rose-500"
                    : "bg-slate-900"
                  : ""
              }`}
            >
              <Text
                style={{
                  color: typeFilter === t.key ? "#FFFFFF" : theme.textSecondary,
                }}
                className="font-bold text-xs"
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary Stat Header for Results */}
      <View className="px-6 mb-2 flex-row justify-between items-center">
        <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold">
          {totalCount} {totalCount === 1 ? "Record" : "Records"} Found
        </Text>
        <View className="flex-row items-center gap-3">
          <Text className="text-emerald-500 text-xs font-bold">
            +{formatCurrency(totals.income)}
          </Text>
          <Text className="text-rose-500 text-xs font-bold">
            -{formatCurrency(totals.expenses)}
          </Text>
        </View>
      </View>

      {/* Virtualized Infinite Scroll Transaction List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ color: theme.textMuted }} className="text-xs font-medium mt-3">
            Loading history...
          </Text>
        </View>
      ) : transactions.length === 0 ? (
        <View className="px-6 flex-1 justify-center">
          <EmptyState
            title="No Transactions Found"
            description={
              searchQuery.length > 0 || typeFilter !== "all" || selectedCategory !== "all"
                ? "Try clearing your search query or adjusting your filters."
                : "Your transaction history is empty. Add your first record to begin."
            }
            actionText={
              searchQuery.length > 0 || typeFilter !== "all" || selectedCategory !== "all"
                ? "Reset Filters"
                : undefined
            }
            onAction={() => {
              setSearchQuery("");
              setTypeFilter("all");
              setSelectedCategory("all");
              setPeriodFilter("all");
            }}
          />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              onPress={handleTransactionPress}
            />
          )}
          onEndReached={loadMoreTransactions}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : null
          }
        />
      )}

      {/* Transaction Detail & Edit Modal */}
      <TransactionModal
        visible={modalVisible}
        transaction={selectedTransaction}
        onClose={() => setModalVisible(false)}
        onUpdated={fetchInitialTransactions}
      />

      {/* Category Filter Modal */}
      <Modal
        visible={showCategoryFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryFilterModal(false)}
      >
        <View className="flex-1 justify-end bg-black/70">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderTopWidth: 1,
            }}
            className="rounded-t-3xl p-6 max-h-[70%]"
          >
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row justify-between items-center mb-4 pb-3 border-b"
            >
              <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                Filter by Category
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryFilterModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory("all");
                  setShowCategoryFilterModal(false);
                }}
                style={{
                  backgroundColor: selectedCategory === "all" ? '#EEF2FF' : theme.cardSecondary,
                  borderColor: selectedCategory === "all" ? '#6366F1' : theme.border,
                  borderWidth: 1,
                }}
                className="p-3.5 rounded-2xl mb-2 flex-row items-center justify-between"
              >
                <Text
                  style={{
                    color: selectedCategory === "all" ? '#4F46E5' : theme.textPrimary,
                  }}
                  className="font-semibold text-sm"
                >
                  All Categories
                </Text>
                {selectedCategory === "all" && (
                  <MaterialIcons name="check" size={18} color="#6366F1" />
                )}
              </TouchableOpacity>

              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setShowCategoryFilterModal(false);
                  }}
                  style={{
                    backgroundColor: selectedCategory === cat.id ? '#EEF2FF' : theme.cardSecondary,
                    borderColor: selectedCategory === cat.id ? '#6366F1' : theme.border,
                    borderWidth: 1,
                  }}
                  className="p-3.5 rounded-2xl mb-2 flex-row items-center justify-between"
                >
                  <Text
                    style={{
                      color: selectedCategory === cat.id ? '#4F46E5' : theme.textPrimary,
                    }}
                    className="font-semibold text-sm"
                  >
                    {cat.name}
                  </Text>
                  {selectedCategory === cat.id && (
                    <MaterialIcons name="check" size={18} color="#6366F1" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Period Filter Modal */}
      <Modal
        visible={showPeriodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPeriodModal(false)}
      >
        <View className="flex-1 justify-end bg-black/70">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderTopWidth: 1,
            }}
            className="rounded-t-3xl p-6"
          >
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row justify-between items-center mb-4 pb-3 border-b"
            >
              <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                Select Date Period
              </Text>
              <TouchableOpacity onPress={() => setShowPeriodModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setPeriodFilter("all");
                setShowPeriodModal(false);
              }}
              style={{
                backgroundColor: periodFilter === "all" ? '#EEF2FF' : theme.cardSecondary,
                borderColor: periodFilter === "all" ? '#6366F1' : theme.border,
                borderWidth: 1,
              }}
              className="p-3.5 rounded-2xl mb-2"
            >
              <Text
                style={{
                  color: periodFilter === "all" ? '#4F46E5' : theme.textPrimary,
                }}
                className="font-semibold text-sm"
              >
                All Time (10+ Years of Data)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPeriodFilter("this_month");
                setShowPeriodModal(false);
              }}
              style={{
                backgroundColor: periodFilter === "this_month" ? '#EEF2FF' : theme.cardSecondary,
                borderColor: periodFilter === "this_month" ? '#6366F1' : theme.border,
                borderWidth: 1,
              }}
              className="p-3.5 rounded-2xl mb-2"
            >
              <Text
                style={{
                  color: periodFilter === "this_month" ? '#4F46E5' : theme.textPrimary,
                }}
                className="font-semibold text-sm"
              >
                This Month
              </Text>
            </TouchableOpacity>

            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mt-3 mb-2">
              Select Year
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {availableYears.map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    onPress={() => {
                      setSelectedYear(yr);
                      setPeriodFilter("this_year");
                      setShowPeriodModal(false);
                    }}
                    style={{
                      backgroundColor: periodFilter === "this_year" && selectedYear === yr ? '#6366F1' : theme.cardSecondary,
                      borderColor: periodFilter === "this_year" && selectedYear === yr ? '#6366F1' : theme.border,
                      borderWidth: 1,
                    }}
                    className="px-4 py-2.5 rounded-xl"
                  >
                    <Text
                      style={{
                        color: periodFilter === "this_year" && selectedYear === yr ? '#FFFFFF' : theme.textPrimary,
                      }}
                      className="font-bold text-xs"
                    >
                      {yr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
