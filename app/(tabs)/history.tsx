import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Category, FinanceSummary, Transaction } from "../types";
import {
  deleteTransaction,
  getCategories,
  getMonthlyTotal,
  getTransactions,
  getYearlyTotal,
  getYearlyTransactions,
} from "../database/database";
import { useFocusEffect } from "expo-router";

const now = new Date();

export default function History() {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [categoriesLookup, setCategoriesLookup] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    fetchInfo();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchInfo();
    }, [])
  );

  const fetchInfo = async () => {
    try {
      const transactionsArray = await getYearlyTransactions(
        now.getFullYear().toString()
      );
      const balanceValue = await getYearlyTotal(now.getFullYear().toString());
      const categoriesArray = await getCategories();

      const totals = transactionsArray.reduce<FinanceSummary>(
        (acc, tx) => {
          if (tx.type === "income") {
            acc.income += tx.amount;
          } else if (tx.type === "expense") {
            acc.expenses += tx.amount;
          }
          return acc;
        },
        { income: 0, expenses: 0, totalBalance: 0 }
      );

      const catLookup = categories.reduce<Record<number, string>>((acc, tx) => {
        acc[tx.id] = tx.name;
        return acc;
      }, {});

      setTransactions(transactionsArray);
      setCategories(categoriesArray);
      setTotalIncome(totals.income);
      setTotalExpenses(totals.expenses);
      setTotalBalance(balanceValue);
      setCategoriesLookup(catLookup);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.type === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLongPress = (transaction: Transaction) => {
    Alert.alert(
      "Delete Transaction",
      `Are you sure you want to delete the "${
        categoriesLookup[transaction.category_id] || "Uncategorized"
      }" entry for $${transaction.amount.toFixed(2)}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmFinalDelete(transaction.id),
        },
      ]
    );
  };

  const confirmFinalDelete = async (id: number) => {
    try {
      await deleteTransaction(id);
      await fetchInfo();
    } catch (error) {
      Alert.alert("Error", "Could not delete transaction.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-3xl font-bold mb-4">
          Transaction History
        </Text>

        {/* Total Balance Card */}
        <View className="bg-white/20 backdrop-blur-lg p-5 rounded-2xl border border-white/30 mb-3">
          <Text className="text-white/80 text-sm mb-1">Total Balance</Text>
          <Text
            className={`text-4xl font-bold ${
              totalBalance >= 0 ? "text-white" : "text-rose-200"
            }`}
          >
            {totalBalance >= 0 ? "+" : ""}${totalBalance.toFixed(2)}
          </Text>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-white/20 backdrop-blur-lg p-4 rounded-2xl border border-white/30">
            <Text className="text-white/80 text-xs mb-1">Total Income</Text>
            <Text className="text-white text-xl font-bold">
              ${totalIncome.toFixed(2)}
            </Text>
          </View>
          <View className="flex-1 bg-white/20 backdrop-blur-lg p-4 rounded-2xl border border-white/30">
            <Text className="text-white/80 text-xs mb-1">Total Expenses</Text>
            <Text className="text-white text-xl font-bold">
              ${totalExpenses.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-6 -mt-4 mb-4">
        <View className="bg-white rounded-3xl shadow-md p-2 flex-row">
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={`flex-1 py-3 rounded-2xl ${
              filter === "all" ? "bg-blue-600" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-center font-bold text-sm ${
                filter === "all" ? "text-white" : "text-gray-600"
              }`}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("income")}
            className={`flex-1 py-3 rounded-2xl ${
              filter === "income" ? "bg-emerald-500" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-center font-bold text-sm ${
                filter === "income" ? "text-white" : "text-gray-600"
              }`}
            >
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("expense")}
            className={`flex-1 py-3 rounded-2xl ${
              filter === "expense" ? "bg-rose-500" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-center font-bold text-sm ${
                filter === "expense" ? "text-white" : "text-gray-600"
              }`}
            >
              Expenses
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transaction List */}
      <View className="px-6 pb-24">
        <Text className="text-sm font-semibold text-gray-500 mb-3">
          {filteredTransactions.length} Transaction
          {filteredTransactions.length !== 1 ? "s" : ""}
        </Text>

        {filteredTransactions.map((transaction) => (
          <TouchableOpacity
            onLongPress={() => handleLongPress(transaction)}
            key={transaction.id}
            className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100"
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      transaction.type === "income"
                        ? "bg-emerald-500"
                        : "bg-rose-500"
                    }`}
                  />
                  <Text className="text-base font-bold text-gray-900">
                    {categoriesLookup[transaction.category_id] ||
                      "Uncategorized"}
                  </Text>
                </View>
                {transaction.description && (
                  <Text className="text-sm text-gray-600 mb-1">
                    {transaction.description}
                  </Text>
                )}
                <View className="flex-row items-center">
                  <Text className="text-xs text-gray-400 mr-3">
                    📅 {formatDate(transaction.created_at)}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    🕐 {formatTime(transaction.created_at)}
                  </Text>
                </View>
              </View>
              <Text
                className={`text-xl font-bold ${
                  transaction.type === "income"
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {transaction.type === "income" ? "+" : "-"}$
                {transaction.amount.toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
