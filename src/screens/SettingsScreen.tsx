import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
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
  deleteCategory,
  editCategory,
  getCategories,
  getFilteredTransactions,
  resetDatabase,
  seedDatabase,
} from "../database/database";
import {
  exportBackupFile,
  exportTransactionsToCsv,
  optimizeDatabase,
  restoreFromBackupJson,
} from "../database/exportImport";
import { Category } from "../database/types";
import { sendTestNotification } from "../services/notifications";

const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro", position: "suffix" as const },
  { code: "USD", symbol: "$", name: "US Dollar", position: "prefix" as const },
  { code: "GBP", symbol: "£", name: "British Pound", position: "prefix" as const },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", position: "prefix" as const },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar", position: "prefix" as const },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", position: "prefix" as const },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", position: "prefix" as const },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", position: "prefix" as const },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    settings,
    updateCurrency,
    toggleHideBalance,
    setThemeMode,
    updateNotificationSettings,
    triggerRefresh,
    refreshTrigger,
    theme,
    isDark,
  } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Category Modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("category");
  const [categoryColor, setCategoryColor] = useState("#3B82F6");

  // Currency Modal state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonText, setRestoreJsonText] = useState("");

  const loadData = async (isManualRefresh = false) => {
    try {
      const [cats, txData] = await Promise.all([
        queryCache.fetchWithCache("categories", () => getCategories(), 60000, isManualRefresh),
        queryCache.fetchWithCache("settings_tx_meta", () => getFilteredTransactions({ limit: 1 }), 30000, isManualRefresh),
      ]);
      setCategories(cats.data);
      setTotalRecords(txData.data.totalCount);
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  };

  const isFocused = useIsFocused();
  const lastLoadedTriggerRef = useRef<number>(-1);

  useFocusEffect(
    useCallback(() => {
      if (lastLoadedTriggerRef.current !== refreshTrigger) {
        lastLoadedTriggerRef.current = refreshTrigger;
        loadData();
      }
    }, [refreshTrigger])
  );

  useEffect(() => {
    if (isFocused && lastLoadedTriggerRef.current !== refreshTrigger) {
      lastLoadedTriggerRef.current = refreshTrigger;
      loadData();
    }
  }, [isFocused, refreshTrigger]);

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

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryIcon("category");
    setCategoryColor("#3B82F6");
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryIcon(cat.icon || "category");
    setCategoryColor(cat.color || "#3B82F6");
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      setDialogState({
        visible: true,
        title: "Invalid Name",
        message: "Please enter a valid category name.",
        type: "alert",
      });
      return;
    }

    try {
      if (editingCategory) {
        await editCategory(editingCategory.id, categoryName.trim(), categoryIcon, categoryColor);
      } else {
        await addCategory(categoryName.trim(), categoryIcon, categoryColor);
      }
      setShowCategoryModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadData();
      triggerRefresh();
    } catch (e) {
      console.error("Error saving category:", e);
      setDialogState({
        visible: true,
        title: "Error",
        message: "Failed to save category. Name might already exist.",
        type: "alert",
      });
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    setDialogState({
      visible: true,
      title: "Delete Category",
      message: `Are you sure you want to delete "${cat.name}"? Transactions in this category will become Uncategorized.`,
      type: "danger",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          await deleteCategory(cat.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await loadData();
          triggerRefresh();
        } catch (e) {
          console.error("Error deleting category:", e);
          setDialogState({
            visible: true,
            title: "Error",
            message: "Failed to delete category.",
            type: "alert",
          });
        }
      },
    });
  };

  const handleExportCsv = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await exportTransactionsToCsv();
  };

  const handleExportJson = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await exportBackupFile();
  };

  const handleOpenRestoreModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestoreJsonText("");
    setShowRestoreModal(true);
  };

  const handleExecuteRestore = async () => {
    if (!restoreJsonText.trim()) {
      setDialogState({
        visible: true,
        title: "Backup Data Required",
        message: "Please paste your JSON backup data to restore.",
        type: "alert",
      });
      return;
    }

    setActionInProgress(true);
    setShowRestoreModal(false);
    try {
      const result = await restoreFromBackupJson(restoreJsonText.trim());
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await loadData();
        triggerRefresh();
        setDialogState({
          visible: true,
          title: "Restore Successful",
          message: "Your financial data and settings have been restored completely.",
          type: "success",
        });
      } else {
        setDialogState({
          visible: true,
          title: "Restore Failed",
          message: result.message || "Invalid backup format.",
          type: "alert",
        });
      }
    } catch (e: any) {
      console.error("Restore error:", e);
      setDialogState({
        visible: true,
        title: "Restore Error",
        message: e?.message || "Failed to restore database from backup.",
        type: "alert",
      });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleOptimizeDb = async () => {
    setActionInProgress(true);
    try {
      await optimizeDatabase();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDialogState({
        visible: true,
        title: "Database Optimized",
        message: "SQLite WAL and database indices have been vacuumed and defragmented.",
        type: "success",
      });
    } catch (e) {
      console.error("Optimize error:", e);
      setDialogState({
        visible: true,
        title: "Error",
        message: "Optimization failed.",
        type: "alert",
      });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSeedDemo = () => {
    setDialogState({
      visible: true,
      title: "Load 3-Year Demo Dataset",
      message: "This will seed 600+ realistic transactions, recurring schedules, and budgets across 2024–2026. Useful for testing reports.",
      type: "confirm",
      confirmText: "Load Demo Data",
      cancelText: "Cancel",
      onConfirm: async () => {
        setActionInProgress(true);
        try {
          await seedDatabase();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await loadData();
          triggerRefresh();
          setDialogState({
            visible: true,
            title: "Success",
            message: "600+ multi-year transactions, budgets, and goals loaded successfully!",
            type: "success",
          });
        } catch (e) {
          console.error("Seed error:", e);
          setDialogState({
            visible: true,
            title: "Error",
            message: "Failed to seed demo data.",
            type: "alert",
          });
        } finally {
          setActionInProgress(false);
        }
      },
    });
  };

  const handleResetDb = () => {
    setDialogState({
      visible: true,
      title: "Reset Entire Database",
      message: "Are you completely sure? This will wipe all transactions, budgets, goals, and recurring rules.",
      type: "danger",
      confirmText: "Erase Everything",
      cancelText: "Cancel",
      onConfirm: async () => {
        setActionInProgress(true);
        try {
          await resetDatabase();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await loadData();
          triggerRefresh();
          setDialogState({
            visible: true,
            title: "Reset Complete",
            message: "All data has been erased and restored to fresh initial state.",
            type: "success",
          });
        } catch (e) {
          console.error("Reset error:", e);
          setDialogState({
            visible: true,
            title: "Error",
            message: "Failed to reset database.",
            type: "alert",
          });
        } finally {
          setActionInProgress(false);
        }
      },
    });
  };

  const handleSendTestNotification = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await sendTestNotification();
    setDialogState({
      visible: true,
      title: "Notification Sent",
      message: "A test notification was triggered and logged to your In-App Notification Center.",
      type: "success",
    });
  };

  const iconOptions = [
    { name: "restaurant", label: "Dining" },
    { name: "local-grocery-store", label: "Groceries" },
    { name: "home", label: "Housing" },
    { name: "directions-car", label: "Transport" },
    { name: "bolt", label: "Utilities" },
    { name: "shopping-bag", label: "Shopping" },
    { name: "fitness-center", label: "Health" },
    { name: "movie", label: "Entertainment" },
    { name: "subscriptions", label: "Subscription" },
    { name: "flight", label: "Travel" },
    { name: "work", label: "Salary" },
    { name: "computer", label: "Freelance" },
    { name: "trending-up", label: "Invest" },
    { name: "card-giftcard", label: "Gift" },
  ];

  const colorOptions = [
    "#3B82F6", "#10B981", "#F97316", "#EC4899", "#8B5CF6",
    "#06B6D4", "#EAB308", "#F43F5E", "#6366F1", "#64748B",
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
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
            System & Preferences
          </Text>
          <Text style={{ color: theme.textPrimary }} className="text-2xl font-extrabold tracking-tight mt-0.5">
            Settings
          </Text>
        </View>

        <View className="px-6 mt-4">
          {/* Loading indicator */}
          {actionInProgress && (
            <View
              style={{
                backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF",
                borderColor: theme.primary,
                borderWidth: 1,
              }}
              className="p-4 rounded-2xl mb-4 flex-row items-center justify-center"
            >
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={{ color: theme.primary }} className="font-bold text-xs ml-2">
                Processing Data Operation...
              </Text>
            </View>
          )}

          {/* Database Health Card */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm mb-5"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5" }}
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="storage" size={20} color="#059669" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-bold text-base">Local SQLite Engine</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">WAL Journal • 100% Offline</Text>
                </View>
              </View>
              <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full">
                <Text className="text-emerald-500 text-[11px] font-bold">Encrypted Local</Text>
              </View>
            </View>

            <View
              style={{ borderTopColor: theme.border }}
              className="flex-row justify-between pt-3 border-t"
            >
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs">Records</Text>
                <Text style={{ color: theme.textPrimary }} className="text-sm font-bold mt-0.5">{totalRecords}</Text>
              </View>
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs">Categories</Text>
                <Text style={{ color: theme.textPrimary }} className="text-sm font-bold mt-0.5">{categories.length}</Text>
              </View>
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs">Theme</Text>
                <Text style={{ color: theme.textPrimary }} className="text-sm font-bold mt-0.5">
                  {isDark ? "Dark 🌙" : "Light ☀️"}
                </Text>
              </View>
            </View>
          </View>

          {/* Section 1: Appearance (Light vs Dark Only) */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Appearance (Light / Dark)
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-4 shadow-sm mb-5"
          >
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setThemeMode("light");
                }}
                style={{
                  backgroundColor: !isDark ? theme.primary : theme.cardSecondary,
                  borderColor: !isDark ? theme.primary : theme.border,
                  borderWidth: 1,
                }}
                className="flex-1 py-3.5 rounded-2xl items-center flex-row justify-center"
              >
                <MaterialIcons name="light-mode" size={18} color={!isDark ? "white" : theme.textSecondary} />
                <Text
                  style={{ color: !isDark ? "white" : theme.textPrimary }}
                  className="font-bold text-sm ml-2"
                >
                  Light Mode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setThemeMode("dark");
                }}
                style={{
                  backgroundColor: isDark ? theme.primary : theme.cardSecondary,
                  borderColor: isDark ? theme.primary : theme.border,
                  borderWidth: 1,
                }}
                className="flex-1 py-3.5 rounded-2xl items-center flex-row justify-center"
              >
                <MaterialIcons name="dark-mode" size={18} color={isDark ? "white" : theme.textSecondary} />
                <Text
                  style={{ color: isDark ? "white" : theme.textPrimary }}
                  className="font-bold text-sm ml-2"
                >
                  Dark Mode
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 2: Notifications Center & Settings */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Notifications & Alerts
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-4 shadow-sm mb-5 divide-y"
          >
            {/* Master Toggle */}
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between pb-3 border-b"
            >
              <View className="flex-1 mr-2">
                <Text style={{ color: theme.textPrimary }} className="font-bold text-sm">
                  Enable Notifications
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  Master toggle for all local & in-app alerts
                </Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(val) => updateNotificationSettings("notificationsEnabled", val)}
                trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Recurring Bills Alerts */}
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between py-3 border-b"
            >
              <View className="flex-1 mr-2">
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  Recurring Bill Reminders
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  Notifies when recurring transactions are recorded
                </Text>
              </View>
              <Switch
                value={settings.notifyRecurring}
                disabled={!settings.notificationsEnabled}
                onValueChange={(val) => updateNotificationSettings("notifyRecurring", val)}
                trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* End of Month Balance */}
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between py-3 border-b"
            >
              <View className="flex-1 mr-2">
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  End of Month Balance
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  Monthly cash flow, savings rate, and net balance summary
                </Text>
              </View>
              <Switch
                value={settings.notifyMonthEnd}
                disabled={!settings.notificationsEnabled}
                onValueChange={(val) => updateNotificationSettings("notifyMonthEnd", val)}
                trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* End of Year Review */}
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between py-3 border-b"
            >
              <View className="flex-1 mr-2">
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  End of Year Financial Review
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  Annual cumulative performance & total net wealth gains
                </Text>
              </View>
              <Switch
                value={settings.notifyYearEnd}
                disabled={!settings.notificationsEnabled}
                onValueChange={(val) => updateNotificationSettings("notifyYearEnd", val)}
                trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Budget Limit Warnings */}
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between py-3 border-b"
            >
              <View className="flex-1 mr-2">
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  Category Budget Alerts
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  Triggers alerts when 80% or 100% of category budget is spent
                </Text>
              </View>
              <Switch
                value={settings.notifyBudgets}
                disabled={!settings.notificationsEnabled}
                onValueChange={(val) => updateNotificationSettings("notifyBudgets", val)}
                trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Test Notification Button */}
            <View className="pt-3">
              <TouchableOpacity
                onPress={handleSendTestNotification}
                style={{ backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF" }}
                className="py-3 rounded-2xl items-center flex-row justify-center"
              >
                <MaterialIcons name="notifications-active" size={18} color={theme.primary} />
                <Text style={{ color: theme.primary }} className="font-bold text-xs ml-2">
                  Send Test Notification
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 3: Currency & Privacy */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Display & Privacy
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-4 shadow-sm mb-5 divide-y"
          >
            {/* Currency Picker */}
            <TouchableOpacity
              onPress={() => setShowCurrencyModal(true)}
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between pb-3 border-b"
            >
              <View>
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  Active Currency
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  {settings.currency} ({settings.currencySymbol})
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Hide Balance Toggle */}
            <View className="flex-row items-center justify-between pt-3">
              <View>
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  Privacy Mode (Mask Balances)
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  Hides sensitive amounts from public viewing
                </Text>
              </View>
              <Switch
                value={settings.hideBalance}
                onValueChange={toggleHideBalance}
                trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Section 4: Categories Management */}
          <View className="flex-row justify-between items-center mb-2 ml-1">
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
              Categories ({categories.length})
            </Text>
            <TouchableOpacity onPress={openAddCategory}>
              <Text style={{ color: theme.primary }} className="text-xs font-bold">
                + Add Category
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-2 shadow-sm mb-5"
          >
            {categories.map((cat) => (
              <View
                key={cat.id}
                style={{ borderBottomColor: theme.border }}
                className="flex-row items-center justify-between p-3 border-b last:border-b-0"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <CategoryIcon
                    icon={cat.icon}
                    color={cat.color}
                    size={18}
                    containerSize={36}
                  />
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm ml-3">
                    {cat.name}
                  </Text>
                </View>

                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    onPress={() => openEditCategory(cat)}
                    style={{ backgroundColor: theme.cardSecondary }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <MaterialIcons name="edit" size={15} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(cat)}
                    style={{ backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "#FFF1F2" }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <MaterialIcons name="delete-outline" size={15} color="#F43F5E" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Section 5: Data Management & Backup */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Data Backup & Longevity
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-4 shadow-sm mb-5 divide-y"
          >
            {/* Export CSV */}
            <TouchableOpacity
              onPress={handleExportCsv}
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between pb-3.5 border-b"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="table-view" size={20} color={theme.primary} className="mr-3" />
                <View className="ml-2">
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                    Export Transactions CSV
                  </Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">
                    Spreadsheet format with tags and categories
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Export JSON */}
            <TouchableOpacity
              onPress={handleExportJson}
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between py-3.5 border-b"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="backup" size={20} color={theme.primary} className="mr-3" />
                <View className="ml-2">
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                    Full JSON Database Backup
                  </Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">
                    Complete state backup including budgets & goals
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Restore JSON Backup */}
            <TouchableOpacity
              onPress={handleOpenRestoreModal}
              style={{ borderBottomColor: theme.border }}
              className="flex-row items-center justify-between py-3.5 border-b"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="settings-backup-restore" size={20} color="#10B981" className="mr-3" />
                <View className="ml-2">
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                    Restore from JSON Backup
                  </Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">
                    Restore database state from exported backup file
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Optimize Database */}
            <TouchableOpacity
              onPress={handleOptimizeDb}
              className="flex-row items-center justify-between pt-3.5"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="speed" size={20} color={theme.primary} className="mr-3" />
                <View className="ml-2">
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                    Vacuum & Optimize Database
                  </Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">
                    Compact SQLite WAL files for high performance
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Section 6: Demo Data & Reset */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Demo Data & Reset
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-4 shadow-sm mb-6"
          >
            <TouchableOpacity
              onPress={handleSeedDemo}
              style={{ backgroundColor: theme.cardSecondary }}
              className="p-3.5 rounded-2xl mb-3 flex-row items-center justify-center"
            >
              <MaterialIcons name="dataset" size={18} color={theme.primary} />
              <Text style={{ color: theme.primary }} className="font-bold text-xs ml-2">
                Load 3-Year Demo Dataset (600+ Entries)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResetDb}
              style={{ backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "#FFF1F2" }}
              className="p-3.5 rounded-2xl flex-row items-center justify-center"
            >
              <MaterialIcons name="delete-forever" size={18} color="#F43F5E" />
              <Text className="text-rose-500 font-bold text-xs ml-2">
                Reset Entire Database
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Currency Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
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
                Select Currency
              </Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {CURRENCIES.map((curr) => {
                const isSelected = settings.currency === curr.code;
                return (
                  <TouchableOpacity
                    key={curr.code}
                    onPress={async () => {
                      await updateCurrency(curr.code, curr.symbol, curr.position);
                      setShowCurrencyModal(false);
                    }}
                    style={{
                      backgroundColor: isSelected ? theme.primary : theme.cardSecondary,
                    }}
                    className="p-4 rounded-2xl mb-2 flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center">
                      <Text
                        style={{
                          color: isSelected ? "white" : theme.textPrimary,
                        }}
                        className="font-bold text-base w-8"
                      >
                        {curr.symbol}
                      </Text>
                      <View className="ml-2">
                        <Text
                          style={{
                            color: isSelected ? "white" : theme.textPrimary,
                          }}
                          className="font-semibold text-sm"
                        >
                          {curr.name}
                        </Text>
                        <Text
                          style={{
                            color: isSelected ? "rgba(255, 255, 255, 0.8)" : theme.textSecondary,
                          }}
                          className="text-xs"
                        >
                          {curr.code}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={20} color="white" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Add/Edit Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderTopWidth: 1,
            }}
            className="rounded-t-3xl p-6 max-h-[85%]"
          >
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row justify-between items-center mb-4 pb-3 border-b"
            >
              <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
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
              value={categoryName}
              onChangeText={setCategoryName}
              placeholder="e.g. Pet Care, Books..."
              placeholderTextColor={theme.textMuted}
            />

            {/* Icon picker */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-2">
              Select Icon
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {iconOptions.map((item) => (
                  <TouchableOpacity
                    key={item.name}
                    onPress={() => setCategoryIcon(item.name)}
                    style={{
                      backgroundColor: categoryIcon === item.name
                        ? isDark ? "rgba(99, 102, 241, 0.25)" : "#EEF2FF"
                        : theme.cardSecondary,
                      borderColor: categoryIcon === item.name ? theme.primary : theme.border,
                      borderWidth: 1,
                    }}
                    className="w-11 h-11 rounded-xl items-center justify-center"
                  >
                    <MaterialIcons
                      name={item.name as any}
                      size={20}
                      color={categoryIcon === item.name ? theme.primary : theme.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Color picker */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-2">
              Select Color
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
              <View className="flex-row gap-2.5">
                {colorOptions.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategoryColor(c)}
                    style={{
                      backgroundColor: c,
                      borderColor: categoryColor === c ? "#FFFFFF" : "transparent",
                      borderWidth: categoryColor === c ? 3 : 0,
                    }}
                    className="w-9 h-9 rounded-full items-center justify-center shadow-sm"
                  >
                    {categoryColor === c && (
                      <MaterialIcons name="check" size={18} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveCategory}
                style={{ backgroundColor: theme.primary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Restore JSON Backup Modal */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderTopWidth: 1,
            }}
            className="rounded-t-3xl p-6 max-h-[85%]"
          >
            <View
              style={{ borderBottomColor: theme.border }}
              className="flex-row justify-between items-center mb-4 pb-3 border-b"
            >
              <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                Restore Database Backup
              </Text>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: theme.textSecondary }} className="text-xs mb-3">
              Paste the contents of your exported JSON backup file below. This will safely restore all categories, transactions, budgets, goals, and recurring schedules.
            </Text>

            <TextInput
              style={{
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                borderWidth: 1,
                color: theme.textPrimary,
                minHeight: 140,
                textAlignVertical: "top",
              }}
              className="rounded-xl px-4 py-3 text-xs font-mono mb-4"
              value={restoreJsonText}
              onChangeText={setRestoreJsonText}
              placeholder='Paste JSON here (e.g. {"version":3,"categories":[...],...})'
              placeholderTextColor={theme.textMuted}
              multiline
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowRestoreModal(false)}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExecuteRestore}
                style={{ backgroundColor: "#10B981" }}
                className="flex-1 py-4 rounded-2xl items-center"
              >
                <Text className="text-white font-bold">Restore Data</Text>
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
    </View>
  );
}
