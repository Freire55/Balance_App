import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useApp } from "../context/AppContext";
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
} from "../database/exportImport";
import { Category } from "../database/types";

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
  const { settings, updateCurrency, toggleHideBalance, triggerRefresh, refreshTrigger, theme } = useApp();

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

  const loadData = async () => {
    try {
      const [cats, txData] = await Promise.all([
        getCategories(),
        getFilteredTransactions({ limit: 1 }),
      ]);
      setCategories(cats);
      setTotalRecords(txData.totalCount);
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

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
      Alert.alert("Invalid Name", "Please enter a valid category name.");
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
      Alert.alert("Error", "Failed to save category. Name might already exist.");
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${cat.name}"? Transactions in this category will become Uncategorized.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadData();
              triggerRefresh();
            } catch (e) {
              console.error("Error deleting category:", e);
              Alert.alert("Error", "Failed to delete category.");
            }
          },
        },
      ]
    );
  };

  const handleExportCsv = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionInProgress(true);
    try {
      await exportTransactionsToCsv();
    } catch (e) {
      console.error("Export CSV error:", e);
      Alert.alert("Export Failed", "Could not export CSV file.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleBackupJson = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionInProgress(true);
    try {
      await exportBackupFile();
    } catch (e) {
      console.error("Backup JSON error:", e);
      Alert.alert("Backup Failed", "Could not export complete backup JSON.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleOptimizeDb = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionInProgress(true);
    try {
      await optimizeDatabase();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Database Optimized", "SQLite database vacuumed and B-Tree indexes rebuilt for optimal speed.");
    } catch (e) {
      console.error("Optimize DB error:", e);
      Alert.alert("Optimization Failed", "Could not complete database vacuum.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSeedDemo = () => {
    Alert.alert(
      "Populate Realistic 3-Year Dataset",
      "This will generate 3 full years (36 months) of high-volume, realistic fintech data with 600+ transactions across all categories, salaries, bonuses, dividends, and recurring rules. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load 3-Year Data",
          style: "default",
          onPress: async () => {
            setActionInProgress(true);
            try {
              await seedDatabase();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadData();
              triggerRefresh();
              Alert.alert("Success", "600+ multi-year transactions and recurring rules loaded successfully!");
            } catch (e) {
              console.error("Seed error:", e);
              Alert.alert("Error", "Failed to seed demo data.");
            } finally {
              setActionInProgress(false);
            }
          },
        },
      ]
    );
  };

  const handleResetDb = () => {
    Alert.alert(
      "Reset Entire Database",
      "Are you completely sure? This will wipe all transactions, recurring rules, and custom categories.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase Everything",
          style: "destructive",
          onPress: async () => {
            setActionInProgress(true);
            try {
              await resetDatabase();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await loadData();
              triggerRefresh();
              Alert.alert("Reset Complete", "All data has been erased and restored to fresh initial state.");
            } catch (e) {
              console.error("Reset error:", e);
              Alert.alert("Error", "Failed to reset database.");
            } finally {
              setActionInProgress(false);
            }
          },
        },
      ]
    );
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
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: Math.max(insets?.top ?? 0, 16),
            backgroundColor: '#0F172A',
          }}
          className="px-6 pb-6 rounded-b-3xl shadow-xl"
        >
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider pt-2">
            System & Preferences
          </Text>
          <Text className="text-white text-2xl font-bold mt-0.5">Settings</Text>
        </View>

        <View className="px-6 mt-4">
          {/* Action in Progress Loading Overlay */}
          {actionInProgress && (
            <View
              style={{
                backgroundColor: '#EEF2FF',
                borderColor: '#6366F1',
                borderWidth: 1,
              }}
              className="p-4 rounded-2xl mb-4 flex-row items-center justify-center"
            >
              <ActivityIndicator size="small" color="#6366F1" />
              <Text className="text-indigo-600 font-bold text-xs ml-2">Processing Data Operation...</Text>
            </View>
          )}

          {/* Database Health Card */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm mb-6"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#ECFDF5' }}
                  className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="storage" size={20} color="#059669" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-bold text-base">Local SQLite Engine</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">WAL Journal • 10+ Year Scale</Text>
                </View>
              </View>
              <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full">
                <Text className="text-emerald-600 text-[11px] font-bold">Healthy</Text>
              </View>
            </View>

            <View
              style={{ borderTopColor: theme.border }}
              className="flex-row justify-between pt-3 border-t"
            >
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs">Total Records</Text>
                <Text style={{ color: theme.textPrimary }} className="text-sm font-bold mt-0.5">{totalRecords}</Text>
              </View>
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs">Categories</Text>
                <Text style={{ color: theme.textPrimary }} className="text-sm font-bold mt-0.5">{categories.length}</Text>
              </View>
              <View>
                <Text style={{ color: theme.textSecondary }} className="text-xs">Storage</Text>
                <Text style={{ color: theme.textPrimary }} className="text-sm font-bold mt-0.5">On-Device</Text>
              </View>
            </View>
          </View>

          {/* Display & Currency Preferences Section */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Display & Currency
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl shadow-sm overflow-hidden mb-6"
          >
            {/* Currency Selector */}
            <TouchableOpacity
              onPress={() => setShowCurrencyModal(true)}
              style={{ borderBottomColor: theme.border }}
              className="p-4 flex-row items-center justify-between border-b"
            >
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#EEF2FF' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="payments" size={20} color="#4F46E5" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Currency Symbol</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">
                    {settings.currency} ({settings.currencySymbol})
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Privacy Mode Toggle */}
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#F1F5F9' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="visibility-off" size={20} color={theme.textSecondary} />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Privacy Mode</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">Mask balances with ••••••</Text>
                </View>
              </View>
              <Switch
                value={settings.hideBalance}
                onValueChange={toggleHideBalance}
                trackColor={{ false: "#CBD5E1", true: "#6366F1" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Categories Section */}
          <View className="flex-row justify-between items-center mb-2 ml-1">
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
              Categories ({categories.length})
            </Text>
            <TouchableOpacity onPress={openAddCategory} className="flex-row items-center">
              <MaterialIcons name="add" size={16} color="#4F46E5" />
              <Text style={{ color: "#4F46E5" }} className="font-bold text-xs ml-0.5">
                Add Category
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl shadow-sm overflow-hidden mb-6"
          >
            {categories.map((cat, index) => (
              <View
                key={cat.id}
                style={{
                  borderBottomColor: theme.border,
                  borderBottomWidth: index !== categories.length - 1 ? 1 : 0,
                }}
                className="p-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <CategoryIcon
                    icon={cat.icon}
                    color={cat.color}
                    size={18}
                    containerSize={36}
                  />
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm ml-3 flex-1" numberOfLines={1}>
                    {cat.name}
                  </Text>
                </View>

                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    onPress={() => openEditCategory(cat)}
                    style={{ backgroundColor: '#F1F5F9' }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <MaterialIcons name="edit" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(cat)}
                    style={{ backgroundColor: '#FFF1F2' }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <MaterialIcons name="delete-outline" size={16} color="#F43F5E" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Data Management & Export Section */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Data Longevity & Backups
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl shadow-sm overflow-hidden mb-6"
          >
            {/* Export CSV */}
            <TouchableOpacity
              onPress={handleExportCsv}
              style={{ borderBottomColor: theme.border }}
              className="p-4 flex-row items-center justify-between border-b"
            >
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#ECFDF5' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="table-view" size={20} color="#059669" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Export to CSV</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">Spreadsheet for Excel & Google Sheets</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Full JSON Backup */}
            <TouchableOpacity
              onPress={handleBackupJson}
              style={{ borderBottomColor: theme.border }}
              className="p-4 flex-row items-center justify-between border-b"
            >
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#EEF2FF' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="cloud-download" size={20} color="#4F46E5" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Full Backup (JSON)</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">Export complete snapshot of records</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Optimize Database */}
            <TouchableOpacity
              onPress={handleOptimizeDb}
              className="p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#FFFBEB' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="speed" size={20} color="#D97706" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Compact & Optimize</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">Rebuild B-tree indexes & vacuum SQLite</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Developer / Demo Tools */}
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2 ml-1">
            Data Tools & Dataset Seeder
          </Text>
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl shadow-sm overflow-hidden mb-6"
          >
            <TouchableOpacity
              onPress={handleSeedDemo}
              style={{ borderBottomColor: theme.border }}
              className="p-4 flex-row items-center justify-between border-b"
            >
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#F5F3FF' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="auto-fix-high" size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Load 3-Year Dataset (600+ Records)</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">36 months of realistic salaries, bills & investments</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResetDb}
              className="p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: '#FFF1F2' }}
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                >
                  <MaterialIcons name="delete-forever" size={20} color="#F43F5E" />
                </View>
                <View>
                  <Text className="text-rose-500 font-semibold text-sm">Reset All Database Data</Text>
                  <Text style={{ color: theme.textSecondary }} className="text-xs">Wipe data and restore clean state</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
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
              <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">Select Currency</Text>
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
                    onPress={() => {
                      updateCurrency(curr.code, curr.symbol, curr.position);
                      setShowCurrencyModal(false);
                    }}
                    style={{
                      backgroundColor: isSelected ? '#EEF2FF' : theme.cardSecondary,
                      borderColor: isSelected ? '#6366F1' : theme.border,
                      borderWidth: 1,
                    }}
                    className="p-3.5 rounded-2xl mb-2 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center">
                      <Text style={{ color: theme.textPrimary }} className="font-bold text-base w-12">
                        {curr.symbol}
                      </Text>
                      <View>
                        <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">{curr.name}</Text>
                        <Text style={{ color: theme.textSecondary }} className="text-xs">{curr.code}</Text>
                      </View>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={20} color="#6366F1" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
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
                {editingCategory ? "Edit Category" : "Add New Category"}
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
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
              placeholder="e.g. Freelance, Rent, Groceries..."
              placeholderTextColor={theme.textMuted}
              value={categoryName}
              onChangeText={setCategoryName}
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
                    onPress={() => setCategoryIcon(item.name)}
                    style={{
                      backgroundColor: categoryIcon === item.name ? '#EEF2FF' : theme.inputBg,
                      borderColor: categoryIcon === item.name ? '#6366F1' : theme.border,
                      borderWidth: 1,
                    }}
                    className="w-11 h-11 rounded-xl items-center justify-center"
                  >
                    <MaterialIcons
                      name={item.name as any}
                      size={20}
                      color={categoryIcon === item.name ? "#6366F1" : theme.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Color Chooser */}
            <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
              Select Color
            </Text>
            <View className="flex-row flex-wrap gap-2.5 mb-6">
              {colorOptions.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategoryColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    categoryColor === c ? "border-2 border-white" : ""
                  }`}
                >
                  {categoryColor === c && (
                    <MaterialIcons name="check" size={16} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={{ backgroundColor: '#F1F5F9' }}
                className="flex-1 py-3.5 rounded-xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveCategory}
                className="flex-1 bg-indigo-600 py-3.5 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-sm">
                  {editingCategory ? "Save Changes" : "Add Category"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
