import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Alert,
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
import { useApp } from "../context/AppContext";
import {
  addCategory,
  addRecurringTransaction,
  addTransaction,
  getCategories,
} from "../database/database";
import { processRecurringTransactions } from "../database/recurringEngine";
import { Category, RecurringFrequency, TransactionType } from "../database/types";
import { NewTransactionRouteProp, RootNavigationProp } from "../navigation/types";

export default function NewTransactionScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<NewTransactionRouteProp>();
  const insets = useSafeAreaInsets();
  const { settings, triggerRefresh, theme } = useApp();

  const [mode, setMode] = useState<"normal" | "recurring">(
    route.params?.initialMode === "recurring" ? "recurring" : "normal"
  );
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [description, setDescription] = useState("");
  const [datePreset, setDatePreset] = useState<"today" | "yesterday">("today");

  // Recurring fields
  const [frequency] = useState<RecurringFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endMonthsCount] = useState(12);

  // New Category Modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("category");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");

  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((data) => {
        if (isMounted) {
          setCategories(data);
          setSelectedCategory((prev) => prev || (data.length > 0 ? data[0] : null));
        }
      })
      .catch((error) => {
        console.error("Error loading categories:", error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert("Category Name", "Please enter a name for the new category.");
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
    } catch (error) {
      console.error("Error creating category:", error);
      Alert.alert("Error", "A category with this name already exists.");
    }
  };

  const getTransactionDate = (): string => {
    const now = new Date();
    if (datePreset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString();
    }
    return now.toISOString();
  };

  const handleSubmit = async () => {
    const sanitizedAmount = amount.replace(",", ".").trim();
    const parsedAmount = parseFloat(sanitizedAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid positive number.");
      return;
    }

    if (!selectedCategory) {
      Alert.alert("Missing Category", "Please select a category.");
      return;
    }

    try {
      if (mode === "normal") {
        const txDateIso = getTransactionDate();
        await addTransaction({
          type,
          amount: parsedAmount,
          category_id: selectedCategory.id,
          description: description.trim() || undefined,
          created_at: txDateIso,
        });
      } else {
        const startDate = new Date();
        let endDateIso: string | undefined = undefined;

        if (hasEndDate) {
          const calculatedEnd = new Date(startDate);
          calculatedEnd.setMonth(calculatedEnd.getMonth() + endMonthsCount);
          endDateIso = calculatedEnd.toISOString();
        }

        await addRecurringTransaction({
          type,
          amount: parsedAmount,
          category_id: selectedCategory.id,
          description: description.trim() || undefined,
          frequency,
          day_of_month: dayOfMonth,
          start_date: startDate.toISOString(),
          end_date: endDateIso,
          is_active: 1,
        });

        await processRecurringTransactions();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerRefresh();
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
      Alert.alert("Error", "Failed to save transaction.");
    }
  };

  const handleQuickAddAmount = (addValue: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const curr = parseFloat(amount.replace(",", ".")) || 0;
    setAmount((curr + addValue).toFixed(2).replace(".00", ""));
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
    "#06B6D4", "#EAB308", "#F43F5E", "#6366F1", "#64748B"
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: Math.max(insets?.top ?? 0, 16),
            backgroundColor: '#0F172A',
          }}
          className="px-6 pb-6 rounded-b-3xl shadow-xl"
        >
          <View className="flex-row items-center justify-between pt-2 mb-4">
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">New Entry</Text>
            <View className="w-10" />
          </View>

          {/* Mode Switcher: One-Time vs Recurring */}
          <View className="bg-slate-800 border border-slate-700 rounded-2xl p-1 flex-row">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("normal");
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                mode === "normal" ? "bg-indigo-600 shadow-sm" : ""
              }`}
            >
              <Text
                className={`font-bold text-xs ${
                  mode === "normal" ? "text-white" : "text-slate-400"
                }`}
              >
                One-Time Transaction
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("recurring");
              }}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                mode === "recurring" ? "bg-indigo-600 shadow-sm" : ""
              }`}
            >
              <Text
                className={`font-bold text-xs ${
                  mode === "recurring" ? "text-white" : "text-slate-400"
                }`}
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
              <Text style={{ color: theme.textSecondary }} className="text-2xl font-bold ml-2">
                {settings.currencySymbol}
              </Text>
            </View>

            {/* Quick Amount Add Chips */}
            <View
              style={{ borderTopColor: theme.border }}
              className="flex-row gap-2 mt-4 pt-3 border-t"
            >
              {[10, 25, 50, 100].map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => handleQuickAddAmount(val)}
                  style={{ backgroundColor: '#F1F5F9' }}
                  className="px-3 py-1.5 rounded-lg"
                >
                  <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">
                    +{val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Selector Grid */}
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
                <MaterialIcons name="add" size={16} color="#4F46E5" />
                <Text style={{ color: "#4F46E5" }} className="text-xs font-bold ml-0.5">
                  New Category
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
              <View className="flex-row gap-2.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory?.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCategory(cat);
                      }}
                      style={{
                        backgroundColor: isSelected ? '#EEF2FF' : '#F8FAFC',
                        borderColor: isSelected ? '#6366F1' : theme.border,
                        borderWidth: 1,
                      }}
                      className="items-center p-3 rounded-2xl min-w-[76px]"
                    >
                      <CategoryIcon
                        icon={cat.icon}
                        color={cat.color}
                        size={20}
                        containerSize={40}
                      />
                      <Text
                        style={{
                          color: isSelected ? '#4F46E5' : theme.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        }}
                        className="text-[11px] mt-1.5 text-center"
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

          {/* Date Selector (for One-Time) */}
          {mode === "normal" && (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-3">
                Transaction Date
              </Text>
              <View className="flex-row gap-2">
                {[
                  { key: "today" as const, label: "Today" },
                  { key: "yesterday" as const, label: "Yesterday" },
                ].map((d) => (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => setDatePreset(d.key)}
                    style={{
                      backgroundColor: datePreset === d.key ? '#6366F1' : '#F8FAFC',
                      borderColor: datePreset === d.key ? '#6366F1' : theme.border,
                      borderWidth: 1,
                    }}
                    className="flex-1 py-2.5 rounded-xl items-center"
                  >
                    <Text
                      style={{
                        color: datePreset === d.key ? '#FFFFFF' : theme.textPrimary,
                      }}
                      className="text-xs font-bold"
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Recurring Options */}
          {mode === "recurring" && (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              }}
              className="rounded-3xl p-5 shadow-sm mb-4"
            >
              <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-3">
                Recurring Schedule
              </Text>

              <View
                style={{ borderBottomColor: theme.border }}
                className="flex-row justify-between items-center py-2 border-b"
              >
                <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">Frequency</Text>
                <Text className="text-indigo-500 text-xs font-bold">Monthly</Text>
              </View>

              <View
                style={{ borderBottomColor: theme.border }}
                className="flex-row justify-between items-center py-3 border-b"
              >
                <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">Execution Day</Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => setDayOfMonth(Math.max(1, dayOfMonth - 1))}
                    style={{ backgroundColor: '#F1F5F9' }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <Text style={{ color: theme.textPrimary }} className="font-bold">-</Text>
                  </TouchableOpacity>
                  <Text style={{ color: theme.textPrimary }} className="font-bold text-sm w-8 text-center">
                    {dayOfMonth}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDayOfMonth(Math.min(28, dayOfMonth + 1))}
                    style={{ backgroundColor: '#F1F5F9' }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <Text style={{ color: theme.textPrimary }} className="font-bold">+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row justify-between items-center pt-3">
                <Text style={{ color: theme.textPrimary }} className="text-xs font-semibold">Set End Date?</Text>
                <TouchableOpacity
                  onPress={() => setHasEndDate(!hasEndDate)}
                  style={{
                    backgroundColor: hasEndDate ? '#6366F1' : '#F1F5F9',
                  }}
                  className="px-3 py-1.5 rounded-lg"
                >
                  <Text
                    style={{
                      color: hasEndDate ? '#FFFFFF' : theme.textSecondary,
                    }}
                    className="text-xs font-bold"
                  >
                    {hasEndDate ? "1 Year Duration" : "No End Date"}
                  </Text>
                </TouchableOpacity>
              </View>
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
            className="bg-indigo-600 rounded-2xl py-4 items-center justify-center shadow-lg"
            style={{
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Text className="text-white font-bold text-base">
              {mode === "normal" ? "Save Transaction" : "Save Recurring Rule"}
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
                      backgroundColor: newCategoryIcon === item.name ? '#EEF2FF' : theme.inputBg,
                      borderColor: newCategoryIcon === item.name ? '#6366F1' : theme.border,
                      borderWidth: 1,
                    }}
                    className="w-11 h-11 rounded-xl items-center justify-center"
                  >
                    <MaterialIcons
                      name={item.name as any}
                      size={20}
                      color={newCategoryIcon === item.name ? "#6366F1" : theme.textSecondary}
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
                  onPress={() => setNewCategoryColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    newCategoryColor === c ? "border-2 border-white" : ""
                  }`}
                >
                  {newCategoryColor === c && (
                    <MaterialIcons name="check" size={16} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowAddCategoryModal(false)}
                style={{ backgroundColor: '#F1F5F9' }}
                className="flex-1 py-3.5 rounded-xl items-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateCategory}
                className="flex-1 bg-indigo-600 py-3.5 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-sm">Add Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
