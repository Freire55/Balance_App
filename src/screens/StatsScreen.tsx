import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "../components/CategoryIcon";
import { CustomDialog } from "../components/CustomDialog";
import { MetricCard } from "../components/MetricCard";
import { TransactionModal } from "../components/TransactionModal";
import { useApp } from "../context/AppContext";
import { queryCache } from "../database/cache";
import {
  addFinanceEvent,
  addSavingsGoal,
  contributeToGoal,
  deleteCategoryBudget,
  deleteFinanceEvent,
  deleteSavingsGoal,
  getBudgets,
  getCategories,
  getCategoryBreakdown,
  getEventAwareBreakdown,
  getFilteredTransactions,
  getFinanceEventById,
  getFinanceEvents,
  getMonthlyDailyExpenses,
  getMonthlyTrends,
  getPeriodSummary,
  getSavingsGoals,
  getWeeklyTrends,
  setCategoryBudget,
  updateSavingsGoal,
} from "../database/database";
import {
  Budget,
  Category,
  CategoryBreakdown,
  FinanceEvent,
  PeriodSummary,
  SavingsGoal,
  Transaction,
  TrendDataPoint,
} from "../database/types";

type StatsTab = "analytics" | "budgets" | "goals" | "calendar" | "health" | "events";
type StatsPeriod = "this_month" | "last_month" | "this_year" | "last_year";

const NEEDS_CATEGORIES = [
  "Housing & Rent",
  "Groceries & Supermarket",
  "Transport & Fuel",
  "Utilities & Internet",
  "Health & Fitness",
  "Education & Courses",
];

