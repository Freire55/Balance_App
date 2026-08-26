import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "../components/CategoryIcon";
import { EmptyState } from "../components/EmptyState";
import { useApp } from "../context/AppContext";
import {
  deleteRecurringTransaction,
  getRecurringTransactions,
  toggleRecurringActive,
} from "../database/database";
import { processRecurringTransactions } from "../database/recurringEngine";
import { RecurringTransaction } from "../database/types";
import { RootNavigationProp } from "../navigation/types";

export default function RecurringScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { formatCurrency, triggerRefresh, refreshTrigger, theme } = useApp();

  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getRecurringTransactions();
      setRecurringList(data);
    } catch (error) {
      console.error("Error loading recurring rules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

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
      Alert.alert("Sync Complete", `Checked all rules. ${count} new transaction(s) recorded.`);
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = (rule: RecurringTransaction) => {
    Alert.alert(
      "Delete Recurring Rule",
      `Are you sure you want to delete "${rule.description || rule.category_name}"? Existing generated transactions will be kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Rule",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecurringTransaction(rule.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadData();
              triggerRefresh();
            } catch (error) {
              console.error("Error deleting recurring transaction:", error);
              Alert.alert("Error", "Failed to delete recurring rule.");
            }
          },
        },
      ]
    );
  };

  const summary = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const rule of recurringList) {
      if (rule.is_active === 1) {
        if (rule.type === "income") monthlyIncome += rule.amount;
        else monthlyExpense += rule.amount;
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
          className="px-6 pb-8 rounded-b-3xl shadow-xl"
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
            <Text className="text-white text-xl font-bold">Recurring Rules</Text>
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={syncing}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 items-center justify-center"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <MaterialIcons name="sync" size={20} color="#94A3B8" />
              )}
            </TouchableOpacity>
          </View>

          {/* Monthly Commitment Summary Card */}
          <View className="bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-lg">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
              Active Monthly Commitment
            </Text>
            <Text
              className={`text-3xl font-extrabold tracking-tight mb-3 ${
                summary.netCommitment >= 0 ? "text-emerald-400" : "text-white"
              }`}
            >
              {formatCurrency(summary.netCommitment, { showSign: true })}
            </Text>

            <View className="flex-row justify-between pt-3 border-t border-slate-700">
              <View>
                <Text className="text-slate-400 text-xs">Monthly Inflows</Text>
                <Text className="text-emerald-400 text-sm font-bold mt-0.5">
                  +{formatCurrency(summary.monthlyIncome)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-slate-400 text-xs">Monthly Subscriptions & Rent</Text>
                <Text className="text-rose-400 text-sm font-bold mt-0.5">
                  -{formatCurrency(summary.monthlyExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rules List Section */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text style={{ color: theme.textPrimary }} className="font-bold text-lg">
              Schedules & Rules ({recurringList.length})
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("NewTransaction", { initialMode: "recurring" })}
              className="flex-row items-center bg-indigo-600 px-3 py-1.5 rounded-xl"
            >
              <MaterialIcons name="add" size={16} color="white" />
              <Text className="text-white font-bold text-xs ml-1">Add Rule</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : recurringList.length === 0 ? (
            <EmptyState
              icon="repeat"
              title="No Recurring Commitments"
              description="Automate monthly salaries, rent, utility bills, and subscriptions so they record automatically."
              actionText="Create Recurring Schedule"
              onAction={() => navigation.navigate("NewTransaction", { initialMode: "recurring" })}
            />
          ) : (
            recurringList.map((rule) => {
              const isActive = rule.is_active === 1;
              return (
                <View
                  key={rule.id}
                  style={{
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className="rounded-2xl p-4 mb-3 shadow-sm"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <CategoryIcon
                        icon={rule.category_icon}
                        color={rule.category_color}
                        size={20}
                        containerSize={42}
                      />
                      <View className="ml-3 flex-1">
                        <Text style={{ color: theme.textPrimary }} className="font-bold text-base" numberOfLines={1}>
                          {rule.description || rule.category_name}
                        </Text>
                        <Text style={{ color: theme.textSecondary }} className="text-xs">
                          {rule.category_name} • Day {rule.day_of_month} each month
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text
                        style={{
                          color: rule.type === "income" ? "#10B981" : theme.textPrimary,
                        }}
                        className="text-base font-bold"
                      >
                        {rule.type === "income" ? "+" : "-"}
                        {formatCurrency(rule.amount)}
                      </Text>
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View
                    style={{ borderTopColor: theme.border }}
                    className="flex-row items-center justify-between pt-2 mt-2 border-t"
                  >
                    <View className="flex-row items-center">
                      <Switch
                        value={isActive}
                        onValueChange={() => handleToggleActive(rule)}
                        trackColor={{ false: "#CBD5E1", true: "#6366F1" }}
                        thumbColor="#FFFFFF"
                      />
                      <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold ml-2">
                        {isActive ? "Active" : "Paused"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDelete(rule)}
                      className="p-1.5"
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#F43F5E" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
