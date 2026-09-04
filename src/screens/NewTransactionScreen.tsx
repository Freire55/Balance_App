import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "../components/CategoryIcon";
import { CustomDialog } from "../components/CustomDialog";
import { useApp } from "../context/AppContext";
import { queryCache } from "../database/cache";
import {
  addCategory,
  addFinanceEvent,
  addRecurringTransaction,
  addTransaction,
  getCategories,
  getFinanceEvents,
} from "../database/database";
import { processRecurringTransactions } from "../database/recurringEngine";
import { Category, FinanceEvent, RecurringFrequency, TransactionType } from "../database/types";
import { NewTransactionRouteProp, RootNavigationProp } from "../navigation/types";

const COMMON_TAGS = ["tax-deductible", "vacation", "work", "gift", "grocery", "health", "dining"];

export default function NewTransactionScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<NewTransactionRouteProp>();
  const insets = useSafeAreaInsets();
  const { settings, triggerRefresh, theme, isDark } = useApp();

  const [mode, setMode] = useState<"normal" | "recurring">(
    route.params?.initialMode === "recurring" ? "recurring" : "normal"
  );
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [categories, setCategories] = useState<Category[]>(() => queryCache.get("categories") || []);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(() => (queryCache.get<Category[]>("categories") || [])[0] || null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  // Custom Date states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "custom">("today");
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [pickerMonthDate, setPickerMonthDate] = useState<Date>(new Date());

  // Events / Trips (e.g. Vacation tracking)
  const [events, setEvents] = useState<FinanceEvent[]>(() => queryCache.get("finance_events") || []);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventIcon, setNewEventIcon] = useState("flight");
  const [newEventColor, setNewEventColor] = useState("#F43F5E");
  const [newEventBudget, setNewEventBudget] = useState("");

  // Recurring fields
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endMonthsCount] = useState(12);

  // New Category Modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("category");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");

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

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      queryCache.fetchWithCache("categories", () => getCategories(), 60000),
      queryCache.fetchWithCache("finance_events", () => getFinanceEvents(), 60000),
    ])
      .then(([catRes, eventRes]) => {
        if (isMounted) {
          setCategories(catRes.data);
          setSelectedCategory((prev) => prev || (catRes.data.length > 0 ? catRes.data[0] : null));
          setEvents(eventRes.data);
        }
      })
      .catch((error) => {
        console.error("Error loading categories or events:", error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setDialogState({
        visible: true,
        title: "Category Name",
        message: "Please enter a name for the new category.",
        type: "alert",
      });
      return;
    }

    try {
      const newId = await addCategory(
        newCategoryName.trim(),
        newCategoryIcon,
        newCategoryColor
      );
      const updatedCats = await getCategories();
      setCategories(updatedCats);
      const newlyCreated = updatedCats.find((c) => c.id === newId);
      if (newlyCreated) setSelectedCategory(newlyCreated);
      setNewCategoryName("");
      setShowAddCategoryModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerRefresh();
    } catch (error) {
      console.error("Error creating category:", error);
      setDialogState({
        visible: true,
        title: "Error",
        message: "A category with this name already exists.",
        type: "alert",
      });
    }
  };

  const handleCreateEvent = async () => {
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
      const newId = await addFinanceEvent(
        newEventName.trim(),
        newEventDescription.trim() || undefined,
        newEventIcon,
        newEventColor,
        parsedBudget
      );
      const updatedEvents = await getFinanceEvents();
      setEvents(updatedEvents);
      setSelectedEventId(newId);
      setNewEventName("");
      setNewEventDescription("");
      setNewEventBudget("");
      setShowAddEventModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const handleToggleTag = (tag: string) => {
    const existing = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (existing.includes(tag)) {
      setTags(existing.filter((t) => t !== tag).join(", "));
    } else {
      setTags([...existing, tag].join(", "));
    }
  };

  const handleSubmit = async () => {
    const sanitizedAmount = amount.replace(/[^0-9.,]/g, "").replace(",", ".").trim();
    const parsedAmount = parseFloat(sanitizedAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setDialogState({
        visible: true,
        title: "Invalid Amount",
        message: "Please enter a valid positive number for the transaction amount.",
        type: "alert",
      });
      return;
    }

    const categoryToUse = selectedCategory || (categories.length > 0 ? categories[0] : null);
    if (!categoryToUse) {
      setDialogState({
        visible: true,
        title: "Missing Category",
        message: "Please select or create a category.",
        type: "alert",
      });
      return;
    }

    try {
      if (mode === "normal") {
        const now = new Date();
        const finalDate = new Date(selectedDate);
        finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

        await addTransaction({
          type,
          amount: parsedAmount,
          category_id: categoryToUse.id,
          description: description.trim() || undefined,
          tags: tags.trim() || undefined,
          created_at: finalDate.toISOString(),
          event_id: selectedEventId || null,
        });
      } else {
        const startDate = new Date(selectedDate);
        let endDateIso: string | undefined = undefined;

        if (hasEndDate) {
          const calculatedEnd = new Date(startDate);
          calculatedEnd.setMonth(calculatedEnd.getMonth() + endMonthsCount);
          endDateIso = calculatedEnd.toISOString();
        }

        await addRecurringTransaction({
          type,
          amount: parsedAmount,
          category_id: categoryToUse.id,
          description: description.trim() || undefined,
          frequency,
          day_of_month: frequency === "monthly" ? dayOfMonth : 1,
          start_date: startDate.toISOString(),
          end_date: endDateIso,
          is_active: 1,
        });

        try {
          await processRecurringTransactions();
        } catch (recErr) {
          console.warn("Recurring process note:", recErr);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerRefresh();

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("MainTabs", { screen: "Home" });
      }
    } catch (error) {
      console.error("Error creating entry:", error);
      setDialogState({
        visible: true,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to save transaction.",
        type: "alert",
      });
    }
  };

  const iconOptions = [
    { name: "receipt-long", label: "Receipt" },
    { name: "fastfood", label: "Food" },
    { name: "local-cafe", label: "Coffee" },
    { name: "directions-car", label: "Car" },
    { name: "local-gas-station", label: "Fuel" },
    { name: "shopping-bag", label: "Shopping" },
    { name: "fitness-center", label: "Fitness" },
    { name: "medical-services", label: "Health" },
    { name: "flight", label: "Flight" },
    { name: "hotel", label: "Hotel" },
    { name: "movie", label: "Movie" },
    { name: "school", label: "Education" },
    { name: "devices", label: "Tech" },
    { name: "savings", label: "Savings" },
    { name: "category", label: "Other" },
  ];

  const colorOptions = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#64748B",
    "#14B8A6",
    "#F97316",
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Revolut/Robinhood Minimalist Header */}
        <View
          style={{
            paddingTop: Math.max(insets?.top ?? 0, 16),
            backgroundColor: theme.bg,
          }}
          className="px-6 pb-2"
        >
          <View className="flex-row items-center justify-between py-2 mb-3">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate("MainTabs", { screen: "Home" });
                }
              }}
              style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: theme.textPrimary }} className="text-xl font-extrabold tracking-tight">
              New Entry
            </Text>
            <View className="w-10" />
          </View>

          {/* Mode Switcher: One-Time vs Recurring */}
          <View
            style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
            className="rounded-2xl p-1 flex-row"
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("normal");
              }}
              style={{
                backgroundColor: mode === "normal" ? theme.card : "transparent",
              }}
              className="flex-1 py-2.5 rounded-xl items-center shadow-xs"
            >
              <Text
                style={{
                  color: mode === "normal" ? theme.textPrimary : theme.textSecondary,
                }}
                className="font-bold text-xs"
              >
                One-Time Transaction
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("recurring");
              }}
              style={{
                backgroundColor: mode === "recurring" ? theme.card : "transparent",
              }}
              className="flex-1 py-2.5 rounded-xl items-center shadow-xs"
            >
              <Text
                style={{
                  color: mode === "recurring" ? theme.textPrimary : theme.textSecondary,
                }}
                className="font-bold text-xs"
              >
                Recurring Schedule
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-6 mt-4">
          {/* Transaction Type Switcher */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-2xl p-1.5 shadow-sm flex-row mb-4"
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setType("expense");
              }}
              className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center ${
                type === "expense" ? "bg-rose-500 shadow-md" : ""
              }`}
            >
              <MaterialIcons
                name="arrow-downward"
                size={18}
                color={type === "expense" ? "white" : theme.textSecondary}
              />
              <Text
                style={{
                  color: type === "expense" ? "#FFFFFF" : theme.textSecondary,
                }}
                className="font-bold text-sm ml-1.5"
              >
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setType("income");
              }}
              className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center ${
                type === "income" ? "bg-emerald-500 shadow-md" : ""
              }`}
            >
              <MaterialIcons
                name="arrow-upward"
                size={18}
                color={type === "income" ? "white" : theme.textSecondary}
              />
              <Text
                style={{
                  color: type === "income" ? "#FFFFFF" : theme.textSecondary,
                }}
                className="font-bold text-sm ml-1.5"
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Hero Input */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm mb-4"
          >
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Amount
            </Text>
            <View className="flex-row items-center justify-between">
              <TextInput
                style={{ color: theme.textPrimary }}
                className="flex-1 text-4xl font-extrabold"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus={false}
                placeholderTextColor={theme.textMuted}
              />
              <Text
                style={{ color: theme.textSecondary }}
                className="text-2xl font-bold ml-2"
              >
                {settings.currencySymbol}
              </Text>
            </View>
          </View>

          {/* Category Selector */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm mb-4"
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                Category
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddCategoryModal(true)}
                className="flex-row items-center"
              >
                <MaterialIcons name="add" size={14} color={theme.primary} />
                <Text style={{ color: theme.primary }} className="text-xs font-bold ml-1">
                  New Category
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory?.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCategory(cat);
                      }}
                      style={{
                        backgroundColor: isSelected
                          ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                          : theme.cardSecondary,
                        borderColor: isSelected ? theme.primary : theme.border,
                        borderWidth: 1,
                      }}
                      className="items-center justify-center p-3 rounded-2xl min-w-[76px]"
                    >
                      <CategoryIcon
                        icon={cat.icon}
                        color={cat.color}
                        size={20}
                        containerSize={40}
                      />
                      <Text
                        style={{
                          color: isSelected ? theme.primary : theme.textPrimary,
                        }}
                        className="text-[11px] font-semibold mt-1.5 text-center"
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Date Selector (Normal mode) */}
          {mode === "normal" && (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <View className="flex-row justify-between items-center mb-2.5">
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                  Transaction Date
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPickerMonthDate(new Date(selectedDate));
                    setShowDatePickerModal(true);
                  }}
                  className="flex-row items-center"
                >
                  <MaterialIcons name="edit-calendar" size={14} color={theme.primary} />
                  <Text style={{ color: theme.primary }} className="text-xs font-bold ml-1">
                    Custom Date...
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Formatted Date Preview Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setPickerMonthDate(new Date(selectedDate));
                  setShowDatePickerModal(true);
                }}
                style={{
                  backgroundColor: theme.cardSecondary,
                  borderColor: theme.border,
                  borderWidth: 1,
                }}
                className="flex-row items-center justify-between p-3.5 rounded-2xl mb-3"
              >
                <View className="flex-row items-center">
                  <View
                    style={{ backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF" }}
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                  >
                    <MaterialIcons name="calendar-today" size={18} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={{ color: theme.textPrimary }} className="font-bold text-sm">
                      {selectedDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                    <Text style={{ color: theme.textSecondary }} className="text-[11px]">
                      {datePreset === "today"
                        ? "Today"
                        : datePreset === "yesterday"
                        ? "Yesterday"
                        : "Custom Selected Day"}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Quick Chips: Today, Yesterday, Pick Date */}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDate(new Date());
                    setDatePreset("today");
                  }}
                  style={{
                    backgroundColor: datePreset === "today" ? theme.primary : theme.cardSecondary,
                    borderColor: datePreset === "today" ? theme.primary : theme.border,
                    borderWidth: 1,
                  }}
                  className="flex-1 py-2.5 rounded-xl items-center"
                >
                  <Text
                    style={{
                      color: datePreset === "today" ? "#FFFFFF" : theme.textPrimary,
                    }}
                    className="font-bold text-xs"
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setSelectedDate(y);
                    setDatePreset("yesterday");
                  }}
                  style={{
                    backgroundColor: datePreset === "yesterday" ? theme.primary : theme.cardSecondary,
                    borderColor: datePreset === "yesterday" ? theme.primary : theme.border,
                    borderWidth: 1,
                  }}
                  className="flex-1 py-2.5 rounded-xl items-center"
                >
                  <Text
                    style={{
                      color: datePreset === "yesterday" ? "#FFFFFF" : theme.textPrimary,
                    }}
                    className="font-bold text-xs"
                  >
                    Yesterday
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPickerMonthDate(new Date(selectedDate));
                    setShowDatePickerModal(true);
                  }}
                  style={{
                    backgroundColor: datePreset === "custom" ? theme.primary : theme.cardSecondary,
                    borderColor: datePreset === "custom" ? theme.primary : theme.border,
                    borderWidth: 1,
                  }}
                  className="flex-1 py-2.5 rounded-xl items-center"
                >
                  <Text
                    style={{
                      color: datePreset === "custom" ? "#FFFFFF" : theme.textPrimary,
                    }}
                    className="font-bold text-xs"
                  >
                    Calendar...
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Event / Trip Selector (Vacation Tracking) */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm mb-4"
          >
            <View className="flex-row justify-between items-center mb-2.5">
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                  Event / Trip (Optional)
                </Text>
                <Text style={{ color: theme.textMuted }} className="text-[11px] mt-0.5">
                  Tag to a vacation, trip, or major project
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddEventModal(true)}
                className="flex-row items-center"
              >
                <MaterialIcons name="add" size={14} color={theme.primary} />
                <Text style={{ color: theme.primary }} className="text-xs font-bold ml-1">
                  New Event
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2 pt-1">
                {/* None Option */}
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedEventId(null);
                  }}
                  style={{
                    backgroundColor: selectedEventId === null ? theme.primary : theme.cardSecondary,
                    borderColor: selectedEventId === null ? theme.primary : theme.border,
                    borderWidth: 1,
                  }}
                  className="px-3.5 py-2 rounded-xl items-center justify-center flex-row"
                >
                  <Text
                    style={{
                      color: selectedEventId === null ? "#FFFFFF" : theme.textPrimary,
                    }}
                    className="font-bold text-xs"
                  >
                    None (Regular)
                  </Text>
                </TouchableOpacity>

                {/* Existing Events */}
                {events.map((ev) => {
                  const isSelected = selectedEventId === ev.id;
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedEventId(isSelected ? null : ev.id);
                      }}
                      style={{
                        backgroundColor: isSelected
                          ? ev.color || theme.primary
                          : theme.cardSecondary,
                        borderColor: isSelected ? ev.color || theme.primary : theme.border,
                        borderWidth: 1,
                      }}
                      className="px-3.5 py-2 rounded-xl items-center justify-center flex-row"
                    >
                      <MaterialIcons
                        name={ev.icon as any || "flight"}
                        size={14}
                        color={isSelected ? "#FFFFFF" : ev.color || theme.primary}
                      />
                      <Text
                        style={{
                          color: isSelected ? "#FFFFFF" : theme.textPrimary,
                        }}
                        className="font-bold text-xs ml-1.5"
                      >
                        {ev.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Recurring Interval & Details (Recurring mode) */}
          {mode === "recurring" && (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2.5">
                Recurring Frequency
              </Text>

              {/* Multi-Frequency Switcher */}
              <View className="flex-row gap-2 mb-4">
                {[
                  { key: "weekly" as const, label: "Weekly" },
                  { key: "biweekly" as const, label: "Bi-Weekly" },
                  { key: "monthly" as const, label: "Monthly" },
                  { key: "yearly" as const, label: "Yearly" },
                ].map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFrequency(f.key);
                    }}
                    style={{
                      backgroundColor: frequency === f.key ? theme.primary : theme.cardSecondary,
                      borderColor: frequency === f.key ? theme.primary : theme.border,
                      borderWidth: 1,
                    }}
                    className="flex-1 py-2 rounded-xl items-center"
                  >
                    <Text
                      style={{
                        color: frequency === f.key ? "#FFFFFF" : theme.textPrimary,
                      }}
                      className="text-xs font-bold"
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {frequency === "monthly" && (
                <View
                  style={{ borderBottomColor: theme.border }}
                  className="flex-row justify-between items-center py-3 border-b"
                >
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                    Monthly Execution Day
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => setDayOfMonth(Math.max(1, dayOfMonth - 1))}
                      style={{ backgroundColor: theme.cardSecondary }}
                      className="w-8 h-8 rounded-lg items-center justify-center"
                    >
                      <Text style={{ color: theme.textPrimary }} className="font-bold">-</Text>
                    </TouchableOpacity>
                    <Text style={{ color: theme.textPrimary }} className="font-bold text-sm w-8 text-center">
                      {dayOfMonth}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setDayOfMonth(Math.min(28, dayOfMonth + 1))}
                      style={{ backgroundColor: theme.cardSecondary }}
                      className="w-8 h-8 rounded-lg items-center justify-center"
                    >
                      <Text style={{ color: theme.textPrimary }} className="font-bold">+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View className="flex-row justify-between items-center pt-3">
                <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                  End Date Limit?
                </Text>
                <TouchableOpacity
                  onPress={() => setHasEndDate(!hasEndDate)}
                  style={{
                    backgroundColor: hasEndDate ? theme.primary : theme.cardSecondary,
                  }}
                  className="px-3 py-1.5 rounded-lg"
                >
                  <Text
                    style={{
                      color: hasEndDate ? "#FFFFFF" : theme.textSecondary,
                    }}
                    className="text-xs font-bold"
                  >
                    {hasEndDate ? "1 Year Limit" : "No Expiry"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Tags Section (Feature C) */}
          {mode === "normal" && (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
                Tags & Labels (e.g. #vacation)
              </Text>
              <TextInput
                style={{
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border,
                  borderWidth: 1,
                  color: theme.textPrimary,
                }}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold mb-2.5"
                placeholder="Comma separated: vacation, tax, work"
                placeholderTextColor={theme.textMuted}
                value={tags}
                onChangeText={setTags}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-1.5">
                  {COMMON_TAGS.map((t) => {
                    const active = tags.includes(t);
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => handleToggleTag(t)}
                        style={{
                          backgroundColor: active
                            ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                            : theme.cardSecondary,
                          borderColor: active ? theme.primary : theme.border,
                          borderWidth: 1,
                        }}
                        className="px-2.5 py-1 rounded-lg"
                      >
                        <Text
                          style={{
                            color: active ? theme.primary : theme.textSecondary,
                          }}
                          className="text-[11px] font-medium"
                        >
                          #{t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Notes / Description */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm mb-6"
          >
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Description / Notes
            </Text>
            <TextInput
              style={{ color: theme.textPrimary }}
              className="text-sm font-medium"
              placeholder="e.g. Weekly supermarket, Monthly salary, Coffee..."
              placeholderTextColor={theme.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            style={{
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 6,
            }}
            className="rounded-2xl py-4 items-center justify-center shadow-lg"
          >
            <Text className="text-white font-bold text-base">
              {mode === "normal" ? "Save Transaction" : "Save Recurring Schedule"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add New Category Modal */}
      <Modal
        visible={showAddCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddCategoryModal(false)}
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
                Create New Category
              </Text>
              <TouchableOpacity onPress={() => setShowAddCategoryModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-1.5">
              Category Name
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                borderWidth: 1,
                color: theme.textPrimary,
              }}
              className="rounded-xl px-4 py-3 text-sm font-semibold mb-4"
              placeholder="e.g. Pet Care, Online Shopping..."
              placeholderTextColor={theme.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />

            {/* Icon Chooser */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Select Icon
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {iconOptions.map((item) => (
                  <TouchableOpacity
                    key={item.name}
                    onPress={() => setNewCategoryIcon(item.name)}
                    style={{
                      backgroundColor: newCategoryIcon === item.name
                        ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                        : theme.cardSecondary,
                      borderColor: newCategoryIcon === item.name ? theme.primary : theme.border,
                      borderWidth: 1,
                    }}
                    className="w-11 h-11 rounded-xl items-center justify-center"
                  >
                    <MaterialIcons
                      name={item.name as any}
                      size={20}
                      color={newCategoryIcon === item.name ? theme.primary : theme.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Color Chooser */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Select Color
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
              <View className="flex-row gap-2.5">
                {colorOptions.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setNewCategoryColor(c)}
                    style={{
                      backgroundColor: c,
                      borderColor: newCategoryColor === c ? "#FFFFFF" : "transparent",
                      borderWidth: newCategoryColor === c ? 3 : 0,
                    }}
                    className="w-9 h-9 rounded-full items-center justify-center shadow-sm"
                  >
                    {newCategoryColor === c && (
                      <MaterialIcons name="check" size={18} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowAddCategoryModal(false)}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-base">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateCategory}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-4 rounded-2xl items-center shadow-md"
              >
                <Text className="text-white font-bold text-base">Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Date Picker Modal */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/70 px-6">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
          >
            {/* Month Header Navigation */}
            <View className="flex-row justify-between items-center mb-4">
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(pickerMonthDate);
                  d.setMonth(d.getMonth() - 1);
                  setPickerMonthDate(d);
                }}
                style={{ backgroundColor: theme.cardSecondary }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <MaterialIcons name="chevron-left" size={24} color={theme.textPrimary} />
              </TouchableOpacity>

              <Text style={{ color: theme.textPrimary }} className="text-base font-bold">
                {pickerMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  const d = new Date(pickerMonthDate);
                  d.setMonth(d.getMonth() + 1);
                  setPickerMonthDate(d);
                }}
                style={{ backgroundColor: theme.cardSecondary }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <MaterialIcons name="chevron-right" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Weekday Labels */}
            <View className="flex-row justify-between mb-2 px-1">
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

            {/* Days Grid */}
            <View className="flex-row flex-wrap justify-between">
              {(() => {
                const year = pickerMonthDate.getFullYear();
                const month = pickerMonthDate.getMonth();
                const firstDayOffset = new Date(year, month, 1).getDay();
                const totalDays = new Date(year, month + 1, 0).getDate();
                const slots = [];

                for (let i = 0; i < firstDayOffset; i++) {
                  slots.push(<View key={`empty-${i}`} className="w-[12%] aspect-square m-0.5" />);
                }

                for (let d = 1; d <= totalDays; d++) {
                  const cellDate = new Date(year, month, d);
                  const isSelected =
                    selectedDate.getFullYear() === year &&
                    selectedDate.getMonth() === month &&
                    selectedDate.getDate() === d;
                  const isToday =
                    new Date().getFullYear() === year &&
                    new Date().getMonth() === month &&
                    new Date().getDate() === d;

                  slots.push(
                    <TouchableOpacity
                      key={`day-${d}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDate(cellDate);
                        setDatePreset("custom");
                        setShowDatePickerModal(false);
                      }}
                      style={{
                        backgroundColor: isSelected
                          ? theme.primary
                          : isToday
                          ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                          : theme.cardSecondary,
                        borderColor: isSelected ? theme.primary : isToday ? theme.primary : "transparent",
                        borderWidth: isSelected || isToday ? 1.5 : 0,
                      }}
                      className="w-[12%] aspect-square m-0.5 rounded-xl items-center justify-center shadow-xs"
                    >
                      <Text
                        style={{
                          color: isSelected
                            ? "#FFFFFF"
                            : isToday
                            ? theme.primary
                            : theme.textPrimary,
                          fontWeight: isSelected || isToday ? "bold" : "600",
                        }}
                        className="text-xs"
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                return slots;
              })()}
            </View>

            {/* Modal Quick Actions */}
            <View className="flex-row gap-2.5 mt-5">
              <TouchableOpacity
                onPress={() => {
                  setSelectedDate(new Date());
                  setDatePreset("today");
                  setShowDatePickerModal(false);
                }}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-3 rounded-xl items-center"
              >
                <Text style={{ color: theme.textSecondary }} className="font-bold text-xs">
                  Set to Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDatePickerModal(false)}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-3 rounded-xl items-center shadow-sm"
              >
                <Text className="text-white font-bold text-xs">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add New Event Modal (Vacation / Major Project) */}
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
              Optional Budget ({settings.currencySymbol})
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
                onPress={handleCreateEvent}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-4 rounded-2xl items-center shadow-md"
              >
                <Text className="text-white font-bold text-base">Create Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </KeyboardAvoidingView>
  );
}
