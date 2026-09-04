import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "../components/CategoryIcon";
import { CustomDialog } from "../components/CustomDialog";
import { EmptyState } from "../components/EmptyState";
import { useApp } from "../context/AppContext";
import { queryCache } from "../database/cache";
import {
  deleteRecurringTransaction,
  getRecurringTransactions,
  toggleRecurringActive,
} from "../database/database";
import {
  getNextOccurrenceDate,
  processRecurringTransactions,
} from "../database/recurringEngine";
import { RecurringTransaction } from "../database/types";
import { RootNavigationProp } from "../navigation/types";

export default function RecurringScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { formatCurrency, triggerRefresh, refreshTrigger, theme, isDark } = useApp();

  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>(() => queryCache.get("recurring_list") || []);
  const [loading, setLoading] = useState(() => !queryCache.get("recurring_list"));
  const [syncing, setSyncing] = useState(false);

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

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (!queryCache.get("recurring_list") && recurringList.length === 0 && !isManualRefresh) {
      setLoading(true);
    }
    try {
      const data = await queryCache.fetchWithCache("recurring_list", () => getRecurringTransactions(), 30000, isManualRefresh);
      setRecurringList(data.data);
    } catch (error) {
      console.error("Error loading recurring rules:", error);
    } finally {
      setLoading(false);
    }
  }, [recurringList.length]);

  const isFocused = useIsFocused();
  const lastLoadedTriggerRef = useRef<number>(-1);

  useFocusEffect(
    useCallback(() => {
      if (lastLoadedTriggerRef.current !== refreshTrigger) {
        lastLoadedTriggerRef.current = refreshTrigger;
        loadData();
      }
    }, [loadData, refreshTrigger])
  );

  useEffect(() => {
    if (isFocused && lastLoadedTriggerRef.current !== refreshTrigger) {
      lastLoadedTriggerRef.current = refreshTrigger;
      loadData();
    }
  }, [isFocused, loadData, refreshTrigger]);

  const handleToggleActive = async (rule: RecurringTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newActiveState = rule.is_active === 1 ? false : true;
    try {
      await toggleRecurringActive(rule.id, newActiveState);
      await loadData();
      triggerRefresh();
    } catch (e) {
      console.error("Failed to toggle rule:", e);
    }
  };

  const handleManualSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      const count = await processRecurringTransactions();
      await loadData();
      triggerRefresh();
      setDialogState({
        visible: true,
        title: "Sync Complete",
        message: `Checked all schedules. ${count} new transaction(s) recorded.`,
        type: "success",
      });
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = (rule: RecurringTransaction) => {
    setDialogState({
      visible: true,
      title: "Delete Recurring Rule",
      message: `Are you sure you want to delete "${rule.description || rule.category_name}"? Existing generated transactions will be kept.`,
      type: "danger",
      confirmText: "Delete Rule",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          await deleteRecurringTransaction(rule.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await loadData();
          triggerRefresh();
        } catch (error) {
          console.error("Error deleting recurring transaction:", error);
          setDialogState({
            visible: true,
            title: "Error",
            message: "Failed to delete recurring rule.",
            type: "alert",
          });
        }
      },
    });
  };

  const summary = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const rule of recurringList) {
      if (rule.is_active === 1) {
        // Normalize amount to monthly for the overview
        const mult = rule.frequency === "weekly" ? 4.33 : rule.frequency === "biweekly" ? 2.16 : rule.frequency === "yearly" ? 1 / 12 : 1;
        if (rule.type === "income") monthlyIncome += rule.amount * mult;
        else monthlyExpense += rule.amount * mult;
      }
    }
    return {
      monthlyIncome,
      monthlyExpense,
      netCommitment: monthlyIncome - monthlyExpense,
    };
  }, [recurringList]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
          <View className="flex-row items-center justify-between py-2 mb-4">
            <TouchableOpacity
              onPress={() => {
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
              Recurring Schedules
            </Text>
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={syncing}
              style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              {syncing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <MaterialIcons name="sync" size={20} color={theme.textPrimary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Monthly Commitment Banner */}
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
            }}
            className="rounded-3xl p-5 shadow-sm"
          >
            <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold uppercase tracking-wider mb-1">
              Active Monthly Commitment
            </Text>
            <Text style={{ color: theme.textPrimary }} className="text-3xl font-extrabold tracking-tight mb-2">
              {formatCurrency(summary.monthlyExpense)} / mo
            </Text>
            <View
              style={{ borderTopColor: theme.border }}
              className="flex-row items-center justify-between pt-2.5 border-t"
            >
              <Text className="text-slate-400 text-xs font-medium">
                Recurring Income: +{formatCurrency(summary.monthlyIncome)}/mo
              </Text>
              <Text
                className={`text-xs font-bold ${
                  summary.netCommitment >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                Net: {formatCurrency(summary.netCommitment, { showSign: true })}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Bar */}
        <View className="px-6 -mt-3 mb-4">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate("NewTransaction", { initialMode: "recurring" })
            }
            style={{ backgroundColor: theme.primary }}
            className="rounded-2xl py-3.5 flex-row items-center justify-center shadow-md"
          >
            <MaterialIcons name="add" size={20} color="white" />
            <Text className="text-white font-bold text-sm ml-1.5">
              Add Recurring Rule
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recurring List */}
        <View className="px-6">
          <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-3">
            Active & Inactive Rules ({recurringList.length})
          </Text>

          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : recurringList.length === 0 ? (
            <EmptyState
              icon="repeat"
              title="No Recurring Rules"
              description="Automate your fixed expenses like rent, utilities, Netflix, and monthly salaries."
              actionText="Add Recurring Schedule"
              onAction={() =>
                navigation.navigate("NewTransaction", { initialMode: "recurring" })
              }
            />
          ) : (
            recurringList.map((rule) => {
              const isIncome = rule.type === "income";
              const nextDate = getNextOccurrenceDate(rule);
              const nextDateStr = nextDate
                ? nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Completed";

              const freqLabel = {
                weekly: "Weekly",
                biweekly: "Bi-Weekly",
                monthly: `Monthly (Day ${rule.day_of_month || 1})`,
                yearly: "Yearly",
              }[rule.frequency || "monthly"];

              return (
                <View
                  key={rule.id}
                  style={{
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className={`rounded-2xl p-4 mb-3 shadow-sm ${
                    rule.is_active === 0 ? "opacity-60" : ""
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1 mr-2">
                      <CategoryIcon
                        icon={rule.category_icon}
                        color={rule.category_color}
                        size={20}
                        containerSize={42}
                      />
                      <View className="ml-3 flex-1">
                        <Text
                          style={{ color: theme.textPrimary }}
                          className="font-bold text-base"
                          numberOfLines={1}
                        >
                          {rule.description || rule.category_name}
                        </Text>
                        <Text style={{ color: theme.textSecondary }} className="text-xs font-medium">
                          {rule.category_name}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text
                        style={{
                          color: isIncome
                            ? isDark ? "#34D399" : "#10B981"
                            : theme.textPrimary,
                        }}
                        className="text-base font-bold"
                      >
                        {isIncome ? "+" : "-"}
                        {formatCurrency(rule.amount)}
                      </Text>
                      <View
                        style={{
                          backgroundColor: isDark ? "rgba(99, 102, 241, 0.2)" : "#EEF2FF",
                        }}
                        className="px-2 py-0.5 rounded-full mt-1"
                      >
                        <Text style={{ color: theme.primary }} className="text-[10px] font-bold">
                          {freqLabel}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Footer Row */}
                  <View
                    style={{ borderTopColor: theme.border }}
                    className="flex-row items-center justify-between pt-3 border-t"
                  >
                    <View>
                      <Text style={{ color: theme.textMuted }} className="text-[11px]">
                        Next execution: <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>{nextDateStr}</Text>
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-3">
                      <Switch
                        value={rule.is_active === 1}
                        onValueChange={() => handleToggleActive(rule)}
                        trackColor={{ false: theme.cardSecondary, true: theme.primary }}
                        thumbColor="#FFFFFF"
                      />
                      <TouchableOpacity
                        onPress={() => handleDelete(rule)}
                        style={{ backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "#FFF1F2" }}
                        className="w-8 h-8 rounded-lg items-center justify-center"
                      >
                        <MaterialIcons name="delete-outline" size={16} color="#F43F5E" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

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