const WANTS_CATEGORIES = [
  "Dining & Coffee",
  "Shopping & Tech",
  "Subscriptions & Cloud",
  "Travel & Vacations",
  "Personal & Wellness",
];

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { formatCurrency, refreshTrigger, triggerRefresh, theme, isDark } = useApp();

  const [activeTab, setActiveTab] = useState<StatsTab>("analytics");
  const [period, setPeriod] = useState<StatsPeriod>("this_month");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Custom Dialog
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: "confirm" | "alert" | "danger" | "success";
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    type: "alert",
  });

  // Analytics state
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
  const [rollUpEvents, setRollUpEvents] = useState<boolean>(true);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  // Budgets state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedBudgetCatId, setSelectedBudgetCatId] = useState<number>(0);
  const [budgetLimitInput, setBudgetLimitInput] = useState("");

  // Goals state
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalNameInput, setGoalNameInput] = useState("");
  const [goalTargetInput, setGoalTargetInput] = useState("");
  const [goalCurrentInput, setGoalCurrentInput] = useState("");
  const [goalQuickAmountInput, setGoalQuickAmountInput] = useState("25");
  const [goalIconInput, setGoalIconInput] = useState("savings");
  const [goalColorInput, setGoalColorInput] = useState("#10B981");
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  // Calendar state (with past months navigation)
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [calendarDailySpend, setCalendarDailySpend] = useState<{ day: number; amount: number; count: number }[]>([]);
  const [selectedDayTransactions, setSelectedDayTransactions] = useState<Transaction[]>([]);
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  // Events / Trips state
  const [financeEvents, setFinanceEvents] = useState<FinanceEvent[]>([]);
  const [selectedEventModal, setSelectedEventModal] = useState<FinanceEvent | null>(null);
  const [eventTransactions, setEventTransactions] = useState<Transaction[]>([]);
  const [showAddEventModal, setShowAddEventModal] = useState<boolean>(false);
  const [newEventName, setNewEventName] = useState<string>("");
  const [newEventDescription, setNewEventDescription] = useState<string>("");
  const [newEventBudget, setNewEventBudget] = useState<string>("");
  const [newEventIcon, setNewEventIcon] = useState<string>("flight");
  const [newEventColor, setNewEventColor] = useState<string>("#F43F5E");

  // Transaction Modal state for drill-down inspection & editing
  const [selectedTxForModal, setSelectedTxForModal] = useState<Transaction | null>(null);
  const [txModalVisible, setTxModalVisible] = useState<boolean>(false);

  // Date Range Calculation for Analytics
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

  // Tab-segregated ultra-fast queries with SWR in-memory caching
  const loadTabContent = useCallback(async (tab: StatsTab, isManualRefresh = false) => {
    const tabCacheKey = `stats_${tab}_${dateParams.startDate}_${dateParams.endDate}_${rollUpEvents}`;
    const hasCached = queryCache.has(tabCacheKey, 30000);

    if (!hasCached && !isManualRefresh && !summary.income && !budgets.length && !goals.length) {
      setLoading(true);
    }

    try {
      if (tab === "analytics" || tab === "health") {
        const { startDate, endDate, year, month, isMonthly } = dateParams;
        const [periodSummary, expenses, incomes, trends] = await Promise.all([
          queryCache.fetchWithCache(`summary_${startDate}_${endDate}`, () => getPeriodSummary(startDate, endDate), 30000, isManualRefresh),
          queryCache.fetchWithCache(`exp_${startDate}_${endDate}_${rollUpEvents}`, () => rollUpEvents ? getEventAwareBreakdown(startDate, endDate, "expense") : getCategoryBreakdown(startDate, endDate, "expense"), 30000, isManualRefresh),
          queryCache.fetchWithCache(`inc_${startDate}_${endDate}`, () => getCategoryBreakdown(startDate, endDate, "income"), 30000, isManualRefresh),
          queryCache.fetchWithCache(`trends_${year}_${month}`, () => isMonthly && month ? getWeeklyTrends(year, month) : getMonthlyTrends(year), 30000, isManualRefresh),
        ]);
        setSummary(periodSummary.data);
        setExpenseBreakdown(expenses.data);
        setIncomeBreakdown(incomes.data);
        setTrendData(trends.data);
        queryCache.set(tabCacheKey, true);
      } else if (tab === "budgets") {
        const targetYear = dateParams.isMonthly ? dateParams.year : undefined;
        const targetMonth = dateParams.isMonthly ? dateParams.month : undefined;
        const [budgetList, catList] = await Promise.all([
          queryCache.fetchWithCache(`budgets_${targetYear}_${targetMonth}`, () => getBudgets(targetYear, targetMonth), 30000, isManualRefresh),
          queryCache.fetchWithCache(`cats`, () => getCategories(), 60000, isManualRefresh),
        ]);
        setBudgets(budgetList.data);
        setAllCategories(catList.data);
        queryCache.set(tabCacheKey, true);
      } else if (tab === "goals") {
        const goalList = await queryCache.fetchWithCache(`goals`, () => getSavingsGoals(), 30000, isManualRefresh);
        setGoals(goalList.data);
        queryCache.set(tabCacheKey, true);
      } else if (tab === "calendar") {
        const dailyData = await queryCache.fetchWithCache(`daily_${calendarDate.getFullYear()}_${calendarDate.getMonth() + 1}`, () => getMonthlyDailyExpenses(calendarDate.getFullYear(), calendarDate.getMonth() + 1), 30000, isManualRefresh);
        setCalendarDailySpend(dailyData.data);
        if (selectedDayNum !== null) {
          const year = calendarDate.getFullYear();
          const mStr = String(calendarDate.getMonth() + 1).padStart(2, "0");
          const dStr = String(selectedDayNum).padStart(2, "0");
          const start = `${year}-${mStr}-${dStr}T00:00:00.000Z`;
          const end = `${year}-${mStr}-${dStr}T23:59:59.999Z`;
          const txs = await getFilteredTransactions({ startDate: start, endDate: end, limit: 50 });
          setSelectedDayTransactions(txs.transactions);
        }
        queryCache.set(tabCacheKey, true);
      } else if (tab === "events") {
        const eventList = await queryCache.fetchWithCache(`events`, () => getFinanceEvents(), 30000, isManualRefresh);
        setFinanceEvents(eventList.data);
        if (selectedEventModal) {
          const fullEvent = await getFinanceEventById(selectedEventModal.id);
          if (fullEvent) setSelectedEventModal(fullEvent);
          const txs = await getFilteredTransactions({ eventId: selectedEventModal.id, limit: 100 });
          setEventTransactions(txs.transactions);
        }
        queryCache.set(tabCacheKey, true);
      }
    } catch (error) {
      console.error("Tab data load error:", error);
    } finally {
      setLoading(false);
    }
  }, [dateParams, rollUpEvents, calendarDate, selectedDayNum, selectedEventModal, summary.income, budgets.length, goals.length]);

  // Refetch calendar daily data specifically when calendar date or month changes
  useEffect(() => {
    if (activeTab === "calendar") {
      getMonthlyDailyExpenses(calendarDate.getFullYear(), calendarDate.getMonth() + 1)
        .then(setCalendarDailySpend)
        .catch(console.error);
    }
  }, [activeTab, calendarDate]);

  const isFocused = useIsFocused();
  const lastLoadedTriggerRef = useRef<number>(-1);
  const lastLoadedTabRef = useRef<string>("");

  useFocusEffect(
    useCallback(() => {
      if (lastLoadedTriggerRef.current !== refreshTrigger || lastLoadedTabRef.current !== activeTab) {
        lastLoadedTriggerRef.current = refreshTrigger;
        lastLoadedTabRef.current = activeTab;
        loadTabContent(activeTab);
      }
    }, [activeTab, loadTabContent, refreshTrigger])
  );

  useEffect(() => {
    if (isFocused) {
      lastLoadedTriggerRef.current = refreshTrigger;
      lastLoadedTabRef.current = activeTab;
      loadTabContent(activeTab);
    }
  }, [activeTab, isFocused, loadTabContent, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTabContent(activeTab);
    setRefreshing(false);
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

  // 50/30/20 Calculation
  const health503020 = useMemo(() => {
    let needsTotal = 0;
    let wantsTotal = 0;

    for (const cat of expenseBreakdown) {
      if (NEEDS_CATEGORIES.some((n) => cat.name.toLowerCase().includes(n.toLowerCase()))) {
        needsTotal += cat.total;
      } else if (WANTS_CATEGORIES.some((w) => cat.name.toLowerCase().includes(w.toLowerCase()))) {
        wantsTotal += cat.total;
      } else {
        wantsTotal += cat.total;
      }
    }

    const totalIncome = summary.income > 0 ? summary.income : summary.expenses;
    const savingsAmount = Math.max(0, summary.netBalance);

    const needsPct = totalIncome > 0 ? Math.round((needsTotal / totalIncome) * 100) : 50;
    const wantsPct = totalIncome > 0 ? Math.round((wantsTotal / totalIncome) * 100) : 30;
    const savingsPct = totalIncome > 0 ? Math.round((savingsAmount / totalIncome) * 100) : 20;

    let score = 70;
    if (summary.savingsRate >= 20) score += 15;
    else if (summary.savingsRate >= 10) score += 5;
    else score -= 10;

    if (needsPct <= 55) score += 10;
    else score -= 10;

    if (wantsPct <= 35) score += 5;

    score = Math.max(25, Math.min(99, score));

    return {
      needsTotal,
      wantsTotal,
      savingsAmount,
      needsPct,
      wantsPct,
      savingsPct,
      score,
    };
  }, [expenseBreakdown, summary]);

  // Calendar calculations with past and future months navigation
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth(); // 0-indexed
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOffset = new Date(year, month, 1).getDay();

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    const currentDay = now.getDate();

    const spendMap = new Map<number, { amount: number; count: number }>();
    for (const item of calendarDailySpend) {
      spendMap.set(item.day, { amount: item.amount, count: item.count });
    }

    let noSpendCount = 0;
    const days = [];

    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const data = spendMap.get(d) || { amount: 0, count: 0 };
      const isPastOrToday = isCurrentMonth ? d <= currentDay : isPastMonth;
      if (isPastOrToday && data.amount === 0) {
        noSpendCount++;
      }
      days.push({
        day: d,
        amount: data.amount,
        count: data.count,
        isToday: isCurrentMonth && d === currentDay,
        isPast: isPastOrToday,
      });
    }

    return {
      days,
      noSpendCount,
      daysInCurrentMonth,
      firstDayOffset,
      isCurrentMonth,
      isPastMonth,
    };
  }, [calendarDate, calendarDailySpend]);

  const handleSelectDay = async (dayNum: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDayNum(dayNum);
    const year = calendarDate.getFullYear();
    const mStr = String(calendarDate.getMonth() + 1).padStart(2, "0");
    const dStr = String(dayNum).padStart(2, "0");
    const start = `${year}-${mStr}-${dStr}T00:00:00.000Z`;
    const end = `${year}-${mStr}-${dStr}T23:59:59.999Z`;

    const txs = await getFilteredTransactions({ startDate: start, endDate: end, limit: 50 });
    setSelectedDayTransactions(txs.transactions);
  };

  const handlePrevMonth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() - 1);
    setCalendarDate(d);
    setSelectedDayNum(null);
    setSelectedDayTransactions([]);
    const dailyData = await getMonthlyDailyExpenses(d.getFullYear(), d.getMonth() + 1);
    setCalendarDailySpend(dailyData);
  };

  const handleNextMonth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() + 1);
    setCalendarDate(d);
    setSelectedDayNum(null);
    setSelectedDayTransactions([]);
    const dailyData = await getMonthlyDailyExpenses(d.getFullYear(), d.getMonth() + 1);
    setCalendarDailySpend(dailyData);
  };

  const handleCurrentMonth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date();
    setCalendarDate(d);
    setSelectedDayNum(null);
    setSelectedDayTransactions([]);
    const dailyData = await getMonthlyDailyExpenses(d.getFullYear(), d.getMonth() + 1);
    setCalendarDailySpend(dailyData);
  };

  // Events / Trips Actions
  const handleOpenEventModal = async (event: FinanceEvent) => {
    const fullEvent = await getFinanceEventById(event.id);
    setSelectedEventModal(fullEvent || event);
    const txs = await getFilteredTransactions({ eventId: event.id, limit: 100 });
    setEventTransactions(txs.transactions);
  };

  const handleSaveEvent = async () => {
    if (!newEventName.trim()) {
      setDialogState({
        visible: true,
        title: "Event Name Required",
        message: "Please enter a name for the event or vacation trip.",
        type: "alert",
      });
      return;
    }
    try {
      const parsedBudget = parseFloat(newEventBudget.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
      await addFinanceEvent(
        newEventName.trim(),
        newEventDescription.trim() || undefined,
        newEventIcon,
        newEventColor,
        parsedBudget
      );
      setNewEventName("");
      setNewEventDescription("");
      setNewEventBudget("");
      setShowAddEventModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const eventList = await getFinanceEvents();
      setFinanceEvents(eventList);
      triggerRefresh();
    } catch (e) {
      console.error("Error creating event:", e);
      setDialogState({
        visible: true,
        title: "Error",
        message: "Failed to create event. An event with this name might already exist.",
        type: "alert",
      });
    }
  };

  const handleDeleteEvent = (event: FinanceEvent) => {
    setDialogState({
      visible: true,
      title: "Delete Event",
      message: `Are you sure you want to delete "${event.name}"? Transactions assigned to this event will not be deleted, but will become regular unassigned transactions.`,
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteFinanceEvent(event.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedEventModal(null);
        const eventList = await getFinanceEvents();
        setFinanceEvents(eventList);
        triggerRefresh();
      },
    });
  };

  // Budget Actions
  const handleOpenEditBudget = (b?: Budget) => {
    if (b) {
      setEditingBudget(b);
      setSelectedBudgetCatId(b.category_id);
      setBudgetLimitInput(b.monthly_limit.toString());
    } else {
      setEditingBudget(null);
      const availableCat = allCategories.find((c) => !budgets.some((bg) => bg.category_id === c.id));
      setSelectedBudgetCatId(availableCat ? availableCat.id : allCategories[0]?.id || 0);
      setBudgetLimitInput("");
    }
    setShowBudgetModal(true);
  };

  const handleSaveBudget = async () => {
    const limit = parseFloat(budgetLimitInput.replace(",", "."));
    if (isNaN(limit) || limit <= 0) {
      setDialogState({
        visible: true,
        title: "Invalid Limit",
        message: "Please enter a valid positive number for the monthly limit.",
        type: "alert",
      });
      return;
    }
    if (!selectedBudgetCatId) {
      setDialogState({
        visible: true,
        title: "Category Missing",
        message: "Please select a category.",
        type: "alert",
      });
      return;
    }

    try {
      await setCategoryBudget(selectedBudgetCatId, limit);
      setShowBudgetModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadTabContent("budgets");
      triggerRefresh();
    } catch (e) {
      console.error("Error saving budget:", e);
    }
  };

  const handleDeleteBudget = (catId: number) => {
    setDialogState({
      visible: true,
      title: "Remove Budget",
      message: "Are you sure you want to remove the monthly limit for this category?",
      type: "danger",
      confirmText: "Remove",
      onConfirm: async () => {
        await deleteCategoryBudget(catId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadTabContent("budgets");
        triggerRefresh();
      },
    });
  };

  // Savings Goal Actions
  const handleOpenAddGoal = (goalToEdit?: SavingsGoal) => {
    if (goalToEdit) {
      setEditingGoal(goalToEdit);
      setGoalNameInput(goalToEdit.name);
      setGoalTargetInput(goalToEdit.target_amount.toString());
      setGoalCurrentInput(goalToEdit.current_amount.toString());
      setGoalQuickAmountInput((goalToEdit.quick_amount || 25).toString());
      setGoalIconInput(goalToEdit.icon || "savings");
      setGoalColorInput(goalToEdit.color || "#10B981");
    } else {
      setEditingGoal(null);
      setGoalNameInput("");
      setGoalTargetInput("");
      setGoalCurrentInput("");
      setGoalQuickAmountInput("25");
      setGoalIconInput("savings");
      setGoalColorInput("#10B981");
    }
    setShowGoalModal(true);
  };

  const handleSaveGoal = async () => {
    if (!goalNameInput.trim()) {
      setDialogState({
        visible: true,
        title: "Goal Name",
        message: "Please enter a title for your savings goal.",
        type: "alert",
      });
      return;
    }
    const target = parseFloat(goalTargetInput.replace(",", "."));
    if (isNaN(target) || target <= 0) {
      setDialogState({
        visible: true,
        title: "Invalid Target",
        message: "Please enter a valid target amount.",
        type: "alert",
      });
      return;
    }
    const current = parseFloat(goalCurrentInput.replace(",", ".")) || 0;
    const quickAmount = parseFloat(goalQuickAmountInput.replace(",", ".")) || 25.0;

    try {
      if (editingGoal) {
        await updateSavingsGoal({
          id: editingGoal.id,
          name: goalNameInput.trim(),
          target_amount: target,
          current_amount: current,
          quick_amount: quickAmount,
          icon: goalIconInput,
          color: goalColorInput,
        });
      } else {
        await addSavingsGoal({
          name: goalNameInput.trim(),
          target_amount: target,
          current_amount: current,
          quick_amount: quickAmount,
          icon: goalIconInput,
          color: goalColorInput,
        });
      }
      setShowGoalModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadTabContent("goals");
      triggerRefresh();
    } catch (e) {
      console.error("Error saving goal:", e);
    }
  };

  // Instant 1-Tap Quick Add to Goal (Customizable Preferred Amount)
  const handleQuickAddGoal = async (goal: SavingsGoal) => {
    const amount = goal.quick_amount || 25.0;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await contributeToGoal(goal.id, amount);
      loadTabContent("goals");
      triggerRefresh();
    } catch (e) {
      console.error("Error in quick add to goal:", e);
    }
  };

  const handleContribute = async () => {
    if (!contributeGoal) return;
    const amount = parseFloat(contributeAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      setDialogState({
        visible: true,
        title: "Invalid Amount",
        message: "Please enter a positive amount to deposit.",
        type: "alert",
      });
      return;
    }

    try {
      await contributeToGoal(contributeGoal.id, amount);
      setContributeGoal(null);
      setContributeAmount("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadTabContent("goals");
      triggerRefresh();
    } catch (e) {
      console.error("Error contributing to goal:", e);
    }
  };

  const handleDeleteGoal = (goal: SavingsGoal) => {
    setDialogState({
      visible: true,
      title: "Delete Goal",
      message: `Are you sure you want to delete "${goal.name}"?`,
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteSavingsGoal(goal.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadTabContent("goals");
        triggerRefresh();
      },
    });
  };

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
        <View
          style={{
            paddingTop: Math.max(insets?.top ?? 0, 16),
            backgroundColor: theme.bg,
          }}
          className="px-6 pb-2"
        >
          <Text style={{ color: theme.textSecondary }} className="text-[11px] font-bold uppercase tracking-wider pt-2">
            Performance & Insights
          </Text>
          <Text style={{ color: theme.textPrimary }} className="text-2xl font-extrabold tracking-tight mt-0.5 mb-4">
            Financial Analytics
          </Text>

          {/* Feature Tabs: Analytics, Events, Budgets, Goals, Calendar, 50/30/20 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {[
                { key: "analytics" as const, label: "Analytics", icon: "insights" },
                { key: "events" as const, label: "Events & Trips", icon: "flight" },
                { key: "budgets" as const, label: "Budgets", icon: "account-balance-wallet" },
                { key: "goals" as const, label: "Goals", icon: "savings" },
                { key: "calendar" as const, label: "Calendar", icon: "calendar-today" },
                { key: "health" as const, label: "50/30/20 Score", icon: "favorite" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab.key);
                  }}
                  style={{
                    backgroundColor: activeTab === tab.key ? theme.primary : theme.cardSecondary,
                    borderColor: activeTab === tab.key ? theme.primary : theme.border,
                    borderWidth: 1,
                  }}
                  className="px-3.5 py-2 rounded-2xl flex-row items-center"
                >
                  <MaterialIcons
                    name={tab.icon as any}
                    size={15}
                    color={activeTab === tab.key ? "#FFFFFF" : theme.textSecondary}
                  />
                  <Text
                    style={{
                      color: activeTab === tab.key ? "#FFFFFF" : theme.textSecondary,
                    }}
                    className="text-xs font-bold ml-1.5"
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* TAB 1: ANALYTICS */}
        {activeTab === "analytics" && (
          <View>
            {/* Period Selector Tabs */}
            <View className="px-6 mt-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                      style={{
                        backgroundColor: period === p.key ? theme.primary : theme.card,
                        borderColor: period === p.key ? theme.primary : theme.border,
                        borderWidth: 1,
                      }}
                      className="px-4 py-2 rounded-xl"
                    >
                      <Text
                        style={{
                          color: period === p.key ? "#FFFFFF" : theme.textSecondary,
                        }}
                        className="text-xs font-bold"
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Net Savings Hero Card */}
            <View className="px-6 mt-4">
              <View
                style={{
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: 1,
                }}
                className="rounded-3xl p-5 shadow-sm"
              >
                <View className="flex-row justify-between items-center mb-1">
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold uppercase tracking-wider">
                    Net Savings • {dateParams.label}
                  </Text>
                  <View
                    className={`px-2.5 py-0.5 rounded-full ${
                      summary.netBalance >= 0 ? "bg-emerald-500/20" : "bg-rose-500/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        summary.netBalance >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {summary.savingsRate}% Rate
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    color: summary.netBalance >= 0
                      ? isDark ? "#34D399" : "#10B981"
                      : isDark ? "#FB7185" : "#E11D48",
                  }}
                  className="text-3xl font-extrabold tracking-tight my-1.5"
                >
                  {formatCurrency(summary.netBalance, { showSign: true })}
                </Text>

                <Text style={{ color: theme.textMuted }} className="text-xs">
                  Analyzed across {summary.transactionCount} transactions
                </Text>
              </View>
            </View>

            {/* Income & Expense Metrics */}
            <View className="px-6 mt-4 flex-row gap-3">
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
                    <Text style={{ color: theme.textPrimary }} className="font-bold text-base">
                      Cash Flow Trend
                    </Text>
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
                    <ActivityIndicator size="small" color={theme.primary} />
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
                            <View style={{ height: incomeHeight }} className="w-2.5 bg-emerald-500 rounded-t-sm" />
                            <View style={{ height: expenseHeight }} className="w-2.5 bg-rose-500 rounded-t-sm" />
                          </View>
                          <Text style={{ color: theme.textSecondary }} className="text-[10px] font-semibold mt-2">
                            {item.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Category Breakdown */}
            <View className="px-6 mt-6">
              <View
                style={{
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: 1,
                }}
                className="rounded-3xl p-5 shadow-sm"
              >
                <View className={`flex-row justify-between ${breakdownType === "expense" ? "items-start" : "items-center"} mb-4`}>
                  <View className="flex-1 mr-2">
                    <Text style={{ color: theme.textPrimary }} className="font-bold text-base">Category Breakdown</Text>
                    {breakdownType === "expense" && (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRollUpEvents(!rollUpEvents);
                        }}
                        style={{
                          backgroundColor: rollUpEvents
                            ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                            : theme.cardSecondary,
                          borderColor: rollUpEvents ? theme.primary : theme.border,
                          borderWidth: 1,
                        }}
                        className="px-2.5 py-1 rounded-xl flex-row items-center mt-2 self-start"
                      >
                        <MaterialIcons
                          name="flight"
                          size={12}
                          color={rollUpEvents ? theme.primary : theme.textSecondary}
                        />
                        <Text
                          style={{ color: rollUpEvents ? theme.primary : theme.textSecondary }}
                          className="text-[11px] font-bold ml-1.5"
                        >
                          Collapse Trips
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ backgroundColor: theme.cardSecondary }} className="rounded-xl p-1 flex-row flex-shrink-0">
                    <TouchableOpacity
                      onPress={() => setBreakdownType("expense")}
                      style={{
                        backgroundColor: breakdownType === "expense" ? theme.card : "transparent",
                      }}
                      className="px-2.5 py-1 rounded-lg"
                    >
                      <Text
                        style={{ color: breakdownType === "expense" ? "#F43F5E" : theme.textSecondary }}
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
                      className="px-2.5 py-1 rounded-lg"
                    >
                      <Text
                        style={{ color: breakdownType === "income" ? "#10B981" : theme.textSecondary }}
                        className="text-xs font-bold"
                      >
                        Income
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {activeCategories.map((cat) => {
                  const isEvent = !!cat.is_event;
                  const isExpanded = isEvent && expandedEventId === cat.event_id;

                  return (
                    <View key={`${cat.category_id}-${cat.event_id || "std"}`} className="mb-4 last:mb-0">
                      <TouchableOpacity
                        activeOpacity={isEvent ? 0.7 : 1}
                        onPress={() => {
                          if (isEvent && cat.event_id) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setExpandedEventId(isExpanded ? null : cat.event_id);
                          }
                        }}
                      >
                        <View className="flex-row justify-between items-center mb-2">
                          <View className="flex-row items-center flex-1 mr-2">
                            <CategoryIcon icon={cat.icon} color={cat.color} size={16} containerSize={32} />
                            <View className="ml-2.5 flex-1">
                              <View className="flex-row items-center">
                                <Text style={{ color: theme.textPrimary }} className="font-semibold text-xs" numberOfLines={1}>
                                  {cat.name}
                                </Text>
                                {isEvent && (
                                  <View
                                    style={{
                                      backgroundColor: isDark ? "rgba(244, 63, 94, 0.2)" : "#FFF1F2",
                                      borderColor: isDark ? "rgba(244, 63, 94, 0.4)" : "#FECDD3",
                                      borderWidth: 1,
                                    }}
                                    className="px-1.5 py-0.5 rounded-md ml-1.5 flex-row items-center"
                                  >
                                    <Text
                                      style={{ color: "#F43F5E" }}
                                      className="text-[9px] font-extrabold uppercase"
                                    >
                                      Event
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ color: theme.textMuted }} className="text-[10px]">
                                {cat.count} {cat.count === 1 ? "entry" : "entries"}
                                {isEvent && cat.sub_breakdown ? ` • ${cat.sub_breakdown.length} categories (tap to ${isExpanded ? "collapse" : "view"})` : ""}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center">
                            <View className="items-end mr-1.5">
                              <Text style={{ color: theme.textPrimary }} className="font-bold text-xs">
                                {formatCurrency(cat.total)}
                              </Text>
                              <Text style={{ color: theme.textSecondary }} className="text-[10px] font-semibold">
                                {cat.percentage}%
                              </Text>
                            </View>
                            {isEvent && (
                              <MaterialIcons
                                name={isExpanded ? "expand-less" : "expand-more"}
                                size={18}
                                color={theme.textSecondary}
                              />
                            )}
                          </View>
                        </View>

                        <View style={{ backgroundColor: theme.cardSecondary }} className="h-2 rounded-full overflow-hidden">
                          <View
                            style={{
                              width: `${Math.min(100, Math.max(0, cat.percentage || 0))}%`,
                              backgroundColor: cat.color || (breakdownType === "expense" ? "#E11D48" : "#059669"),
                            }}
                            className="h-full rounded-full"
                          />
                        </View>
                      </TouchableOpacity>

                      {/* Sub-breakdown for Event / Vacation Expenses */}
                      {isExpanded && cat.sub_breakdown && (
                        <View
                          style={{
                            backgroundColor: isDark ? "rgba(15, 23, 42, 0.7)" : "#F8FAFC",
                            borderColor: theme.border,
                            borderWidth: 1,
                          }}
                          className="mt-3 p-3.5 rounded-2xl ml-4"
                        >
                          <View className="flex-row justify-between items-center mb-2.5">
                            <Text style={{ color: theme.textSecondary }} className="text-[11px] font-bold">
                              {`Expenses Inside "${cat.name}":`}
                            </Text>
                            <Text style={{ color: theme.textMuted }} className="text-[10px]">
                              {cat.sub_breakdown.length} sub-categories
                            </Text>
                          </View>

                          {cat.sub_breakdown.map((sub, sIdx) => (
                            <View key={sIdx} className="mb-2.5 last:mb-0">
                              <View className="flex-row justify-between items-center mb-1">
                                <View className="flex-row items-center flex-1 mr-2">
                                  <CategoryIcon icon={sub.icon} color={sub.color} size={12} containerSize={22} />
                                  <Text style={{ color: theme.textPrimary }} className="text-xs font-medium ml-2">
                                    {sub.name}
                                  </Text>
                                </View>
                                <View className="items-end">
                                  <Text style={{ color: theme.textPrimary }} className="text-xs font-bold">
                                    {formatCurrency(sub.total)}
                                  </Text>
                                  <Text style={{ color: theme.textSecondary }} className="text-[10px]">
                                    {sub.percentage}% of trip
                                  </Text>
                                </View>
                              </View>
                              <View style={{ backgroundColor: theme.cardSecondary }} className="h-1.5 rounded-full overflow-hidden">
                                <View
                                  style={{
                                    width: `${Math.min(100, Math.max(0, sub.percentage || 0))}%`,
                                    backgroundColor: sub.color || theme.primary,
                                  }}
                                  className="h-full rounded-full"
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: BUDGETS & LIMITS */}
        {activeTab === "budgets" && (
          <View className="px-6 mt-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                Category Budgets ({budgets.length})
              </Text>
              <TouchableOpacity
                onPress={() => handleOpenEditBudget()}
                style={{ backgroundColor: theme.primary }}
                className="px-3.5 py-1.5 rounded-xl flex-row items-center"
              >
                <MaterialIcons name="add" size={16} color="white" />
                <Text className="text-white font-bold text-xs ml-1">Set Budget</Text>
              </TouchableOpacity>
            </View>

            {budgets.length === 0 ? (
              <View
                style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}
                className="p-8 rounded-3xl items-center"
              >
                <MaterialIcons name="account-balance-wallet" size={40} color={theme.textMuted} />
                <Text style={{ color: theme.textPrimary }} className="font-bold text-base mt-2">
                  No Budgets Configured
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs text-center mt-1 mb-4">
                  Set monthly spending limits for your dining, groceries, and shopping to control your finances.
                </Text>
                <TouchableOpacity
                  onPress={() => handleOpenEditBudget()}
                  style={{ backgroundColor: theme.primary }}
                  className="px-4 py-2.5 rounded-xl"
                >
                  <Text className="text-white font-bold text-xs">Create First Budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgets.map((b) => {
                const pct = b.percentage_used || 0;
                const isOver = pct >= 100;
                const isWarning = pct >= 80 && !isOver;

                return (
                  <View
                    key={b.id}
                    style={{
                      backgroundColor: theme.card,
                      borderColor: isOver
                        ? isDark ? "rgba(244, 63, 94, 0.4)" : "#FECDD3"
                        : isWarning
                          ? isDark ? "rgba(245, 158, 11, 0.4)" : "#FDE68A"
                          : theme.border,
                      borderWidth: 1,
                    }}
                    className="rounded-3xl p-5 mb-3.5 shadow-sm"
                  >
                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center flex-1 mr-2">
                        <CategoryIcon icon={b.category_icon} color={b.category_color} size={20} containerSize={40} />
                        <View className="ml-3 flex-1">
                          <Text style={{ color: theme.textPrimary }} className="font-bold text-sm" numberOfLines={1}>
                            {b.category_name}
                          </Text>
                          <Text style={{ color: theme.textSecondary }} className="text-xs">
                            Limit: {formatCurrency(b.monthly_limit)}/mo
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          onPress={() => handleOpenEditBudget(b)}
                          style={{ backgroundColor: theme.cardSecondary }}
                          className="w-8 h-8 rounded-lg items-center justify-center"
                        >
                          <MaterialIcons name="edit" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteBudget(b.category_id)}
                          style={{ backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "#FFF1F2" }}
                          className="w-8 h-8 rounded-lg items-center justify-center"
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#F43F5E" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-end mb-1.5">
                      <Text style={{ color: theme.textSecondary }} className="text-xs">
                        Spent: {formatCurrency(b.spent_amount || 0)}
                      </Text>
                      <Text
                        style={{
                          color: isOver ? "#F43F5E" : isWarning ? "#F59E0B" : theme.success,
                        }}
                        className="text-xs font-bold"
                      >
                        {pct}% ({isOver ? "Exceeded" : `${formatCurrency(b.remaining_amount || 0)} left`})
                      </Text>
                    </View>

                    <View style={{ backgroundColor: theme.cardSecondary }} className="h-2.5 rounded-full overflow-hidden">
                      <View
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: isOver ? "#F43F5E" : isWarning ? "#F59E0B" : (b.category_color || theme.primary),
                        }}
                        className="h-full rounded-full"
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: SAVINGS GOALS (WITH CUSTOMIZABLE QUICK-TAP BUTTON) */}
        {activeTab === "goals" && (
          <View className="px-6 mt-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                Savings Goals ({goals.length})
              </Text>
              <TouchableOpacity
                onPress={() => handleOpenAddGoal()}
                style={{ backgroundColor: theme.primary }}
                className="px-3.5 py-1.5 rounded-xl flex-row items-center"
              >
                <MaterialIcons name="add" size={16} color="white" />
                <Text className="text-white font-bold text-xs ml-1">New Goal</Text>
              </TouchableOpacity>
            </View>

            {goals.length === 0 ? (
              <View
                style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}
                className="p-8 rounded-3xl items-center"
              >
                <MaterialIcons name="savings" size={40} color={theme.textMuted} />
                <Text style={{ color: theme.textPrimary }} className="font-bold text-base mt-2">
                  No Goals Yet
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs text-center mt-1 mb-4">
                  Set savings targets for vacations, emergency funds, or gadgets.
                </Text>
                <TouchableOpacity
                  onPress={() => handleOpenAddGoal()}
                  style={{ backgroundColor: theme.primary }}
                  className="px-4 py-2.5 rounded-xl"
                >
                  <Text className="text-white font-bold text-xs">Create First Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map((g) => {
                const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
                const isComplete = pct >= 100 || g.is_completed === 1;
                const quickAddAmount = g.quick_amount || 25.0;

                return (
                  <View
                    key={g.id}
                    style={{
                      backgroundColor: theme.card,
                      borderColor: isComplete ? theme.success : theme.border,
                      borderWidth: 1,
                    }}
                    className="rounded-3xl p-5 mb-3.5 shadow-sm"
                  >
                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center flex-1 mr-2">
                        <View
                          style={{ backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5" }}
                          className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                        >
                          <MaterialIcons name={g.icon as any || "savings"} size={20} color={g.color || "#10B981"} />
                        </View>
                        <View className="flex-1">
                          <Text style={{ color: theme.textPrimary }} className="font-bold text-sm" numberOfLines={1}>
                            {g.name}
                          </Text>
                          <Text style={{ color: theme.textSecondary }} className="text-xs">
                            {formatCurrency(g.current_amount)} of {formatCurrency(g.target_amount)}
                          </Text>
                        </View>
                      </View>

                      {/* Top Action Icons */}
                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          onPress={() => handleOpenAddGoal(g)}
                          style={{ backgroundColor: theme.cardSecondary }}
                          className="w-8 h-8 rounded-lg items-center justify-center"
                        >
                          <MaterialIcons name="tune" size={15} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteGoal(g)}
                          style={{ backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "#FFF1F2" }}
                          className="w-8 h-8 rounded-lg items-center justify-center"
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#F43F5E" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View className="flex-row justify-between items-end mb-1.5">
                      <Text style={{ color: theme.textMuted }} className="text-xs">
                        {isComplete ? "Goal Reached! 🎉" : `${formatCurrency(g.target_amount - g.current_amount)} remaining`}
                      </Text>
                      <Text style={{ color: isComplete ? theme.success : theme.primary }} className="font-extrabold text-xs">
                        {pct}%
                      </Text>
                    </View>

                    <View style={{ backgroundColor: theme.cardSecondary }} className="h-2.5 rounded-full overflow-hidden mb-3.5">
                      <View
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isComplete ? theme.success : (g.color || theme.primary),
                        }}
                        className="h-full rounded-full"
                      />
                    </View>

                    {/* Action Row: Customizable 1-Tap Quick Add + Custom Amount Deposit */}
                    <View className="flex-row items-center gap-2 pt-1">
                      {/* 1-Tap Quick Add Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleQuickAddGoal(g)}
                        style={{ backgroundColor: isDark ? "rgba(16, 185, 129, 0.25)" : "#ECFDF5", borderColor: theme.success, borderWidth: 1 }}
                        className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center shadow-xs"
                      >
                        <MaterialIcons name="flash-on" size={16} color={theme.success} />
                        <Text style={{ color: theme.success }} className="text-xs font-extrabold ml-1">
                          +{formatCurrency(quickAddAmount)} Quick Save
                        </Text>
                      </TouchableOpacity>

                      {/* Custom Deposit Button */}
                      <TouchableOpacity
                        onPress={() => {
                          setContributeGoal(g);
                          setContributeAmount("");
                        }}
                        style={{ backgroundColor: theme.cardSecondary }}
                        className="px-3.5 py-2.5 rounded-xl flex-row items-center"
                      >
                        <MaterialIcons name="add" size={15} color={theme.textPrimary} />
                        <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold ml-0.5">
                          Custom
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 4: SPENDING CALENDAR & NO-SPEND DAYS */}
        {activeTab === "calendar" && (
          <View className="px-6 mt-4">
            {/* Month Navigation Card */}
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-4 mb-4 shadow-sm"
            >
              <View className="flex-row justify-between items-center">
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  style={{ backgroundColor: theme.cardSecondary }}
                  className="w-10 h-10 rounded-full items-center justify-center"
                >
                  <MaterialIcons name="chevron-left" size={24} color={theme.textPrimary} />
                </TouchableOpacity>

                <View className="items-center">
                  <Text style={{ color: theme.textPrimary }} className="text-base font-bold">
                    {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </Text>
                  <Text style={{ color: theme.textSecondary }} className="text-[11px] mt-0.5">
                    {calendarDays.isCurrentMonth
                      ? "Current Month"
                      : calendarDays.isPastMonth
                      ? "Past Month History"
                      : "Future Month"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={{ backgroundColor: theme.cardSecondary }}
                  className="w-10 h-10 rounded-full items-center justify-center"
                >
                  <MaterialIcons name="chevron-right" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {!calendarDays.isCurrentMonth && (
                <TouchableOpacity
                  onPress={handleCurrentMonth}
                  style={{
                    backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF",
                    borderColor: theme.primary,
                    borderWidth: 1,
                  }}
                  className="mt-3 py-2 rounded-xl items-center flex-row justify-center"
                >
                  <MaterialIcons name="today" size={15} color={theme.primary} />
                  <Text style={{ color: theme.primary }} className="text-xs font-bold ml-1.5">
                    Jump to Current Month
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* No Spend Trophy Card */}
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 mb-4 shadow-sm flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View
                  style={{ backgroundColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#FFFBEB" }}
                  className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="emoji-events" size={26} color="#F59E0B" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-extrabold text-base">
                    {calendarDays.noSpendCount} No-Spend Days
                  </Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">
                    {calendarDays.isCurrentMonth
                      ? `This month so far (${Math.round((calendarDays.noSpendCount / Math.max(1, new Date().getDate())) * 100)}% habit rate)`
                      : `In ${calendarDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })} (${Math.round((calendarDays.noSpendCount / calendarDays.daysInCurrentMonth) * 100)}% habit rate)`}
                  </Text>
                </View>
              </View>

              <View className="bg-emerald-500/20 px-3 py-1 rounded-full">
                <Text className="text-emerald-500 text-xs font-bold">
                  {calendarDays.noSpendCount >= 10 ? "Streak ⭐" : "Tracking"}
                </Text>
              </View>
            </View>

            {/* Calendar Grid */}
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <Text style={{ color: theme.textPrimary }} className="font-bold text-sm mb-3">
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })} Heatmap
              </Text>

              {/* Weekday Headers */}
              <View className="flex-row justify-between mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
                  <Text
                    key={w}
                    style={{ color: theme.textMuted }}
                    className="w-[12%] text-center font-bold text-xs"
                  >
                    {w}
                  </Text>
                ))}
              </View>

              <View className="flex-row flex-wrap justify-between">
                {/* Empty padding slots for day-of-week alignment */}
                {Array.from({ length: calendarDays.firstDayOffset }).map((_, i) => (
                  <View key={`empty-${i}`} className="w-[12%] aspect-square m-0.5" />
                ))}

                {calendarDays.days.map((item) => {
                  const hasSpent = item.amount > 0;
                  const isHeavy = item.amount >= 100;
                  const isSelected = selectedDayNum === item.day;

                  return (
                    <TouchableOpacity
                      key={item.day}
                      onPress={() => handleSelectDay(item.day)}
                      style={{
                        backgroundColor: isSelected
                          ? theme.primary
                          : item.isToday
                            ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                            : !item.isPast
                              ? theme.cardSecondary
                              : !hasSpent
                                ? isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5"
                                : isHeavy
                                  ? isDark ? "rgba(244, 63, 94, 0.15)" : "#FFF1F2"
                                  : theme.cardSecondary,
                        borderColor: isSelected ? theme.primary : item.isToday ? theme.primary : theme.border,
                        borderWidth: 1,
                      }}
                      className="w-[12%] aspect-square m-0.5 rounded-xl items-center justify-center"
                    >
                      <Text
                        style={{
                          color: isSelected
                            ? "#FFFFFF"
                            : item.isToday
                              ? theme.primary
                              : !item.isPast
                                ? theme.textMuted
                                : !hasSpent
                                  ? theme.success
                                  : isHeavy
                                    ? "#F43F5E"
                                    : theme.textPrimary,
                          fontWeight: item.isToday || isSelected ? "800" : "600",
                        }}
                        className="text-xs"
                      >
                        {item.day}
                      </Text>
                      {hasSpent && (
                        <View
                          style={{
                            backgroundColor: isSelected ? "#FFFFFF" : isHeavy ? "#F43F5E" : theme.textMuted,
                          }}
                          className="w-1 h-1 rounded-full mt-0.5"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Legend */}
              <View className="flex-row justify-around mt-4 pt-3 border-t border-slate-700/20">
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" />
                  <Text style={{ color: theme.textSecondary }} className="text-[11px]">No Spend</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-1.5" />
                  <Text style={{ color: theme.textSecondary }} className="text-[11px]">Normal</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5" />
                  <Text style={{ color: theme.textSecondary }} className="text-[11px]">Heavy (€100+)</Text>
                </View>
              </View>
            </View>

            {/* Selected Day Transaction Breakdown */}
            {selectedDayNum !== null && (
              <View
                style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}
                className="rounded-3xl p-5 shadow-sm"
              >
                <View className="flex-row justify-between items-center mb-3">
                  <Text style={{ color: theme.textPrimary }} className="font-bold text-sm">
                    {calendarDate.toLocaleDateString("en-US", { month: "short" })} {selectedDayNum}, {calendarDate.getFullYear()} ({selectedDayTransactions.length})
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedDayNum(null)}>
                    <MaterialIcons name="close" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {selectedDayTransactions.length === 0 ? (
                  <Text style={{ color: theme.textMuted }} className="text-xs">
                    No transactions recorded on this day. 🎉 Zero spending!
                  </Text>
                ) : (
                  selectedDayTransactions.map((tx) => (
                    <TouchableOpacity
                      key={tx.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedTxForModal(tx);
                        setTxModalVisible(true);
                      }}
                      className="flex-row justify-between items-center py-2.5 border-b border-slate-700/20 last:border-0"
                    >
                      <View className="flex-1 mr-2">
                        <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold" numberOfLines={1}>
                          {tx.description || tx.category_name}
                        </Text>
                        {tx.event_name && (
                          <Text style={{ color: tx.event_color || theme.primary }} className="text-[10px] font-bold mt-0.5">
                            ✈️ {tx.event_name}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center">
                        <Text style={{ color: tx.type === "income" ? theme.success : theme.textPrimary }} className="text-xs font-bold mr-1">
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </Text>
                        <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* TAB 6: EVENTS & TRIPS (VACATION TRACKER) */}
        {activeTab === "events" && (
          <View className="px-6 mt-4">
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                  Events & Vacation Trips ({financeEvents.length})
                </Text>
                <Text style={{ color: theme.textMuted }} className="text-[11px] mt-0.5">
                  Track vacation spending and major projects
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddEventModal(true)}
                style={{ backgroundColor: theme.primary }}
                className="px-3.5 py-2 rounded-xl flex-row items-center"
              >
                <MaterialIcons name="add" size={16} color="white" />
                <Text className="text-white font-bold text-xs ml-1">New Event</Text>
              </TouchableOpacity>
            </View>

            {financeEvents.length === 0 ? (
              <View
                style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}
                className="rounded-3xl p-8 items-center text-center shadow-sm"
              >
                <View
                  style={{ backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF" }}
                  className="w-16 h-16 rounded-full items-center justify-center mb-3"
                >
                  <MaterialIcons name="flight-takeoff" size={32} color={theme.primary} />
                </View>
                <Text style={{ color: theme.textPrimary }} className="text-base font-bold">
                  No Events or Trips Yet
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs text-center mt-1 mb-4 leading-5">
                  {`Create a vacation event (like "Summer Vacation" or "Tokyo Trip") and tag your flights, hotels, food, and transport to it!`}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddEventModal(true)}
                  style={{ backgroundColor: theme.primary }}
                  className="px-5 py-2.5 rounded-xl"
                >
                  <Text className="text-white font-bold text-xs">Create First Trip</Text>
                </TouchableOpacity>
              </View>
            ) : (
              financeEvents.map((ev) => {
                const hasBudget = (ev.budget || 0) > 0;
                const pctUsed = hasBudget ? Math.round(((ev.total_spent || 0) / ev.budget!) * 100) : 0;
                const isOver = hasBudget && (ev.total_spent || 0) > ev.budget!;

                return (
                  <TouchableOpacity
                    key={ev.id}
                    activeOpacity={0.8}
                    onPress={() => handleOpenEventModal(ev)}
                    style={{
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      borderWidth: 1,
                    }}
                    className="rounded-3xl p-5 mb-4 shadow-sm"
                  >
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-row items-center flex-1 mr-2">
                        <View
                          style={{ backgroundColor: ev.color || theme.primary }}
                          className="w-12 h-12 rounded-2xl items-center justify-center shadow-sm"
                        >
                          <MaterialIcons name={ev.icon as any || "flight"} size={24} color="white" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text style={{ color: theme.textPrimary }} className="font-extrabold text-base" numberOfLines={1}>
                            {ev.name}
                          </Text>
                          <Text style={{ color: theme.textMuted }} className="text-xs">
                            {ev.transaction_count || 0} transactions recorded
                          </Text>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text style={{ color: theme.textPrimary }} className="font-black text-lg">
                          {formatCurrency(ev.total_spent || 0)}
                        </Text>
                        {hasBudget && (
                          <Text style={{ color: isOver ? "#F43F5E" : theme.textSecondary }} className="text-xs font-semibold">
                            of {formatCurrency(ev.budget!)} ({pctUsed}%)
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Progress Bar if Budget is set */}
                    {hasBudget && (
                      <View style={{ backgroundColor: theme.cardSecondary }} className="h-2 rounded-full overflow-hidden mb-3">
                        <View
                          style={{
                            width: `${Math.min(100, Math.max(0, pctUsed))}%`,
                            backgroundColor: isOver ? "#F43F5E" : ev.color || theme.primary,
                          }}
                          className="h-full rounded-full"
                        />
                      </View>
                    )}

                    {/* Footer Button: Tap to see categories & transactions */}
                    <View
                      style={{ borderTopColor: theme.border, borderTopWidth: 1 }}
                      className="pt-3 flex-row justify-between items-center"
                    >
                      <Text style={{ color: ev.color || theme.primary }} className="text-xs font-bold">
                        View Trip Categories & Ledger
                      </Text>
                      <MaterialIcons name="chevron-right" size={18} color={ev.color || theme.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* TAB 5: 50/30/20 ANALYZER & HEALTH SCORE */}
        {activeTab === "health" && (
          <View className="px-6 mt-4">
            {/* Score Card */}
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-6 shadow-sm mb-4 items-center"
            >
              <View
                style={{ backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF" }}
                className="w-24 h-24 rounded-full items-center justify-center mb-2"
              >
                <Text style={{ color: theme.primary }} className="text-3xl font-black">
                  {health503020.score}
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-[10px] font-bold">
                  / 100
                </Text>
              </View>

              <Text style={{ color: theme.textPrimary }} className="font-extrabold text-lg mt-1">
                {health503020.score >= 80 ? "Excellent Financial Health" : health503020.score >= 60 ? "Solid Budgeting Discipline" : "Room for Improvement"}
              </Text>
              <Text style={{ color: theme.textSecondary }} className="text-xs text-center mt-1">
                Evaluated against the classic 50/30/20 personal wealth model.
              </Text>
            </View>

            {/* 50/30/20 Breakdown Bars */}
            <View
              style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <Text style={{ color: theme.textPrimary }} className="font-bold text-sm mb-4">
                50/30/20 Rule Distribution
              </Text>

              {/* 50% Needs */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-1">
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                    Needs (Target: 50%)
                  </Text>
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-bold">
                    {formatCurrency(health503020.needsTotal)} ({health503020.needsPct}%)
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.cardSecondary }} className="h-2.5 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${Math.min(100, health503020.needsPct)}%`,
                      backgroundColor: health503020.needsPct <= 50 ? theme.success : "#F59E0B",
                    }}
                    className="h-full rounded-full"
                  />
                </View>
                <Text style={{ color: theme.textMuted }} className="text-[10px] mt-0.5">
                  Housing, Groceries, Utilities, Transport
                </Text>
              </View>

              {/* 30% Wants */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-1">
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                    Wants (Target: 30%)
                  </Text>
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-bold">
                    {formatCurrency(health503020.wantsTotal)} ({health503020.wantsPct}%)
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.cardSecondary }} className="h-2.5 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${Math.min(100, health503020.wantsPct)}%`,
                      backgroundColor: health503020.wantsPct <= 30 ? theme.primary : "#F43F5E",
                    }}
                    className="h-full rounded-full"
                  />
                </View>
                <Text style={{ color: theme.textMuted }} className="text-[10px] mt-0.5">
                  Dining, Tech, Subscriptions, Vacations
                </Text>
              </View>

              {/* 20% Savings */}
              <View>
                <View className="flex-row justify-between items-center mb-1">
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                    Savings & Investments (Target: 20%)
                  </Text>
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-bold">
                    {formatCurrency(health503020.savingsAmount)} ({health503020.savingsPct}%)
                  </Text>
                </View>
                <View style={{ backgroundColor: theme.cardSecondary }} className="h-2.5 rounded-full overflow-hidden">
                  <View
                    style={{
                      width: `${Math.min(100, health503020.savingsPct)}%`,
                      backgroundColor: theme.success,
                    }}
                    className="h-full rounded-full"
                  />
                </View>
                <Text style={{ color: theme.textMuted }} className="text-[10px] mt-0.5">
                  Net balance retained and invested
                </Text>
              </View>
            </View>

            {/* Smart Coaching Insights */}
            <View
              style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }}
              className="rounded-3xl p-5 shadow-sm"
            >
              <Text style={{ color: theme.textPrimary }} className="font-bold text-sm mb-3">
                Actionable Insights
              </Text>

              <View className="flex-row items-start mb-3">
                <MaterialIcons name="check-circle" size={18} color={theme.success} className="mr-2 mt-0.5" />
                <Text style={{ color: theme.textSecondary }} className="text-xs leading-4 flex-1">
                  {summary.savingsRate >= 20
                    ? `Outstanding! You are saving ${summary.savingsRate}% of your income, beating the 20% benchmark.`
                    : `Your savings rate is ${summary.savingsRate}%. Trimming €100 from discretionary dining would bring you closer to 20%.`}
                </Text>
              </View>

              <View className="flex-row items-start">
                <MaterialIcons name="lightbulb" size={18} color="#F59E0B" className="mr-2 mt-0.5" />
                <Text style={{ color: theme.textSecondary }} className="text-xs leading-4 flex-1">
                  {calendarDays.noSpendCount >= 10
                    ? `You logged ${calendarDays.noSpendCount} zero-expense days this month. Great habit building!`
                    : `Challenge: Aim for 2 consecutive zero-spending days this week to accelerate your savings goals.`}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Set/Edit Budget Modal */}
      <Modal visible={showBudgetModal} animationType="slide" transparent onRequestClose={() => setShowBudgetModal(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderTopWidth: 1 }} className="rounded-t-3xl p-6 shadow-2xl">
            <Text style={{ color: theme.textPrimary }} className="text-lg font-bold mb-4">
              {editingBudget ? "Edit Monthly Budget" : "Set Category Budget"}
            </Text>

            {!editingBudget && (
              <View className="mb-4">
                <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-2">
                  Select Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {allCategories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setSelectedBudgetCatId(c.id)}
                        style={{
                          backgroundColor: selectedBudgetCatId === c.id ? theme.primary : theme.cardSecondary,
                        }}
                        className="px-3 py-2 rounded-xl"
                      >
                        <Text style={{ color: selectedBudgetCatId === c.id ? "white" : theme.textPrimary }} className="text-xs font-semibold">
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }} className="rounded-2xl p-4 mb-6">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                Monthly Limit Amount
              </Text>
              <TextInput
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold"
                value={budgetLimitInput}
                onChangeText={setBudgetLimitInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowBudgetModal(false)}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveBudget}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text className="text-white font-bold">Save Budget</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Savings Goal Modal */}
      <Modal visible={showGoalModal} animationType="slide" transparent onRequestClose={() => setShowGoalModal(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderTopWidth: 1 }} className="rounded-t-3xl p-6 shadow-2xl">
            <Text style={{ color: theme.textPrimary }} className="text-lg font-bold mb-4">
              {editingGoal ? "Edit Savings Goal" : "New Savings Goal"}
            </Text>

            <View style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }} className="rounded-2xl p-3.5 mb-3">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">Goal Name</Text>
              <TextInput
                style={{ color: theme.textPrimary }}
                value={goalNameInput}
                onChangeText={setGoalNameInput}
                placeholder="e.g. Emergency Fund, Summer Vacation"
                placeholderTextColor={theme.textMuted}
                className="font-semibold text-sm"
              />
            </View>

            <View style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }} className="rounded-2xl p-3.5 mb-3">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">Target Amount</Text>
              <TextInput
                style={{ color: theme.textPrimary }}
                value={goalTargetInput}
                onChangeText={setGoalTargetInput}
                placeholder="e.g. 5000"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.textMuted}
                className="font-bold text-lg"
              />
            </View>

            <View style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }} className="rounded-2xl p-3.5 mb-3">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">Current Saved</Text>
              <TextInput
                style={{ color: theme.textPrimary }}
                value={goalCurrentInput}
                onChangeText={setGoalCurrentInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.textMuted}
                className="font-bold text-lg"
              />
            </View>

            {/* Preferred Quick-Tap Amount */}
            <View style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }} className="rounded-2xl p-3.5 mb-6">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                Preferred Quick-Tap Deposit Amount ({formatCurrency(25).slice(0, 1)})
              </Text>
              <TextInput
                style={{ color: theme.textPrimary }}
                value={goalQuickAmountInput}
                onChangeText={setGoalQuickAmountInput}
                placeholder="e.g. 25 or 50"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.textMuted}
                className="font-bold text-lg"
              />
              <Text style={{ color: theme.textMuted }} className="text-[10px] mt-1">
                Enables a 1-tap button directly on the goal card for this amount.
              </Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowGoalModal(false)}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveGoal}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text className="text-white font-bold">{editingGoal ? "Save Changes" : "Create Goal"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deposit to Goal Modal */}
      {contributeGoal && (
        <Modal visible={true} animationType="slide" transparent onRequestClose={() => setContributeGoal(null)}>
          <View className="flex-1 justify-end bg-black/60">
            <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderTopWidth: 1 }} className="rounded-t-3xl p-6 shadow-2xl">
              <Text style={{ color: theme.textPrimary }} className="text-lg font-bold mb-1">
                Deposit to {contributeGoal.name}
              </Text>
              <Text style={{ color: theme.textSecondary }} className="text-xs mb-4">
                Target: {formatCurrency(contributeGoal.target_amount)} (Currently: {formatCurrency(contributeGoal.current_amount)})
              </Text>

              <View style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }} className="rounded-2xl p-4 mb-6">
                <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">Deposit Amount</Text>
                <TextInput
                  style={{ color: theme.textPrimary }}
                  value={contributeAmount}
                  onChangeText={setContributeAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  autoFocus
                  placeholderTextColor={theme.textMuted}
                  className="text-3xl font-extrabold"
                />
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setContributeGoal(null)}
                  style={{ backgroundColor: theme.cardSecondary }}
                  className="flex-1 py-4 rounded-2xl items-center"
                >
                  <Text style={{ color: theme.textPrimary }} className="font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleContribute}
                  style={{ backgroundColor: theme.success }}
                  className="flex-1 py-4 rounded-2xl items-center"
                >
                  <Text className="text-white font-bold">Add Funds</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Event Details & Ledger Modal */}
      {selectedEventModal && (
        <Modal
          visible={!!selectedEventModal}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedEventModal(null)}
        >
          <View className="flex-1 justify-end bg-black/70">
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderTopWidth: 1,
                maxHeight: "85%",
              }}
              className="rounded-t-3xl p-6"
            >
              {/* Header */}
              <View
                style={{ borderBottomColor: theme.border }}
                className="flex-row justify-between items-start pb-4 mb-4 border-b"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View
                    style={{ backgroundColor: selectedEventModal.color || theme.primary }}
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-3 shadow-sm"
                  >
                    <MaterialIcons name={(selectedEventModal.icon as any) || "flight"} size={24} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: theme.textPrimary }} className="text-xl font-black" numberOfLines={1}>
                      {selectedEventModal.name}
                    </Text>
                    <Text style={{ color: theme.textSecondary }} className="text-xs">
                      {selectedEventModal.description || "Vacation & Event Spending"}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => handleDeleteEvent(selectedEventModal)}
                    style={{ backgroundColor: isDark ? "rgba(244, 63, 94, 0.2)" : "#FFF1F2" }}
                    className="w-9 h-9 rounded-full items-center justify-center"
                  >
                    <MaterialIcons name="delete-outline" size={18} color="#F43F5E" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedEventModal(null)}
                    style={{ backgroundColor: theme.cardSecondary }}
                    className="w-9 h-9 rounded-full items-center justify-center"
                  >
                    <MaterialIcons name="close" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Total Spent vs Budget Card */}
              <View
                style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                className="p-4 rounded-2xl mb-4"
              >
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold">
                    Total Spent on Trip
                  </Text>
                  <Text style={{ color: theme.textPrimary }} className="text-xl font-black">
                    {formatCurrency(selectedEventModal.total_spent || 0)}
                  </Text>
                </View>

                {(selectedEventModal.budget || 0) > 0 && (
                  <>
                    <View style={{ backgroundColor: theme.card }} className="h-2 rounded-full overflow-hidden mt-1 mb-1">
                      <View
                        style={{
                          width: `${Math.min(100, Math.max(0, Math.round(((selectedEventModal.total_spent || 0) / selectedEventModal.budget!) * 100)))}%`,
                          backgroundColor: (selectedEventModal.total_spent || 0) > selectedEventModal.budget!
                            ? "#F43F5E"
                            : selectedEventModal.color || theme.primary,
                        }}
                        className="h-full rounded-full"
                      />
                    </View>
                    <Text style={{ color: theme.textMuted }} className="text-[10px]">
                      Budget: {formatCurrency(selectedEventModal.budget!)} ({Math.round(((selectedEventModal.total_spent || 0) / selectedEventModal.budget!) * 100)}% utilized)
                    </Text>
                  </>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Category Breakdown Inside this Vacation */}
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2.5">
                  What was spent on this trip
                </Text>

                {(!selectedEventModal.category_breakdown || selectedEventModal.category_breakdown.length === 0) ? (
                  <Text style={{ color: theme.textMuted }} className="text-xs mb-4">
                    No categorized expenses recorded for this event yet.
                  </Text>
                ) : (
                  <View
                    style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                    className="rounded-2xl p-4 mb-4"
                  >
                    {selectedEventModal.category_breakdown.map((cat, cIdx) => (
                      <View key={cIdx} className="mb-3 last:mb-0">
                        <View className="flex-row justify-between items-center mb-1">
                          <View className="flex-row items-center flex-1 mr-2">
                            <CategoryIcon icon={cat.icon} color={cat.color} size={14} containerSize={26} />
                            <Text style={{ color: theme.textPrimary }} className="text-xs font-bold ml-2">
                              {cat.name}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text style={{ color: theme.textPrimary }} className="text-xs font-bold">
                              {formatCurrency(cat.total)}
                            </Text>
                            <Text style={{ color: theme.textSecondary }} className="text-[10px]">
                              {cat.percentage}%
                            </Text>
                          </View>
                        </View>
                        <View style={{ backgroundColor: theme.card }} className="h-1.5 rounded-full overflow-hidden">
                          <View
                            style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                            className="h-full rounded-full"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Individual Transactions for this Event */}
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
                  Trip Transactions ({eventTransactions.length})
                </Text>

                {eventTransactions.length === 0 ? (
                  <Text style={{ color: theme.textMuted }} className="text-xs mb-4">
                    No transactions found for this event.
                  </Text>
                ) : (
                  <View
                    style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                    className="rounded-2xl divide-y mb-6"
                  >
                    {eventTransactions.map((tx) => (
                      <TouchableOpacity
                        key={tx.id}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedTxForModal(tx);
                          setTxModalVisible(true);
                        }}
                        style={{ borderBottomColor: theme.border }}
                        className="p-3.5 flex-row justify-between items-center border-b last:border-0"
                      >
                        <View className="flex-1 mr-2">
                          <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold" numberOfLines={1}>
                            {tx.description || tx.category_name}
                          </Text>
                          <Text style={{ color: theme.textMuted }} className="text-[10px]">
                            {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} • {tx.category_name || "Uncategorized"}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Text style={{ color: tx.type === "income" ? theme.success : theme.textPrimary }} className="text-xs font-bold mr-1">
                            {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </Text>
                          <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Add New Event Modal */}
      <Modal
        visible={showAddEventModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddEventModal(false)}
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
              <View>
                <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                  Create Event / Vacation
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs mt-0.5">
                  Roll up multiple expenses under one trip or project
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddEventModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-1.5">
              Event Title
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                borderWidth: 1,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-2xl mb-3 text-sm font-medium"
              placeholder="e.g. Summer Vacation, Tokyo Trip, Apartment Remodel..."
              placeholderTextColor={theme.textMuted}
              value={newEventName}
              onChangeText={setNewEventName}
            />

            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-1.5">
              Optional Budget
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                borderWidth: 1,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-2xl mb-3 text-sm font-medium"
              placeholder="e.g. 1500"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              value={newEventBudget}
              onChangeText={setNewEventBudget}
            />

            {/* Icon Picker */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Select Icon
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {[
                  { name: "flight", label: "Flight" },
                  { name: "beach-access", label: "Beach" },
                  { name: "hotel", label: "Hotel" },
                  { name: "directions-car", label: "Roadtrip" },
                  { name: "restaurant", label: "Dining" },
                  { name: "celebration", label: "Party" },
                  { name: "hiking", label: "Outdoor" },
                  { name: "shopping-bag", label: "Shopping" },
                  { name: "build", label: "Remodel" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.name}
                    onPress={() => setNewEventIcon(opt.name)}
                    style={{
                      backgroundColor: newEventIcon === opt.name ? newEventColor : theme.cardSecondary,
                    }}
                    className="p-3 rounded-2xl items-center justify-center min-w-[56px]"
                  >
                    <MaterialIcons
                      name={opt.name as any}
                      size={20}
                      color={newEventIcon === opt.name ? "white" : theme.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Color Picker */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Select Color
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
              <View className="flex-row gap-2.5">
                {["#F43F5E", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewEventColor(c)}
                    style={{
                      backgroundColor: c,
                      borderColor: newEventColor === c ? "#FFFFFF" : "transparent",
                      borderWidth: newEventColor === c ? 3 : 0,
                    }}
                    className="w-9 h-9 rounded-full items-center justify-center shadow-sm"
                  >
                    {newEventColor === c && (
                      <MaterialIcons name="check" size={18} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowAddEventModal(false)}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-base">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEvent}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-4 rounded-2xl items-center shadow-md"
              >
                <Text className="text-white font-bold text-base">Create Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail & Edit Modal */}
      <TransactionModal
        visible={txModalVisible}
        transaction={selectedTxForModal}
        onClose={() => {
          setTxModalVisible(false);
          setSelectedTxForModal(null);
        }}
        onUpdated={() => {
          triggerRefresh();
          loadTabContent(activeTab);
        }}
      />

      {/* Custom Confirmation / Alert Dialog */}
      <CustomDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText || "OK"}
        cancelText={dialogState.cancelText || "Cancel"}
        onConfirm={() => {
          setDialogState((prev) => ({ ...prev, visible: false }));
          dialogState.onConfirm?.();
        }}
        onCancel={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
