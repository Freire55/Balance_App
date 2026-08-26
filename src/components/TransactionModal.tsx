import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { deleteTransaction, editTransaction, getCategories } from '../database/database';
import { Category, Transaction, TransactionType } from '../database/types';
import { CategoryIcon } from './CategoryIcon';

interface TransactionModalProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  visible,
  transaction,
  onClose,
  onUpdated,
}) => {
  const { formatCurrency, settings, theme } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Edit form state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    if (visible && transaction) {
      setIsEditing(false);
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setCategoryId(transaction.category_id);
      setDescription(transaction.description || '');
      setCreatedAt(transaction.created_at);
      loadCategories();
    }
  }, [visible, transaction]);

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (e) {
      console.error('Error loading categories in modal:', e);
    }
  };

  if (!transaction) return null;

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
      return;
    }

    try {
      await editTransaction({
        id: transaction.id,
        type,
        amount: parsedAmount,
        category_id: categoryId || transaction.category_id,
        description: description.trim() || undefined,
        created_at: createdAt || transaction.created_at,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Error saving transaction:', e);
      Alert.alert('Error', 'Failed to save changes.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(transaction.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onUpdated();
              onClose();
            } catch (e) {
              console.error('Error deleting transaction:', e);
              Alert.alert('Error', 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  const formattedDate = new Date(transaction.created_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(transaction.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/70"
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderTopWidth: 1,
          }}
          className="rounded-t-3xl p-6 max-h-[88%] shadow-2xl"
        >
          {/* Header */}
          <View
            style={{ borderBottomColor: theme.border }}
            className="flex-row items-center justify-between pb-4 border-b"
          >
            <Text style={{ color: theme.textPrimary }} className="text-xl font-bold">
              {isEditing ? 'Edit Transaction' : 'Transaction Details'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: '#F1F5F9' }}
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-4">
            {!isEditing ? (
              // VIEW MODE
              <View>
                {/* Hero Amount Banner */}
                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className="items-center my-4 py-6 rounded-3xl"
                >
                  <CategoryIcon
                    icon={transaction.category_icon}
                    color={transaction.category_color}
                    size={32}
                    containerSize={64}
                  />
                  <Text
                    style={{
                      color: transaction.type === 'income' ? '#10B981' : theme.textPrimary,
                    }}
                    className="text-3xl font-extrabold mt-3 tracking-tight"
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount, { forceVisible: true })}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-2">
                    <View
                      style={{
                        backgroundColor: transaction.type === 'income' ? '#ECFDF5' : '#FFF1F2',
                      }}
                      className="px-2.5 py-1 rounded-full"
                    >
                      <Text
                        style={{
                          color: transaction.type === 'income' ? '#059669' : '#E11D48',
                        }}
                        className="text-xs font-semibold uppercase"
                      >
                        {transaction.type}
                      </Text>
                    </View>
                    {transaction.recurring_rule_id && (
                      <View
                        style={{ backgroundColor: '#EEF2FF' }}
                        className="px-2.5 py-1 rounded-full"
                      >
                        <Text
                          style={{ color: '#4F46E5' }}
                          className="text-xs font-semibold"
                        >
                          Recurring
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Details List */}
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className="rounded-2xl divide-y mb-6"
                >
                  <View
                    style={{ borderBottomColor: theme.border }}
                    className="p-4 flex-row justify-between items-center border-b"
                  >
                    <Text style={{ color: theme.textSecondary }} className="font-medium text-sm">
                      Category
                    </Text>
                    <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                      {transaction.category_name || 'Uncategorized'}
                    </Text>
                  </View>
                  <View
                    style={{ borderBottomColor: theme.border }}
                    className="p-4 flex-row justify-between items-center border-b"
                  >
                    <Text style={{ color: theme.textSecondary }} className="font-medium text-sm">
                      Date
                    </Text>
                    <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                      {formattedDate}
                    </Text>
                  </View>
                  <View
                    style={{ borderBottomColor: theme.border }}
                    className="p-4 flex-row justify-between items-center border-b"
                  >
                    <Text style={{ color: theme.textSecondary }} className="font-medium text-sm">
                      Time
                    </Text>
                    <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                      {formattedTime}
                    </Text>
                  </View>
                  {transaction.description ? (
                    <View className="p-4">
                      <Text style={{ color: theme.textSecondary }} className="font-medium text-sm mb-1">
                        Notes
                      </Text>
                      <Text style={{ color: theme.textPrimary }} className="font-medium text-sm leading-5">
                        {transaction.description}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3 mt-2 mb-6">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditing(true);
                    }}
                    className="flex-1 bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center shadow-sm"
                  >
                    <MaterialIcons name="edit" size={18} color="white" />
                    <Text className="text-white font-semibold text-base ml-2">Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleDelete}
                    style={{
                      backgroundColor: '#FFF1F2',
                      borderColor: '#FFE4E6',
                      borderWidth: 1,
                    }}
                    className="flex-1 rounded-2xl py-4 flex-row items-center justify-center"
                  >
                    <MaterialIcons name="delete-outline" size={18} color="#F43F5E" />
                    <Text className="text-rose-500 font-semibold text-base ml-2">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // EDIT MODE
              <View className="pb-6">
                {/* Type Switcher */}
                <View
                  style={{ backgroundColor: '#F1F5F9' }}
                  className="rounded-2xl p-1.5 flex-row mb-4"
                >
                  <TouchableOpacity
                    onPress={() => setType('expense')}
                    className={`flex-1 py-3 rounded-xl items-center ${
                      type === 'expense' ? 'bg-rose-500 shadow-sm' : ''
                    }`}
                  >
                    <Text
                      style={{ color: type === 'expense' ? '#FFFFFF' : theme.textSecondary }}
                      className="font-bold text-sm"
                    >
                      Expense
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setType('income')}
                    className={`flex-1 py-3 rounded-xl items-center ${
                      type === 'income' ? 'bg-emerald-500 shadow-sm' : ''
                    }`}
                  >
                    <Text
                      style={{ color: type === 'income' ? '#FFFFFF' : theme.textSecondary }}
                      className="font-bold text-sm"
                    >
                      Income
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Amount Input */}
                <View
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className="rounded-2xl p-4 mb-4"
                >
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                    Amount
                  </Text>
                  <View className="flex-row items-center">
                    <TextInput
                      style={{ color: theme.textPrimary }}
                      className="flex-1 text-2xl font-bold"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={theme.textMuted}
                    />
                    <Text style={{ color: theme.textSecondary }} className="text-xl font-bold ml-2">
                      {settings.currencySymbol}
                    </Text>
                  </View>
                </View>

                {/* Category Picker */}
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs font-bold uppercase tracking-wider mb-2"
                >
                  Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <View className="flex-row gap-2">
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCategoryId(cat.id)}
                        style={{
                          backgroundColor: categoryId === cat.id ? '#EEF2FF' : theme.cardSecondary,
                          borderColor: categoryId === cat.id ? '#6366F1' : theme.border,
                          borderWidth: 1,
                        }}
                        className="flex-row items-center px-3.5 py-2.5 rounded-xl"
                      >
                        <CategoryIcon
                          icon={cat.icon}
                          color={cat.color}
                          size={16}
                          containerSize={28}
                        />
                        <Text
                          style={{
                            color: categoryId === cat.id ? '#4F46E5' : theme.textPrimary,
                          }}
                          className="ml-2 text-xs font-semibold"
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Description Input */}
                <View
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className="rounded-2xl p-4 mb-6"
                >
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                    Notes / Description
                  </Text>
                  <TextInput
                    style={{ color: theme.textPrimary }}
                    className="text-sm font-medium"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add description..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Buttons */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setIsEditing(false)}
                    style={{ backgroundColor: '#F1F5F9' }}
                    className="flex-1 rounded-2xl py-4 items-center"
                  >
                    <Text style={{ color: theme.textPrimary }} className="font-semibold text-base">
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    className="flex-1 bg-indigo-600 rounded-2xl py-4 items-center shadow-md"
                  >
                    <Text className="text-white font-bold text-base">Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
