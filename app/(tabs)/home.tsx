import { useFocusEffect } from '@react-navigation/native'
import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { getCategories, getTotalBalance, getTransactions } from '../database/database'
import type { Category, FinanceSummary, Transaction } from '../types'

export default function Home() {


  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])

  const [categoryLookup, setCategoryLookup] = useState<Record<number, string>>({});


  useEffect(() => {
    fetchInfo()
  }, [])

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchInfo()
    }, [])
  )

  const fetchInfo = async () => {
    try {
      // Fetch transactions and Balance
      const transactionsArray = await getTransactions();
      const balanceValue = await getTotalBalance();
      const categoriesArray = await getCategories();

      
      // Treat data for expenses and income display
      
      const totals = transactionsArray.reduce<FinanceSummary>((acc, tx) => {
        if (tx.type === 'income') {
          acc.income += tx.amount;
        } else if (tx.type === 'expense') {
          acc.expenses += tx.amount;
        }
        return acc;
      }, { income: 0, expenses: 0, totalBalance: 0 });
      
      const categoriesLookup= categoriesArray.reduce<Record<number, string>>((acc, tx) => {
        acc[tx.id] = tx.name;
        return acc;
      }, {});

    
      // Assign to state
      setTransactions(transactionsArray);
      setBalance(balanceValue);
      setIncome(totals.income);
      setExpenses(totals.expenses);
      setCategories(categoriesArray);
      setCategoryLookup(categoriesLookup);

    } catch (error) {
      console.error('Error fetching data:', error);
    }

  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  return (
    <ScrollView className="flex-1 bg-gradient-to-b from-blue-50 to-slate-50">
      {/* Header Section */}
      <View className="bg-blue-600 pt-12 pb-8 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-lg font-medium mb-1 opacity-90">
          Welcome back 👋
        </Text>
        <Text className="text-white text-3xl font-bold mb-6">
          Your Balance
        </Text>
        
        {/* Balance Display */}
        <View className="bg-white/20 backdrop-blur-lg p-6 rounded-3xl border border-white/30">
          <Text className="text-white/80 text-sm font-medium mb-2">
            Current Month
          </Text>
          <Text className="text-white text-5xl font-bold mb-1">
            ${balance.toFixed(2)}
          </Text>
          <Text className="text-white/70 text-xs">
            December 2025
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View className="flex-row px-6 -mt-6 mb-4 gap-3">
        <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
          <Text className="text-emerald-500 text-2xl font-bold mb-1">↑</Text>
          <Text className="text-gray-900 text-lg font-bold">{income}€</Text>
          <Text className="text-gray-500 text-xs">Income</Text>
        </View>
        <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
          <Text className="text-rose-500 text-2xl font-bold mb-1">↓</Text>
          <Text className="text-gray-900 text-lg font-bold">{expenses}€</Text>
          <Text className="text-gray-500 text-xs">Expenses</Text>
        </View>
      </View>

      {/* Latest Transactions Section */}
      <View className="px-6 pb-24">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-900">
            Recent Activity
          </Text>
          <Text className="text-blue-600 text-sm font-semibold">
            See All
          </Text>
        </View>
        
        {transactions.map((transaction, index) => (
          <View 
            key={transaction.id} 
            className={`bg-white p-4 rounded-2xl mb-3 flex-row justify-between items-center shadow-sm border border-gray-100 ${
              index === 0 ? 'border-blue-200 shadow-blue-100' : ''
            }`}
          >
            {/* Left Side */}
            <View className="flex-row items-center flex-1">
              {/* Icon */}
              <View className={`w-12 h-12 rounded-2xl justify-center items-center mr-4 ${
                transaction.type === 'income' 
                  ? 'bg-gradient-to-br from-emerald-100 to-emerald-50' 
                  : 'bg-gradient-to-br from-rose-100 to-rose-50'
              }`}>
                <Text className={`text-2xl font-bold ${
                  transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {transaction.type === 'income' ? '↑' : '↓'}
                </Text>
              </View>
              
              {/* Transaction Info */}
              <View className="flex-1">
                <Text className="font-medium text-blue-600 mb-1">
                  {categoryLookup[transaction.category_id] || 'Uncategorized' }
                </Text>
                <Text className="text-sm text-gray-400">
                  {formatDate(transaction.created_at)}
                </Text>
              </View>
            </View>

            {/* Right Side - Amount */}
            <View className="items-end">
              <Text className={`text-lg font-bold ${
                transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
