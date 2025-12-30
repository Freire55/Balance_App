import { router, useFocusEffect } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { getCategories, getMonthlyTotal, getMonthlyTransactions } from '../database/database'
import type { Transaction } from '../types'

const now = new Date()

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [categoryLookup, setCategoryLookup] = useState<Record<number, string>>({});

  const fetchInfo = async () => {
    try {
      const mStr = (now.getMonth() + 1).toString().padStart(2, '0');
      const yStr = now.getFullYear().toString();

      const transactionsArray = await getMonthlyTransactions(mStr, yStr);
      const balanceValue = await getMonthlyTotal(mStr, yStr);
      const categoriesArray = await getCategories();

      const totals = transactionsArray.reduce((acc, tx) => {
        if (tx.type === 'income') acc.income += tx.amount;
        else acc.expenses += tx.amount;
        return acc;
      }, { income: 0, expenses: 0 });
      
      const lookup = categoriesArray.reduce<Record<number, string>>((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
      }, {});

      setTransactions(transactionsArray);
      setBalance(balanceValue);
      setIncome(totals.income);
      setExpenses(totals.expenses);
      setCategoryLookup(lookup);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useFocusEffect(useCallback(() => { fetchInfo() }, []));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) return 'Today';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="bg-blue-600 pt-12 pb-8 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-lg font-medium mb-1 opacity-90">Welcome back 👋</Text>
        <Text className="text-white text-3xl font-bold mb-6">Your Balance</Text>
        
        <View className="bg-white/20 backdrop-blur-lg p-6 rounded-3xl border border-white/30">
          <Text className="text-white/80 text-sm font-medium mb-2">Current Month</Text>
          <Text className="text-white text-5xl font-bold mb-1">{balance.toFixed(2)}€</Text>
          <Text className="text-white/70 text-xs">{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        </View>
      </View>

      <View className="flex-row px-6 -mt-6 mb-4 gap-3">
        <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
          <Text className="text-emerald-500 text-2xl font-bold mb-1">↑</Text>
          <Text className="text-gray-900 text-lg font-bold">{income.toFixed(2)}€</Text>
          <Text className="text-gray-500 text-xs">Income</Text>
        </View>
        <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
          <Text className="text-rose-500 text-2xl font-bold mb-1">↓</Text>
          <Text className="text-gray-900 text-lg font-bold">{expenses.toFixed(2)}€</Text>
          <Text className="text-gray-500 text-xs">Expenses</Text>
        </View>
      </View>

      <View className="px-6 pb-24">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-900">Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text className="text-blue-600 text-sm font-semibold">See All</Text>
          </TouchableOpacity>
        </View>
        
        {transactions.map((tx, index) => (
          <View key={tx.id} className="bg-white p-4 rounded-2xl mb-3 flex-row justify-between items-center shadow-sm border border-gray-100">
            <View className="flex-row items-center flex-1">
              <View className={`w-12 h-12 rounded-2xl justify-center items-center mr-4 ${tx.type === 'income' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                <Text className={`text-xl font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {tx.type === 'income' ? '↑' : '↓'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-medium text-blue-600 mb-1">{categoryLookup[tx.category_id] || 'Uncategorized'}</Text>
                <Text className="text-xs text-gray-400">{formatDate(tx.created_at)}</Text>
              </View>
            </View>
            <Text className={`text-lg font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tx.type === 'income' ? '+' : '-'}{tx.amount.toFixed(2)}€
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}