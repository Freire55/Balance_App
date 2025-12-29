import React, { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Transaction, Trends } from '../types'
import { getMonthlyTotal, getTransactions, getYearlyTotal } from '../database/database';

// Mock data for different time periods
const MOCK_STATS = {
  month: {
    totalIncome: 3900.00,
    totalExpenses: 1052.49,
    balance: 2847.51,
    transactionCount: 15,
    categories: [
      { name: 'Salary', amount: 3500, type: 'income', percentage: 90 },
      { name: 'Freelance', amount: 250, type: 'income', percentage: 6 },
      { name: 'Other', amount: 150, type: 'income', percentage: 4 },
      { name: 'Housing', amount: 450, type: 'expense', percentage: 43 },
      { name: 'Food & Dining', amount: 158, type: 'expense', percentage: 15 },
      { name: 'Entertainment', amount: 105.98, type: 'expense', percentage: 10 },
      { name: 'Transportation', amount: 65, type: 'expense', percentage: 6 },
      { name: 'Shopping', amount: 45.99, type: 'expense', percentage: 4 },
    ],
    weeklyTrend: [
      { week: 'Week 1', income: 3500, expenses: 450 },
      { week: 'Week 2', income: 0, expenses: 215.49 },
      { week: 'Week 3', income: 250, expenses: 110.99 },
      { week: 'Week 4', income: 150, expenses: 276.01 },
    ]
  },
  year: {
    totalIncome: 46800.00,
    totalExpenses: 32450.00,
    balance: 14350.00,
    transactionCount: 156,
    categories: [
      { name: 'Salary', amount: 42000, type: 'income', percentage: 90 },
      { name: 'Freelance', amount: 3000, type: 'income', percentage: 6 },
      { name: 'Other', amount: 1800, type: 'income', percentage: 4 },
      { name: 'Housing', amount: 5400, type: 'expense', percentage: 17 },
      { name: 'Food & Dining', amount: 4200, type: 'expense', percentage: 13 },
      { name: 'Transportation', amount: 3600, type: 'expense', percentage: 11 },
      { name: 'Entertainment', amount: 2400, type: 'expense', percentage: 7 },
      { name: 'Shopping', amount: 1850, type: 'expense', percentage: 6 },
    ],
    monthlyTrend: [
      { month: 'Jul', income: 3900, expenses: 2700 },
      { month: 'Aug', income: 3900, expenses: 2850 },
      { month: 'Sep', income: 3900, expenses: 2600 },
      { month: 'Oct', income: 3900, expenses: 2750 },
      { month: 'Nov', income: 3900, expenses: 2900 },
      { month: 'Dec', income: 3900, expenses: 1052 },
    ]
  }
}

const now = new Date();

