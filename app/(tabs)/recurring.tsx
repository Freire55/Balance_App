import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { deleteRecurringTransaction, getCategories, getRecurringTransactions } from '../database/database'
import { Category, RecurringTransaction } from '../types'

export default function ManageRecurringTransactions() {
  const router = useRouter()
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  const loadData = async () => {
    try {
      const [recurring, cats] = await Promise.all([
        getRecurringTransactions(),
        getCategories()
      ])
      setRecurringTransactions(recurring)
      setCategories(cats)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId)
    return category?.name || 'Unknown'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No end date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const handleDelete = (recurring: RecurringTransaction) => {
    Alert.alert(
      "Delete Recurring Transaction",
      `Are you sure you want to delete "${recurring.description}"?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecurringTransaction(recurring.id)
              await loadData()
            } catch (error) {
              console.error('Error deleting recurring transaction:', error)
              Alert.alert("Error", "Failed to delete recurring transaction")
            }
          }
        }
      ]
    )
  }

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-8 px-6 rounded-b-3xl shadow-xl">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="bg-white/20 p-2 rounded-xl"
          >
            <Text className="text-white text-xl font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Recurring</Text>
          <View className="w-10" />
        </View>
      </View>

      {/* Content */}
      <View className="px-6 -mt-4">
        {recurringTransactions.length === 0 ? (
          <View className="bg-white rounded-3xl shadow-md p-8 items-center">
            <Text className="text-gray-400 text-lg font-semibold mb-2">No recurring transactions</Text>
            <Text className="text-gray-400 text-sm text-center">
              Add recurring transactions from the New Transaction screen
            </Text>
          </View>
        ) : (
          recurringTransactions.map((recurring) => (
            <TouchableOpacity
              key={recurring.id}
              onPress={() => handleDelete(recurring)}
              className="bg-white rounded-2xl shadow-sm p-4 mb-3 border border-gray-100"
            >
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1">
                  <Text className="text-gray-900 text-lg font-bold mb-1">
                    {recurring.description}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {getCategoryName(recurring.category_id)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`text-xl font-bold ${
                    recurring.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {recurring.type === 'income' ? '+' : '-'}€{recurring.amount.toFixed(2)}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-1">
                    {recurring.type === 'income' ? 'Income' : 'Expense'}
                  </Text>
                </View>
              </View>
              
              <View className="border-t border-gray-100 pt-3 mt-2">
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-gray-400 text-xs">Runs on</Text>
                    <Text className="text-gray-900 text-sm font-semibold">1st of month</Text>
                  </View>
                  <View>
                    <Text className="text-gray-400 text-xs">Start Date</Text>
                    <Text className="text-gray-900 text-sm font-semibold">{formatDate(recurring.start_date)}</Text>
                  </View>
                  <View>
                    <Text className="text-gray-400 text-xs">End Date</Text>
                    <Text className="text-gray-900 text-sm font-semibold">
                      {recurring.end_date ? formatDate(recurring.end_date) : 'Never'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text className="text-red-500 text-xs text-center mt-3 font-semibold">
                Tap to delete
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  )
}
