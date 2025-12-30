import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { addCategory, addRecurringTransaction, addTransaction, deleteCategory, getCategories } from '../database/database'
import { Category } from '../types'
import { processRecurringTransactions } from '../utils/recurringProcessor'

export default function NewTransaction() {
  const router = useRouter()
  const [transactionMode, setTransactionMode] = useState<'normal' | 'recurring'>('normal')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [description, setDescription] = useState('')
  
  // Recurring transaction fields
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [hasEndDate, setHasEndDate] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const data = await getCategories()
      setCategories(data)
      if (data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0])
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const handleCreateCategory = async () => {
    if (newCategoryName.trim()) {
      try {
        await addCategory(newCategoryName.trim())
        await loadCategories()
        const newCat = categories.find(c => c.name === newCategoryName.trim())
        if (newCat) setSelectedCategory(newCat)
        setNewCategoryName('')
      } catch (error) {
        console.error('Error creating category:', error)
      }
    }
  }

  const handleCategoryLongPress = (category: Category) => {
  Alert.alert(
    "Delete Category",
    `Do you want to delete "${category.name}"?`,
    [
      {
        text: "Delete",
        onPress: async () => {
          await deleteCategory(category.id);
          if (selectedCategory?.id === category.id) {
            setSelectedCategory(null);
          }
          await loadCategories();
        },
        style: "destructive",
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]
  );
};

  const handleSubmit = async () => {
    if (!selectedCategory || !amount) {
      alert("Please fill in all required fields")
      return
    }

    try {
      if (transactionMode === 'normal') {
        await addTransaction({
          type: type as 'income' | 'expense',
          amount: parseFloat(amount),
          category_id: selectedCategory.id,
          description,
          created_at: new Date().toISOString(),
        })
      } else {
        // Recurring transaction
        if (!description.trim()) {
          alert("Description is required for recurring transactions")
          return
        }

        await addRecurringTransaction({
          type: type as 'income' | 'expense',
          amount: parseFloat(amount),
          category_id: selectedCategory.id,
          description: description.trim(),
          start_date: startDate.toISOString(),
          end_date: hasEndDate && endDate ? endDate.toISOString() : undefined
        })
        
        // Process recurring transactions immediately to create actual transactions
        await processRecurringTransactions()
      }
      
      setAmount('')
      setDescription('')
      setSelectedCategory(null)
      setStartDate(new Date())
      setEndDate(null)
      setHasEndDate(false)
      router.back()
    } catch (error) {
      console.error('Error adding transaction:', error)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const incrementMonth = (date: Date, setter: (date: Date) => void) => {
    const newDate = new Date(date)
    newDate.setMonth(newDate.getMonth() + 1)
    setter(newDate)
  }

  const decrementMonth = (date: Date, setter: (date: Date) => void) => {
    const newDate = new Date(date)
    newDate.setMonth(newDate.getMonth() - 1)
    
    // Don't allow going before current month
    const now = new Date()
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
    
    if (newDate >= now) {
      setter(newDate)
    }
  }

  return (
    <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} // Adjust if needed
      >
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
          <Text className="text-white text-2xl font-bold">New Transaction</Text>
          <View className="w-10" />
        </View>
      </View>

      {/* Form Content */}
      <View className="px-6 -mt-4">
        {/* Transaction Mode Selector */}
        <View className="bg-white rounded-3xl shadow-md p-2 mb-6 flex-row">
          <TouchableOpacity
            onPress={() => setTransactionMode('normal')}
            className={`flex-1 py-4 rounded-2xl ${
              transactionMode === 'normal' ? 'bg-blue-600' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-bold text-base ${
              transactionMode === 'normal' ? 'text-white' : 'text-gray-600'
            }`}>
              Normal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTransactionMode('recurring')}
            className={`flex-1 py-4 rounded-2xl ${
              transactionMode === 'recurring' ? 'bg-blue-600' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-bold text-base ${
              transactionMode === 'recurring' ? 'text-white' : 'text-gray-600'
            }`}>
              Recurring
            </Text>
          </TouchableOpacity>
        </View>
        {/* Transaction Type Selector */}
        <View className="bg-white rounded-3xl shadow-md p-2 mb-6 flex-row">
          <TouchableOpacity
            onPress={() => setType('expense')}
            className={`flex-1 py-4 rounded-2xl ${
              type === 'expense' ? 'bg-rose-500' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-bold text-base ${
              type === 'expense' ? 'text-white' : 'text-gray-600'
            }`}>
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setType('income')}
            className={`flex-1 py-4 rounded-2xl ${
              type === 'income' ? 'bg-emerald-500' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-bold text-base ${
              type === 'income' ? 'text-white' : 'text-gray-600'
            }`}>
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View className="bg-white rounded-3xl shadow-md p-6 mb-4">
          <Text className="text-gray-500 text-sm font-semibold mb-2">Amount</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 text-gray-900 text-4xl font-bold"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholderTextColor="#D1D5DB"
            />
            <Text className="text-gray-900 text-4xl font-bold mr-2">€</Text>
          </View>
        </View>

        {/* Recurring: Start Date */}
        {transactionMode === 'recurring' && (
          <View className="bg-white rounded-2xl shadow-sm p-4 mb-3 border border-gray-100">
            <Text className="text-gray-500 text-xs font-semibold mb-2">Start Month</Text>
            <View className="flex-row items-center justify-between">
              <TouchableOpacity 
                onPress={() => {
                  const now = new Date()
                  now.setDate(1)
                  now.setHours(0, 0, 0, 0)
                  
                  const currentStart = new Date(startDate)
                  currentStart.setDate(1)
                  currentStart.setHours(0, 0, 0, 0)
                  
                  if (currentStart > now) {
                    decrementMonth(startDate, setStartDate)
                  }
                }}
                className="bg-blue-100 rounded-lg p-2"
                disabled={(() => {
                  const now = new Date()
                  now.setDate(1)
                  now.setHours(0, 0, 0, 0)
                  
                  const currentStart = new Date(startDate)
                  currentStart.setDate(1)
                  currentStart.setHours(0, 0, 0, 0)
                  
                  return currentStart <= now
                })()}
                style={{ opacity: (() => {
                  const now = new Date()
                  now.setDate(1)
                  now.setHours(0, 0, 0, 0)
                  
                  const currentStart = new Date(startDate)
                  currentStart.setDate(1)
                  currentStart.setHours(0, 0, 0, 0)
                  
                  return currentStart <= now ? 0.3 : 1
                })() }}
              >
                <Text className="text-blue-600 font-bold text-xl">←</Text>
              </TouchableOpacity>
              <Text className="text-gray-900 text-lg font-bold">{formatDate(startDate)}</Text>
              <TouchableOpacity 
                onPress={() => incrementMonth(startDate, setStartDate)}
                className="bg-blue-100 rounded-lg p-2"
              >
                <Text className="text-blue-600 font-bold text-xl">→</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recurring: End Date Toggle */}
        {transactionMode === 'recurring' && (
          <View className="bg-white rounded-2xl shadow-sm p-4 mb-3 border border-gray-100">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-500 text-xs font-semibold">Set End Date?</Text>
              <TouchableOpacity
                onPress={() => {
                  setHasEndDate(!hasEndDate)
                  if (!hasEndDate && !endDate) {
                    const defaultEnd = new Date(startDate)
                    defaultEnd.setMonth(defaultEnd.getMonth() + 12)
                    setEndDate(defaultEnd)
                  }
                }}
                className={`px-4 py-2 rounded-lg ${hasEndDate ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <Text className={`font-semibold ${hasEndDate ? 'text-white' : 'text-gray-600'}`}>
                  {hasEndDate ? 'Yes' : 'No'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {hasEndDate && endDate && (
              <View className="flex-row items-center justify-between mt-2">
                <TouchableOpacity 
                  onPress={() => decrementMonth(endDate, setEndDate)}
                  className="bg-blue-100 rounded-lg p-2"
                >
                  <Text className="text-blue-600 font-bold text-xl">←</Text>
                </TouchableOpacity>
                <Text className="text-gray-900 text-lg font-bold">{formatDate(endDate)}</Text>
                <TouchableOpacity 
                  onPress={() => incrementMonth(endDate, setEndDate)}
                  className="bg-blue-100 rounded-lg p-2"
                >
                  <Text className="text-blue-600 font-bold text-xl">→</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Category Dropdown */}
        <View className="bg-white rounded-2xl shadow-sm p-4 mb-3 border border-gray-100">
          <Text className="text-gray-500 text-xs font-semibold mb-2">Category</Text>
          <TouchableOpacity
            onPress={() => setShowCategoryModal(true)}
            className="flex-row justify-between items-center"
          >
            <Text className={`text-base font-medium ${selectedCategory ? 'text-gray-900' : 'text-gray-400'}`}>
              {selectedCategory ? selectedCategory.name : 'Select a category'}
            </Text>
            <Text className="text-blue-600 text-xl">▼</Text>
          </TouchableOpacity>
        </View>

        {/* Description Input */}
        <View className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-100">
          <Text className="text-gray-500 text-xs font-semibold mb-2">
            Description {transactionMode === 'recurring' && '(Required)'}
          </Text>
          <TextInput
            className="text-gray-900 text-base font-medium"
            placeholder="Add notes..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          className="bg-blue-600 rounded-2xl py-5 shadow-xl mb-24"
          style={{
            shadowColor: '#2563eb',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text className="text-white text-center text-lg font-bold">
            {transactionMode === 'normal' ? 'Add Transaction' : 'Add Recurring Transaction'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
        onDismiss={() => setShowCategoryModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text className="text-gray-500 text-2xl">×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4">
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    selectedCategory == cat ? setSelectedCategory(null) :
                    setSelectedCategory(cat)
                  }}
                  onLongPress={() => handleCategoryLongPress(cat)}
                  className={`p-4 rounded-xl mb-2 border ${
                    selectedCategory?.id === cat.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text className={`font-semibold ${
                    selectedCategory?.id === cat.id ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowCategoryModal(false)}
              className="mb-4"
            >
              <Text className="text-blue-600 text-center font-semibold">Done</Text>
            </TouchableOpacity>

            {/* Create New Category */}
            <View className="border-t border-gray-200 pt-4">
              <Text className="text-sm font-semibold text-gray-500 mb-2">Create New Category</Text>
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                  placeholder="Category name"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  onPress={handleCreateCategory}
                  className="bg-blue-600 rounded-xl px-6 justify-center"
                >
                  <Text className="text-white font-bold">Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}