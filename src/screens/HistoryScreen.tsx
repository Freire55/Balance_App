import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
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
import { queryCache } from "../database/cache";
import {
  getCategories,
  getFilteredTransactions,
  getFinanceEvents,
} from "../database/database";
import { exportTransactionsToCsv } from "../database/exportImport";
import { Category, FinanceEvent, Transaction, TransactionType } from "../database/types";

const PAGE_SIZE = 30;
const COMMON_TAG_FILTERS = ["tax-deductible", "vacation", "work", "gift", "grocery", "health", "dining"];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { formatCurrency, refreshTrigger, theme, isDark } = useApp();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [selectedEvent, setSelectedEvent] = useState<number | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "this_month" | "this_year" | "custom">("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [sortBy, setSortBy] = useState<"created_at" | "amount">("created_at");
  const [sortDirection, setSortDirection] = useState<"DESC" | "ASC">("DESC");

  const [showCategoryFilterModal, setShowCategoryFilterModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const cacheKey = `history_tx_${typeFilter}_${selectedCategory}_${selectedEvent}_${debouncedSearchQuery}_${tagFilter}_${periodFilter}_${selectedYear}_${sortBy}_${sortDirection}`;
  const cachedData = queryCache.get<{ transactions: Transaction[]; totalCount: number; hasMore: boolean }>(cacheKey);

  const [transactions, setTransactions] = useState<Transaction[]>(() => cachedData?.transactions || []);
  const [categories, setCategories] = useState<Category[]>(() => queryCache.get("categories") || []);
  const [events, setEvents] = useState<FinanceEvent[]>(() => queryCache.get("finance_events") || []);
  const [totalCount, setTotalCount] = useState(() => cachedData?.totalCount || 0);
  const [loading, setLoading] = useState(() => !cachedData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => cachedData?.hasMore ?? true);
  const [offset, setOffset] = useState(PAGE_SIZE);

  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetadata = useCallback(() => {
    Promise.all([
      queryCache.fetchWithCache("categories", () => getCategories(), 60000),
      queryCache.fetchWithCache("finance_events", () => getFinanceEvents(), 60000),
    ])
      .then(([cats, evts]) => {
        setCategories(cats.data);
        setEvents(evts.data);
      })
      .catch(console.error);
  }, []);

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

  // Fetch first page with instant SWR cache
  const fetchInitialTransactions = useCallback(async (isManualRefresh = false) => {
    const currentCached = queryCache.get<{ transactions: Transaction[]; totalCount: number; hasMore: boolean }>(cacheKey);
    if (!currentCached && transactions.length === 0 && !isManualRefresh) {
      setLoading(true);
    }
    try {
      const result = await getFilteredTransactions({
        type: typeFilter,
        categoryId: selectedCategory,
        eventId: selectedEvent,
        searchQuery: debouncedSearchQuery.trim(),
        tag: tagFilter || undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        orderBy: sortBy,
        orderDirection: sortDirection,
        limit: PAGE_SIZE,
        offset: 0,
      });

      queryCache.set(cacheKey, { transactions: result.transactions, totalCount: result.totalCount, hasMore: result.hasMore });
      setTransactions(result.transactions);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setOffset(PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, typeFilter, selectedCategory, selectedEvent, debouncedSearchQuery, tagFilter, dateRange, sortBy, sortDirection, transactions.length]);

  const isFocused = useIsFocused();
  const lastLoadedTriggerRef = useRef<number>(-1);

  // Dynamic automatic refetch when screen is focused or tab is activated
  useFocusEffect(
    useCallback(() => {
      if (lastLoadedTriggerRef.current !== refreshTrigger) {
        lastLoadedTriggerRef.current = refreshTrigger;
        fetchInitialTransactions();
        loadMetadata();
      }
    }, [fetchInitialTransactions, loadMetadata, refreshTrigger])
  );

  // Refetch when filters change OR when active screen gets refreshTrigger
  useEffect(() => {
    if (isFocused) {
      lastLoadedTriggerRef.current = refreshTrigger;
      fetchInitialTransactions();
    }
  }, [fetchInitialTransactions, isFocused, refreshTrigger]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadMetadata();
    await fetchInitialTransactions();
  }, [fetchInitialTransactions, loadMetadata]);

  // Load more on scroll
  const loadMoreTransactions = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const result = await getFilteredTransactions({
        type: typeFilter,
        categoryId: selectedCategory,
        eventId: selectedEvent,
        searchQuery: debouncedSearchQuery.trim(),
        tag: tagFilter || undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        orderBy: sortBy,
        orderDirection: sortDirection,
        limit: PAGE_SIZE,
        offset,
        skipCount: true,
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
    return { income, expenses };
  }, [transactions]);

  const handleExportCsv = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await exportTransactionsToCsv();
  };

  const handleToggleSort = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sortBy === "created_at") {
      setSortBy("amount");
      setSortDirection("DESC");
    } else {
      setSortBy("created_at");
      setSortDirection("DESC");
    }
  };

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === "all") return "All Categories";
    const found = categories.find((c) => c.id === selectedCategory);
    return found ? found.name : "Category";
  }, [selectedCategory, categories]);

  const handleItemPress = useCallback((tx: Transaction) => {
    setSelectedTransaction(tx);
    setModalVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionItem transaction={item} onPress={handleItemPress} />
    ),
    [handleItemPress]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Revolut/Robinhood Minimalist Header */}
      <View
        style={{
          paddingTop: Math.max(insets?.top ?? 0, 16),
          backgroundColor: theme.bg,
        }}
        className="px-6 pb-2"
      >
        <View className="flex-row justify-between items-center py-2 mb-2">
          <View>
            <Text style={{ color: theme.textSecondary }} className="text-[11px] font-bold uppercase tracking-wider">
              Account Ledger
            </Text>
            <Text style={{ color: theme.textPrimary }} className="text-2xl font-extrabold tracking-tight">
              Transactions
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleToggleSort}
              style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <MaterialIcons
                name={sortBy === "amount" ? "sort" : "schedule"}
                size={19}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExportCsv}
              style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <MaterialIcons name="file-download" size={19} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
          className="flex-row items-center px-4 py-2.5 rounded-2xl"
        >
          <MaterialIcons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            placeholder="Search description, note, or #tag..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: theme.textPrimary }}
            className="flex-1 ml-2.5 text-sm"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="clear" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Row */}
      <View className="px-6 py-2.5 flex-row justify-between items-center">
        {/* Type Segmented Controls */}
        <View style={{ backgroundColor: theme.cardSecondary }} className="flex-row p-1 rounded-xl">
          {[
            { key: "all" as const, label: "All" },
            { key: "expense" as const, label: "Expenses" },
            { key: "income" as const, label: "Income" },
          ].map((tab) => {
            const active = typeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTypeFilter(tab.key);
                }}
                style={{
                  backgroundColor: active ? theme.card : "transparent",
                }}
                className="px-3 py-1 rounded-lg"
              >
                <Text
                  style={{
                    color: active ? theme.primary : theme.textSecondary,
                  }}
                  className="text-xs font-bold"
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row gap-1.5">
          {/* Category Dropdown Button */}
          <TouchableOpacity
            onPress={() => setShowCategoryFilterModal(true)}
            style={{
              backgroundColor: selectedCategory !== "all" ? theme.primary : theme.card,
              borderColor: selectedCategory !== "all" ? theme.primary : theme.border,
              borderWidth: 1,
            }}
            className="px-3 py-1.5 rounded-xl flex-row items-center"
          >
            <MaterialIcons
              name="filter-list"
              size={14}
              color={selectedCategory !== "all" ? "white" : theme.textSecondary}
            />
            <Text
              style={{
                color: selectedCategory !== "all" ? "white" : theme.textSecondary,
              }}
              className="text-xs font-semibold ml-1"
              numberOfLines={1}
            >
              {selectedCategory === "all" ? "Category" : selectedCategoryName}
            </Text>
          </TouchableOpacity>

          {/* Period Filter Button */}
          <TouchableOpacity
            onPress={() => setShowPeriodModal(true)}
            style={{
              backgroundColor: periodFilter !== "all" ? theme.primary : theme.card,
              borderColor: periodFilter !== "all" ? theme.primary : theme.border,
              borderWidth: 1,
            }}
            className="px-3 py-1.5 rounded-xl flex-row items-center"
          >
            <MaterialIcons
              name="calendar-today"
              size={14}
              color={periodFilter !== "all" ? "white" : theme.textSecondary}
            />
            <Text
              style={{
                color: periodFilter !== "all" ? "white" : theme.textSecondary,
              }}
              className="text-xs font-semibold ml-1"
            >
              {periodFilter === "all"
                ? "All Time"
                : periodFilter === "this_month"
                  ? "Month"
                  : `${selectedYear}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tag Filter Chips Row (Feature C) */}
      <View className="px-6 mb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1.5">
            <TouchableOpacity
              onPress={() => setTagFilter("")}
              style={{
                backgroundColor: !tagFilter ? theme.primary : theme.card,
                borderColor: !tagFilter ? theme.primary : theme.border,
                borderWidth: 1,
              }}
              className="px-3 py-1.5 rounded-xl"
            >
              <Text
                style={{ color: !tagFilter ? "#FFFFFF" : theme.textSecondary }}
                className="text-[11px] font-bold"
              >
                All Tags
              </Text>
            </TouchableOpacity>

            {COMMON_TAG_FILTERS.map((t) => {
              const active = tagFilter === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTagFilter(active ? "" : t)}
                  style={{
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : theme.border,
                    borderWidth: 1,
                  }}
                  className="px-3 py-1.5 rounded-xl"
                >
                  <Text
                    style={{ color: active ? "#FFFFFF" : theme.textSecondary }}
                    className="text-[11px] font-semibold"
                  >
                    #{t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Event / Trip Filter Chips Row */}
      {events.length > 0 && (
        <View className="px-6 mb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-1.5">
              <TouchableOpacity
                onPress={() => setSelectedEvent("all")}
                style={{
                  backgroundColor: selectedEvent === "all" ? theme.primary : theme.card,
                  borderColor: selectedEvent === "all" ? theme.primary : theme.border,
                  borderWidth: 1,
                }}
                className="px-3 py-1.5 rounded-xl flex-row items-center"
              >
                <Text
                  style={{ color: selectedEvent === "all" ? "#FFFFFF" : theme.textSecondary }}
                  className="text-[11px] font-bold"
                >
                  All Trips & Events
                </Text>
              </TouchableOpacity>

              {events.map((ev) => {
                const active = selectedEvent === ev.id;
                return (
                  <TouchableOpacity
                    key={ev.id}
                    onPress={() => setSelectedEvent(active ? "all" : ev.id)}
                    style={{
                      backgroundColor: active ? (ev.color || theme.primary) : theme.card,
                      borderColor: active ? (ev.color || theme.primary) : theme.border,
                      borderWidth: 1,
                    }}
                    className="px-3 py-1.5 rounded-xl flex-row items-center"
                  >
                    <MaterialIcons
                      name={(ev.icon as any) || "flight"}
                      size={13}
                      color={active ? "#FFFFFF" : (ev.color || theme.primary)}
                    />
                    <Text
                      style={{ color: active ? "#FFFFFF" : theme.textPrimary }}
                      className="text-[11px] font-semibold ml-1.5"
                    >
                      {ev.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Summary Stat Header for Results */}
      <View className="px-6 mb-2 flex-row justify-between items-center">
        <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold">
          {totalCount} {totalCount === 1 ? "Record" : "Records"} ({sortBy === "amount" ? "By Amount" : "Recent"})
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
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textMuted }} className="text-xs font-medium mt-3">
            Loading ledger...
          </Text>
        </View>
      ) : transactions.length === 0 ? (
        <View className="flex-1 px-6 justify-center">
          <EmptyState
            title="No Results Found"
            description="No transactions match your active filters or search terms."
            actionText="Clear Filters"
            onAction={() => {
              setTypeFilter("all");
              setSelectedCategory("all");
              setTagFilter("");
              setPeriodFilter("all");
              setSearchQuery("");
            }}
          />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreTransactions}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* Detail / Edit Modal */}
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
        <View className="flex-1 justify-end bg-black/60">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderTopWidth: 1,
            }}
            className="rounded-t-3xl p-6 max-h-[75%]"
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
                  backgroundColor: selectedCategory === "all" ? theme.primary : theme.cardSecondary,
                }}
                className="p-3.5 rounded-2xl mb-2 flex-row items-center justify-between"
              >
                <Text
                  style={{
                    color: selectedCategory === "all" ? "white" : theme.textPrimary,
                  }}
                  className="font-bold text-sm"
                >
                  All Categories
                </Text>
                {selectedCategory === "all" && (
                  <MaterialIcons name="check" size={18} color="white" />
                )}
              </TouchableOpacity>

              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => {
                    setSelectedCategory(c.id);
                    setShowCategoryFilterModal(false);
                  }}
                  style={{
                    backgroundColor: selectedCategory === c.id ? theme.primary : theme.cardSecondary,
                  }}
                  className="p-3.5 rounded-2xl mb-2 flex-row items-center justify-between"
                >
                  <Text
                    style={{
                      color: selectedCategory === c.id ? "white" : theme.textPrimary,
                    }}
                    className="font-bold text-sm"
                  >
                    {c.name}
                  </Text>
                  {selectedCategory === c.id && (
                    <MaterialIcons name="check" size={18} color="white" />
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
        <View className="flex-1 justify-end bg-black/60">
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
                Filter by Period
              </Text>
              <TouchableOpacity onPress={() => setShowPeriodModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { key: "all" as const, label: "All Time (Complete History)", year: new Date().getFullYear() },
              { key: "this_month" as const, label: "This Current Month", year: new Date().getFullYear() },
              { key: "this_year" as const, label: `Full Year ${new Date().getFullYear()}`, year: new Date().getFullYear() },
              { key: "this_year" as const, label: `Full Year ${new Date().getFullYear() - 1}`, year: new Date().getFullYear() - 1 },
            ].map((p, idx) => {
              const isSelected = periodFilter === p.key && (p.key !== "this_year" || selectedYear === p.year);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setPeriodFilter(p.key);
                    setSelectedYear(p.year);
                    setShowPeriodModal(false);
                  }}
                  style={{
                    backgroundColor: isSelected ? theme.primary : theme.cardSecondary,
                  }}
                  className="p-4 rounded-2xl mb-2.5 flex-row items-center justify-between"
                >
                  <Text
                    style={{
                      color: isSelected ? "white" : theme.textPrimary,
                    }}
                    className="font-bold text-sm"
                  >
                    {p.label}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check" size={18} color="white" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}
