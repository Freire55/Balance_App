import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { getCategories, getTotalBalance, getTransactions } from '../database/database'
import type { Category, FinanceSummary, Record, Transaction } from '../types'

// Fake data for demonstration
const MOCK_BALANCE = 2847.50

const MOCK_TRANSACTIONS = [
  {
    id: 1,
    type: 'income',
    amount: 3500.00,
    category: 'Salary',
    source: 'Monthly Paycheck',
    description: 'December salary',
    date: 'Dec 1, 2025'
  },
  {
    id: 2,
    type: 'expense',
    amount: 125.50,
    category: 'Food & Dining',
    source: 'Grocery Store',
    description: 'Weekly groceries',
    date: 'Dec 15, 2025'
  },
  {
    id: 3,
    type: 'expense',
    amount: 89.99,
    category: 'Entertainment',
    source: 'Netflix & Spotify',
    description: 'Monthly subscriptions',
    date: 'Dec 10, 2025'
  },
  {
    id: 4,
    type: 'income',
    amount: 250.00,
    category: 'Freelance',
    source: 'Side Project',
    description: 'Web design work',
    date: 'Dec 20, 2025'
  },
  {
    id: 5,
    type: 'expense',
    amount: 450.00,
    category: 'Housing',
    source: 'Rent Payment',
    description: 'December rent',
    date: 'Dec 1, 2025'
  },
  {
    id: 6,
    type: 'expense',
    amount: 65.00,
    category: 'Transportation',
    source: 'Gas Station',
    description: 'Fuel',
    date: 'Dec 18, 2025'
  },
  {
    id: 7,
    type: 'income',
    amount: 150.00,
    category: 'Other',
    source: 'Gift',
    description: 'Birthday money',
    date: 'Dec 25, 2025'
  },
  {
    id: 8,
    type: 'expense',
    amount: 45.99,
    category: 'Shopping',
    source: 'Amazon',
    description: 'Books and supplies',
    date: 'Dec 22, 2025'
  }
]


export default function Home() {


  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [income, setIncome] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])


  useEffect(() => {
    fetchInfo()
  }, [])

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
      
      const categoryLookup= categoriesArray.reduce<Record<number, string>>((acc, tx) => {
        acc[tx.id] = tx.name;
        return acc;
      }, {});

    
      // Assign to state
      setTransactions(transactionsArray);
      setBalance(balanceValue);
      setIncome(totals.income);
      setExpenses(totals.expenses);
      setCategories(categoriesArray);

    } catch (error) {
      console.error('Error fetching data:', error);
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
                <Text className="text-base font-bold text-gray-900 mb-0.5">
                  {transaction.source}
                </Text>
                <Text className="text-xs font-medium text-blue-600 mb-1">
                  {transaction.category}
                </Text>
                <Text className="text-xs text-gray-400">
                  {transaction.created_at}
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
