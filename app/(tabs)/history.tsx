import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
    deleteTransaction,
    getCategories,
    getTransactions,
    getYearlyTotal,
} from "../database/database";
import { Transaction } from "../types";

const now = new Date();

export default function History() {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [categoriesLookup, setCategoriesLookup] = useState<Record<number, string>>({});

  const fetchInfo = async () => {
    try {
      const yearStr = now.getFullYear().toString();
      const currentYear = now.getFullYear();
      
      // 1. Fetch data using your existing database functions
      // We fetch all transactions and filter by year here to maintain O(n) performance
      const allTransactions = await getTransactions();
      const yearlyBalance = await getYearlyTotal(yearStr);
      const categoriesArray = await getCategories();

      // 2. Filter transactions for the current year
      const yearlyTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.created_at);
        return txDate.getFullYear() === currentYear;
      });

      // 3. Calculate Income and Expenses for the year from the array
      const totals = yearlyTransactions.reduce(
        (acc, tx) => {
          if (tx.type === "income") acc.income += tx.amount;
          else if (tx.type === "expense") acc.expenses += tx.amount;
          return acc;
        },
        { income: 0, expenses: 0 }
      );

      // 4. Create the Category Lookup Map
      const lookupMap = categoriesArray.reduce<Record<number, string>>((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
      }, {});

      // 5. Update state
      setTransactions(yearlyTransactions);
      setTotalIncome(totals.income);
      setTotalExpenses(totals.expenses);
      setTotalBalance(yearlyBalance);
      setCategoriesLookup(lookupMap);
    } catch (error) {
      console.error("History fetch error:", error);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchInfo();
    }, [])
  );

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.type === filter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const handleLongPress = (transaction: Transaction) => {
    Alert.alert(
      "Delete Transaction",
      `Delete "${categoriesLookup[transaction.category_id] || "Transaction"}" for ${transaction.amount.toFixed(2)}€?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTransaction(transaction.id);
            fetchInfo();
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="bg-blue-600 pt-12 pb-6 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-3xl font-bold mb-4">History</Text>

        <View className="bg-white/20 p-5 rounded-2xl border border-white/30 mb-3">
          <Text className="text-white/80 text-sm mb-1">Yearly Balance ({now.getFullYear()})</Text>
          <Text className="text-white text-4xl font-bold">
            {totalBalance >= 0 ? "+" : ""}{totalBalance.toFixed(2)}€
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 bg-white/20 p-4 rounded-2xl border border-white/30">
            <Text className="text-white/80 text-xs">Income</Text>
            <Text className="text-white text-xl font-bold">{totalIncome.toFixed(0)}€</Text>
          </View>
          <View className="flex-1 bg-white/20 p-4 rounded-2xl border border-white/30">
            <Text className="text-white/80 text-xs">Expenses</Text>
            <Text className="text-white text-xl font-bold">{totalExpenses.toFixed(0)}€</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-6 -mt-4 mb-4">
        <View className="bg-white rounded-3xl shadow-md p-2 flex-row">
          {(['all', 'income', 'expense'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setFilter(t)}
              className={`flex-1 py-3 rounded-2xl ${
                filter === t 
                ? (t === 'income' ? 'bg-emerald-500' : t === 'expense' ? 'bg-rose-500' : 'bg-blue-600') 
                : ''
              }`}
            >
              <Text className={`text-center font-bold text-sm ${filter === t ? 'text-white' : 'text-gray-600'}`}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="px-6 pb-24">
        {filteredTransactions.map((tx) => (
          <TouchableOpacity
            onLongPress={() => handleLongPress(tx)}
            key={tx.id}
            className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row justify-between items-center"
          >
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <View className={`w-2 h-2 rounded-full mr-2 ${tx.type === "income" ? "bg-emerald-500" : "bg-rose-500"}`} />
                <Text className="text-base font-bold text-gray-900">
                  {categoriesLookup[tx.category_id] || "Uncategorized"}
                </Text>
              </View>
              <Text className="text-xs text-gray-400">{formatDate(tx.created_at)}</Text>
            </View>
            <Text className={`text-lg font-bold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
              {tx.type === "income" ? "+" : "-"}{tx.amount.toFixed(2)}€
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}