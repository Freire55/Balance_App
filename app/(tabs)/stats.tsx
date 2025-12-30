import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  getCategoryBreakdown,
  getPeriodTotal,
  getTransactionCount,
  getTransactions
} from '../database/database';
import { Trends } from '../types';

const now = new Date();

export default function Stats() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [balance, setBalance] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<Trends[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<Trends[]>([]);

  const fetchInfo = async () => {
    try {
      const yearStr = now.getFullYear().toString();
      const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
      const isMonth = period === 'month';

      // 1. Fetch Aggregated Totals
      const netBalance = await getPeriodTotal(yearStr, isMonth ? monthStr : undefined);
      const count = await getTransactionCount(yearStr, isMonth ? monthStr : undefined);
      const breakdown = await getCategoryBreakdown(yearStr, isMonth ? monthStr : undefined);

      setBalance(netBalance);
      setTransactionCount(count);
      setCategoryBreakdown(breakdown);

      // 2. Fetch Raw Transactions for Trend Calculation
      const txs = await getTransactions();

      // Yearly Trend (Grouped by Month)
      const mTrend = txs.reduce<Trends[]>((acc, tx) => {
        const d = new Date(tx.created_at);
        if (d.getFullYear() === now.getFullYear()) {
          const m = d.getMonth();
          tx.type === 'income' ? acc[m].income += tx.amount : acc[m].expenses += tx.amount;
        }
        return acc;
      }, Array.from({ length: 12 }, (_, i) => ({ num: i + 1, income: 0, expenses: 0 })));

      // Weekly Trend (Current Month Only)
      const wTrend = txs.reduce<Trends[]>((acc, tx) => {
        const d = new Date(tx.created_at);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          let w = Math.floor((d.getDate() - 1) / 7);
          if (w > 3) w = 3;
          tx.type === 'income' ? acc[w].income += tx.amount : acc[w].expenses += tx.amount;
        }
        return acc;
      }, Array.from({ length: 4 }, (_, i) => ({ num: i + 1, income: 0, expenses: 0 })));

      setMonthlyTrend(mTrend);
      setWeeklyTrend(wTrend);

      // 3. Set Header Totals
      const currentMonthTrend = mTrend[now.getMonth()];
      const yearTotals = mTrend.reduce((a, b) => ({
        income: a.income + b.income,
        expenses: a.expenses + b.expenses
      }), { income: 0, expenses: 0 });

      setIncome(isMonth ? currentMonthTrend.income : yearTotals.income);
      setExpenses(isMonth ? currentMonthTrend.expenses : yearTotals.expenses);

    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };

  useFocusEffect(useCallback(() => { fetchInfo(); }, [period]));

  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : "0";

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="bg-blue-600 pt-12 pb-8 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-3xl font-bold mb-6">Statistics</Text>
        
        <View className="bg-white/20 rounded-3xl p-2 flex-row mb-4">
          <TouchableOpacity onPress={() => setPeriod('month')} className={`flex-1 py-3 rounded-2xl ${period === 'month' ? 'bg-white' : ''}`}>
            <Text className={`text-center font-bold ${period === 'month' ? 'text-blue-600' : 'text-white'}`}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPeriod('year')} className={`flex-1 py-3 rounded-2xl ${period === 'year' ? 'bg-white' : ''}`}>
            <Text className={`text-center font-bold ${period === 'year' ? 'text-blue-600' : 'text-white'}`}>This Year</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white/20 p-5 rounded-3xl border border-white/30">
          <Text className="text-white/80 text-sm mb-1">Net Balance</Text>
          <Text className="text-white text-4xl font-bold mb-2">{balance.toFixed(2)}€</Text>
          <Text className="text-white/70 text-xs">{transactionCount} transactions • {savingsRate}% savings rate</Text>
        </View>
      </View>

      <View className="px-6 -mt-4 mb-4 flex-row gap-3">
        <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
          <Text className="text-emerald-500 text-xl font-bold">{income.toFixed(0)}€</Text>
          <Text className="text-gray-500 text-xs">Total Income</Text>
        </View>
        <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
          <Text className="text-rose-500 text-xl font-bold">{expenses.toFixed(0)}€</Text>
          <Text className="text-gray-500 text-xs">Total Expenses</Text>
        </View>
      </View>

      <View className="px-6 mb-6">
        <View className="bg-white rounded-2xl p-5 shadow-md">
          <Text className="text-lg font-bold mb-4">Top Categories</Text>
          {(() => {
            // Sort: positive balances first (descending), then negative balances (by absolute value descending)
            const sortedCategories = [...categoryBreakdown].sort((a, b) => {
              if (a.balance >= 0 && b.balance < 0) return -1;
              if (a.balance < 0 && b.balance >= 0) return 1;
              return Math.abs(b.balance) - Math.abs(a.balance);
            });
            
            // Find max in each group
            const maxPositive = Math.max(...sortedCategories.filter(c => c.balance >= 0).map(c => c.balance), 0);
            const maxNegative = Math.max(...sortedCategories.filter(c => c.balance < 0).map(c => Math.abs(c.balance)), 0);
            
            return sortedCategories.map((cat, i) => {
              // Width relative to max in respective group
              const percentage = cat.balance >= 0 
                ? (maxPositive > 0 ? (cat.balance / maxPositive) * 100 : 0)
                : (maxNegative > 0 ? (Math.abs(cat.balance) / maxNegative) * 100 : 0);
              
              return (
                <View key={i} className="mb-4">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-gray-700">{cat.name}</Text>
                    <Text className={`text-sm font-bold ${
                      cat.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {cat.balance >= 0 ? '+' : ''}{cat.balance.toFixed(2)}€
                    </Text>
                  </View>
                  <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View 
                      className={`h-full ${
                        cat.balance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                </View>
              );
            });
          })()}
        </View>
      </View>

      <View className="px-6 mb-24">
        <View className="bg-white rounded-2xl p-5 shadow-md">
          <Text className="text-lg font-bold mb-4">{period === 'month' ? 'Weekly' : 'Monthly'} Trend</Text>
          <View className="flex-row items-end justify-between h-40">
            {(period === 'month' ? weeklyTrend : monthlyTrend).map((item, index) => {
              const max = Math.max(...(period === 'month' ? weeklyTrend : monthlyTrend).map(i => Math.max(i.income, i.expenses, 1)));
              return (
                <View key={index} className="flex-1 items-center">
                  <View className="flex-row items-end gap-1 h-32">
                    <View style={{ height: (item.income / max) * 100 + 2 }} className="w-2 bg-emerald-500 rounded-t-sm" />
                    <View style={{ height: (item.expenses / max) * 100 + 2 }} className="w-2 bg-rose-500 rounded-t-sm" />
                  </View>
                  <Text className="text-[10px] text-gray-400 mt-2">{item.num}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}