export default function Stats() {

  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [positiveBalance, setPositiveBalance] = useState([])
  const [negativeBalance, setNegativeBalance] = useState([])
  const [monthIncome, setMonthIncome] = useState(0)
  const [monthExpenses, setMonthExpenses] = useState(0)
  const [monthBalance, setMonthBalance] = useState(0)
  const [yearIncome, setYearIncome] = useState(0)
  const [yearExpenses, setYearExpenses] = useState(0)
  const [yearBalance, setYearBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [weeklyTrend, setWeeklyTrend] = useState<Trends[]>([
    { num: 1, income: 0, expenses: 0 },
    { num: 2, income: 0, expenses: 0 },
    { num: 3, income: 0, expenses: 0 },
    { num: 4, income: 0, expenses: 0 },
  ])

  const [monthlyTrend, setMonthlyTrend] = useState<Trends[]>([
    { num: 1, income: 0, expenses: 0 },
    { num: 2, income: 0, expenses: 0 },
    { num: 3, income: 0, expenses: 0 },
    { num: 4, income: 0, expenses: 0 },
    { num: 5, income: 0, expenses: 0 },
    { num: 6, income: 0, expenses: 0 },
    { num: 7, income: 0, expenses: 0 },
    { num: 8, income: 0, expenses: 0 },
    { num: 9, income: 0, expenses: 0 },
    { num: 10, income: 0, expenses: 0 },
    { num: 11, income: 0, expenses: 0 },
    { num: 12, income: 0, expenses: 0 },
  ])


  const fetchInfo = async () => {
    try{
      const monthBalance = await getMonthlyTotal((now.getMonth() + 1).toString().padStart(2, '0'), now.getFullYear().toString());
      const yearBalance = await getYearlyTotal(now.getFullYear().toString());
      const transactionsArray = await getTransactions();

      const monthTotals = transactionsArray.reduce<Trends[]>((acc, tx) => {
        const date = new Date(tx.created_at);
        const monthIndex = date.getMonth();
        const year = date.getFullYear();
        if(year !== now.getFullYear()) return acc;
        if (tx.type === 'income') {
          acc[monthIndex].income += tx.amount;
        } else if (tx.type === 'expense') {
          acc[monthIndex].expenses += tx.amount;
        }

        return acc;
      }, Array.from({ length: 12 }, (_, i) => ({ num: i + 1, income: 0, expenses: 0 })));
          

      const weekTotals = transactionsArray.reduce<Trends[]>((acc, tx) => {
        const date = new Date(tx.created_at);
        const day = date.getDate();

        let weekIndex = Math.floor((day - 1) / 7);
        if (weekIndex > 3) weekIndex = 3;

        if (tx.type === 'income') {
          acc[weekIndex].income += tx.amount;
        } else if (tx.type === 'expense') {
          acc[weekIndex].expenses += tx.amount;
        }

        return acc;
      }, Array.from({ length: 4 }, (_, i) => ({ num: i + 1, income: 0, expenses: 0 })));


      const yearTotals = monthTotals.reduce<{ income: number; expenses: number }>((acc, month) => {
        acc.income += month.income;
        acc.expenses += month.expenses;
        return acc;
      }, { income: 0, expenses: 0 });

      setTransactions(transactionsArray);
      setMonthIncome(monthTotals[now.getMonth() + 1].income);
      setMonthExpenses(monthTotals[now.getMonth() + 1].expenses);
      setYearIncome(yearTotals.income);
      setYearExpenses(yearTotals.expenses);
      setMonthBalance(monthBalance);
      setYearBalance(yearBalance);
      setWeeklyTrend(weekTotals);
      setMonthlyTrend(monthTotals);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }
  
  const stats = MOCK_STATS[period]
  const savingsRate = ((stats.balance / stats.totalIncome) * 100).toFixed(1)
  
  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-8 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-3xl font-bold mb-6">Statistics</Text>
        
        {/* Period Selector */}
        <View className="bg-white/20 backdrop-blur-lg rounded-3xl p-2 flex-row mb-4">
          <TouchableOpacity
            onPress={() => setPeriod('month')}
            className={`flex-1 py-3 rounded-2xl ${
              period === 'month' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-bold ${
              period === 'month' ? 'text-blue-600' : 'text-white'
            }`}>
              This Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPeriod('year')}
            className={`flex-1 py-3 rounded-2xl ${
              period === 'year' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-bold ${
              period === 'year' ? 'text-blue-600' : 'text-white'
            }`}>
              This Year
            </Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View className="bg-white/20 backdrop-blur-lg p-5 rounded-3xl border border-white/30">
          <Text className="text-white/80 text-sm mb-1">Net Balance</Text>
          <Text className="text-white text-4xl font-bold mb-2">
            {monthBalance >= 0 ? '+' : ''}${monthBalance.toFixed(2)}
          </Text>
          <Text className="text-white/70 text-xs">
            {stats.transactionCount} transactions • {savingsRate}% savings rate
          </Text>
        </View>
      </View>

      {/* Overview Cards */}
      <View className="px-6 -mt-4 mb-4">
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
            <Text className="text-emerald-500 text-2xl font-bold mb-1">↑</Text>
            <Text className="text-gray-900 text-xl font-bold">${stats.totalIncome.toFixed(0)}</Text>
            <Text className="text-gray-500 text-xs">Total Income</Text>
          </View>
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-md">
            <Text className="text-rose-500 text-2xl font-bold mb-1">↓</Text>
            <Text className="text-gray-900 text-xl font-bold">${stats.totalExpenses.toFixed(0)}</Text>
            <Text className="text-gray-500 text-xs">Total Expenses</Text>
          </View>
        </View>
      </View>

      {/* Income vs Expenses Chart */}
      <View className="px-6 mb-6">
        <View className="bg-white rounded-2xl p-5 shadow-md">
          <Text className="text-lg font-bold text-gray-900 mb-4">Income vs Expenses</Text>
          
          <View className="mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Income</Text>
              <Text className="text-sm font-bold text-emerald-600">${stats.totalIncome.toFixed(2)}</Text>
            </View>
            <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <View className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
            </View>
          </View>

          <View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-gray-600">Expenses</Text>
              <Text className="text-sm font-bold text-rose-600">${stats.totalExpenses.toFixed(2)}</Text>
            </View>
            <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <View 
                className="h-full bg-rose-500 rounded-full" 
                style={{ width: `${(stats.totalExpenses / stats.totalIncome) * 100}%` }} 
              />
            </View>
          </View>
        </View>
      </View>

      {/* Category Breakdown */}
      <View className="px-6 mb-6">
        <View className="bg-white rounded-2xl p-5 shadow-md">
          <Text className="text-lg font-bold text-gray-900 mb-4">Top Categories</Text>
          
          {stats.categories.map((category, index) => (
            <View key={index} className="mb-4">
              <View className="flex-row justify-between mb-2">
                <View className="flex-row items-center flex-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${
                    category.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                  <Text className="text-sm text-gray-700 flex-1">{category.name}</Text>
                </View>
                <Text className={`text-sm font-bold ${
                  category.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  ${category.amount.toFixed(0)}
                </Text>
              </View>
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <View 
                  className={`h-full rounded-full ${
                    category.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${category.percentage}%` }} 
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Trend Chart */}
      <View className="px-6 mb-24">
        <View className="bg-white rounded-2xl p-5 shadow-md">
          <Text className="text-lg font-bold text-gray-900 mb-4">
            {period === 'month' ? 'Weekly' : 'Monthly'} Trend
          </Text>
          
          <View className="flex-row items-end justify-between mb-3" style={{ height: 160 }}>
            {(period === 'month' ? weeklyTrend : monthlyTrend).map((item, index) => {
              const maxAmount = Math.max(
                ...(period === 'month' ? weeklyTrend : monthlyTrend).map(i => Math.max(i.income, i.expenses))
              )
              const incomeHeight = (item.income / maxAmount) * 140 
              const expenseHeight = (item.expenses / maxAmount) * 140
              
              return (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ height: 140, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 4, marginBottom: 8 }}>
                    <View 
                      style={{ 
                        width: 12, 
                        height: Math.max(incomeHeight, 4),
                        backgroundColor: '#10b981',
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4
                      }} 
                    />
                    <View 
                      style={{ 
                        width: 12, 
                        height: Math.max(expenseHeight, 4),
                        backgroundColor: '#f43f5e',
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4
                      }} 
                    />
                  </View>
                  <Text className="text-xs text-gray-500">
                    {period === 'month' ? item.num : item.num}
                  </Text>
                </View>
              )
            })}
          </View>

          <View className="flex-row justify-center gap-4 pt-3 border-t border-gray-100">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-emerald-500 rounded mr-2" />
              <Text className="text-xs text-gray-600">Income</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-rose-500 rounded mr-2" />
              <Text className="text-xs text-gray-600">Expenses</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
