import { MaterialIcons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { Alert, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { addCategory, deleteCategory, editCategory, getCategories } from '../database/database'
import {
  cancelAllNotifications,
  getScheduledNotifications,
  scheduleAllNotifications,
  sendTestNotification
} from '../notifications/notificationService'
import { Category } from '../types'

export default function Settings() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  useFocusEffect(
    useCallback(() => {
      loadCategories()
      checkNotifications()
    }, [])
  )

  const loadCategories = async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const checkNotifications = async () => {
    try {
      const scheduled = await getScheduledNotifications()
      setNotificationsEnabled(scheduled.length > 0)
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        await scheduleAllNotifications()
        Alert.alert(
          'Notifications Enabled',
          'You will receive reminders at the end of each month and year to check your stats.'
        )
      } else {
        await cancelAllNotifications()
        Alert.alert('Notifications Disabled', 'All scheduled notifications have been cancelled.')
      }
      setNotificationsEnabled(value)
    } catch (error) {
      console.error('Error toggling notifications:', error)
      Alert.alert('Error', 'Failed to update notification settings')
    }
  }

  const handleTestNotification = async () => {
    try {
      await sendTestNotification()
      Alert.alert('Test Sent', 'Check your notifications!')
    } catch (error) {
      console.error('Error sending test notification:', error)
      Alert.alert('Error', 'Failed to send test notification')
    }
  }

  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      try {
        await addCategory(newCategoryName.trim())
        await loadCategories()
        setNewCategoryName('')
        setShowAddModal(false)
        Alert.alert('Success', 'Category added successfully')
      } catch (error) {
        console.error('Error creating category:', error)
        Alert.alert('Error', 'Failed to add category')
      }
    }
  }

  const handleEditCategory = async () => {
    if (editingCategory && editCategoryName.trim()) {
      try {
        await editCategory(editingCategory.id, editCategoryName.trim())
        await loadCategories()
        setShowEditModal(false)
        setEditingCategory(null)
        setEditCategoryName('')
        Alert.alert('Success', 'Category updated successfully')
      } catch (error) {
        console.error('Error editing category:', error)
        Alert.alert('Error', 'Failed to update category')
      }
    }
  }

  const handleDeleteCategory = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This will not delete associated transactions.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id)
              await loadCategories()
              Alert.alert('Success', 'Category deleted successfully')
            } catch (error) {
              console.error('Error deleting category:', error)
              Alert.alert('Error', 'Failed to delete category')
            }
          },
        },
      ]
    )
  }

  const openEditModal = (category: Category) => {
    setEditingCategory(category)
    setEditCategoryName(category.name)
    setShowEditModal(true)
  }

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-8 px-6 rounded-b-3xl shadow-xl">
        <Text className="text-white text-3xl font-bold">Settings</Text>
        <Text className="text-blue-100 text-sm mt-1">Manage your app preferences</Text>
      </View>

      {/* Content */}
      <View className="px-6 mt-6">
        {/* Categories Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-gray-900">Categories</Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              className="bg-blue-600 rounded-xl px-4 py-2 flex-row items-center"
            >
              <MaterialIcons name="add" size={20} color="white" />
              <Text className="text-white font-semibold ml-1">Add</Text>
            </TouchableOpacity>
          </View>

          {categories.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <MaterialIcons name="category" size={48} color="#D1D5DB" />
              <Text className="text-gray-500 text-center mt-3 font-medium">
                No categories yet
              </Text>
              <Text className="text-gray-400 text-center text-sm mt-1">
                Add your first category to get started
              </Text>
            </View>
          ) : (
            <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {categories.map((category, index) => (
                <View
                  key={category.id}
                  className={`flex-row items-center justify-between p-4 ${
                    index !== categories.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="bg-blue-100 rounded-full p-2 mr-3">
                      <MaterialIcons name="label" size={20} color="#2563EB" />
                    </View>
                    <Text className="text-gray-900 font-medium text-base flex-1">
                      {category.name}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => openEditModal(category)}
                      className="bg-gray-100 rounded-lg p-2"
                    >
                      <MaterialIcons name="edit" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteCategory(category)}
                      className="bg-red-100 rounded-lg p-2"
                    >
                      <MaterialIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* App Info Section */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Notifications</Text>
          <View className="bg-white rounded-2xl shadow-sm">
            <View className="p-4 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-gray-900 font-medium mb-1">End of Month/Year Reminders</Text>
                <Text className="text-gray-500 text-xs">Get notified to check your financial stats</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={notificationsEnabled ? '#3B82F6' : '#F3F4F6'}
              />
            </View>
            <TouchableOpacity 
              className="p-4 flex-row items-center justify-between"
              onPress={handleTestNotification}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="notifications-active" size={24} color="#2563EB" />
                <Text className="text-gray-900 font-medium ml-3">Send Test Notification</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info Section */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">About</Text>
          <View className="bg-white rounded-2xl shadow-sm">
            <View className="p-4 border-b border-gray-100">
              <Text className="text-gray-500 text-xs font-semibold mb-1">App Version</Text>
              <Text className="text-gray-900 font-medium">1.0.0</Text>
            </View>
            <View className="p-4 border-b border-gray-100">
              <Text className="text-gray-500 text-xs font-semibold mb-1">Database</Text>
              <Text className="text-gray-900 font-medium">SQLite (Local)</Text>
            </View>
            <View className="p-4">
              <Text className="text-gray-500 text-xs font-semibold mb-1">Total Categories</Text>
              <Text className="text-gray-900 font-medium">{categories.length}</Text>
            </View>
          </View>
        </View>

        {/* Recurring Transactions Section */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Recurring Transactions</Text>
          <View className="bg-white rounded-2xl shadow-sm">
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/recurring')}
              className="p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="loop" size={24} color="#2563EB" />
                <Text className="text-gray-900 font-medium ml-3">Manage Recurring Transactions</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Management Section */}
        <View className="mb-24">
          <Text className="text-xl font-bold text-gray-900 mb-4">Data Management</Text>
          <View className="bg-white rounded-2xl shadow-sm">
            <TouchableOpacity className="p-4 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <MaterialIcons name="backup" size={24} color="#2563EB" />
                <Text className="text-gray-900 font-medium ml-3">Backup Data</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
            </TouchableOpacity>
            <TouchableOpacity className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <MaterialIcons name="restore" size={24} color="#2563EB" />
                <Text className="text-gray-900 font-medium ml-3">Restore Data</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Add Category Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <Text className="text-xl font-bold text-gray-900 mb-4">Add New Category</Text>
            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-4"
              placeholder="Category name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false)
                  setNewCategoryName('')
                }}
                className="flex-1 bg-gray-200 rounded-xl py-3"
              >
                <Text className="text-gray-700 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddCategory}
                className="flex-1 bg-blue-600 rounded-xl py-3"
              >
                <Text className="text-white text-center font-semibold">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <Text className="text-xl font-bold text-gray-900 mb-4">Edit Category</Text>
            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 mb-4"
              placeholder="Category name"
              value={editCategoryName}
              onChangeText={setEditCategoryName}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false)
                  setEditingCategory(null)
                  setEditCategoryName('')
                }}
                className="flex-1 bg-gray-200 rounded-xl py-3"
              >
                <Text className="text-gray-700 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditCategory}
                className="flex-1 bg-blue-600 rounded-xl py-3"
              >
                <Text className="text-white text-center font-semibold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}
