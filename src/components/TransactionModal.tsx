import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
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
import { deleteTransaction, editTransaction, getCategories, getFinanceEvents } from '../database/database';
import { Category, FinanceEvent, Transaction, TransactionType } from '../database/types';
import { CategoryIcon } from './CategoryIcon';
import { CustomDialog } from './CustomDialog';

interface TransactionModalProps {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onUpdated: () => void;
}

const COMMON_TAGS = ['tax-deductible', 'vacation', 'work', 'gift', 'grocery', 'health', 'eating-out'];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  visible,
  transaction,
  onClose,
  onUpdated,
}) => {
  const { formatCurrency, settings, theme, isDark, triggerRefresh } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<FinanceEvent[]>([]);

  // Edit form state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert' | 'danger' | 'success';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
  });

  useEffect(() => {
    if (visible && transaction) {
      setIsEditing(false);
      setType(transaction.type);
      setAmount(transaction.amount.toString());
      setCategoryId(transaction.category_id ?? null);
      setEventId(transaction.event_id ?? null);
      setDescription(transaction.description || '');
      setTags(transaction.tags || '');
      setCreatedAt(transaction.created_at);
      loadMetadata();
    }
  }, [visible, transaction]);

  const loadMetadata = async () => {
    try {
      const [cats, evts] = await Promise.all([getCategories(), getFinanceEvents()]);
      setCategories(cats);
      setEvents(evts);
    } catch (e) {
      console.error('Error loading metadata in modal:', e);
    }
  };

  if (!transaction) return null;

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount.replace(/[^0-9.,]/g, '').replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setDialogState({
        visible: true,
        title: 'Invalid Amount',
        message: 'Please enter a valid positive number.',
        type: 'alert',
      });
      return;
    }

    try {
      await editTransaction({
        id: transaction.id,
        type,
        amount: parsedAmount,
        category_id: categoryId !== undefined && categoryId !== null ? categoryId : transaction.category_id,
        event_id: eventId ?? null,
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
        created_at: createdAt || transaction.created_at,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);
      triggerRefresh();
      onUpdated();
      onClose();
    } catch (e) {
      console.error('Error saving transaction:', e);
      setDialogState({
        visible: true,
        title: 'Error',
        message: 'Failed to save changes.',
        type: 'alert',
      });
    }
  };

  const handleDelete = () => {
    setDialogState({
      visible: true,
      title: 'Delete Transaction',
      message: 'Are you sure you want to permanently delete this transaction?',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteTransaction(transaction.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          triggerRefresh();
          onUpdated();
          onClose();
        } catch (e) {
          console.error('Error deleting transaction:', e);
          setDialogState({
            visible: true,
            title: 'Error',
            message: 'Failed to delete transaction.',
            type: 'alert',
          });
        }
      },
    });
  };

  const handleToggleTag = (tag: string) => {
    const existing = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (existing.includes(tag)) {
      setTags(existing.filter((t) => t !== tag).join(', '));
    } else {
      setTags([...existing, tag].join(', '));
    }
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

  const tagList = (transaction.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

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
              style={{ backgroundColor: theme.cardSecondary }}
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
                    backgroundColor: theme.cardSecondary,
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
                      color: transaction.type === 'income'
                        ? isDark ? '#34D399' : '#10B981'
                        : theme.textPrimary,
                    }}
                    className="text-3xl font-extrabold mt-3 tracking-tight"
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount, { forceVisible: true })}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-2">
                    <View
                      style={{
                        backgroundColor: transaction.type === 'income'
                          ? isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5'
                          : isDark ? 'rgba(244, 63, 94, 0.2)' : '#FFF1F2',
                      }}
                      className="px-2.5 py-1 rounded-full"
                    >
                      <Text
                        style={{
                          color: transaction.type === 'income'
                            ? isDark ? '#34D399' : '#059669'
                            : isDark ? '#FB7185' : '#E11D48',
                        }}
                        className="text-xs font-semibold uppercase"
                      >
                        {transaction.type}
                      </Text>
                    </View>
                    {transaction.recurring_rule_id && (
                      <View
                        style={{ backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#EEF2FF' }}
                        className="px-2.5 py-1 rounded-full"
                      >
                        <Text
                          style={{ color: isDark ? '#A78BFA' : '#7C3AED' }}
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
                  className="rounded-2xl divide-y mb-4"
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
                  {transaction.event_name ? (
                    <View
                      style={{ borderBottomColor: theme.border }}
                      className="p-4 flex-row justify-between items-center border-b"
                    >
                      <Text style={{ color: theme.textSecondary }} className="font-medium text-sm">
                        Event / Trip
                      </Text>
                      <View className="flex-row items-center">
                        <MaterialIcons
                          name={(transaction.event_icon as any) || 'flight'}
                          size={15}
                          color={transaction.event_color || theme.primary}
                        />
                        <Text
                          style={{ color: transaction.event_color || theme.primary }}
                          className="font-bold text-sm ml-1.5"
                        >
                          {transaction.event_name}
                        </Text>
                      </View>
                    </View>
                  ) : null}
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
                    <View
                      style={{ borderBottomColor: theme.border }}
                      className="p-4 border-b"
                    >
                      <Text style={{ color: theme.textSecondary }} className="font-medium text-sm mb-1">
                        Notes
                      </Text>
                      <Text style={{ color: theme.textPrimary }} className="font-medium text-sm leading-5">
                        {transaction.description}
                      </Text>
                    </View>
                  ) : null}

                  {tagList.length > 0 && (
                    <View className="p-4">
                      <Text style={{ color: theme.textSecondary }} className="font-medium text-sm mb-1.5">
                        Tags
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {tagList.map((tag, idx) => (
                          <View
                            key={idx}
                            style={{ backgroundColor: theme.cardSecondary, borderColor: theme.border, borderWidth: 1 }}
                            className="px-2.5 py-1 rounded-lg"
                          >
                            <Text style={{ color: theme.primary }} className="text-xs font-semibold">
                              #{tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3 mt-2 mb-6">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsEditing(true);
                    }}
                    style={{ backgroundColor: theme.primary }}
                    className="flex-1 rounded-2xl py-4 flex-row items-center justify-center shadow-sm"
                  >
                    <MaterialIcons name="edit" size={18} color="white" />
                    <Text className="text-white font-semibold text-base ml-2">Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleDelete}
                    style={{
                      backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#FFF1F2',
                      borderColor: isDark ? 'rgba(244, 63, 94, 0.3)' : '#FFE4E6',
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
                  style={{ backgroundColor: theme.cardSecondary }}
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
                          backgroundColor: categoryId === cat.id
                            ? isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF'
                            : theme.cardSecondary,
                          borderColor: categoryId === cat.id ? theme.primary : theme.border,
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
                            color: categoryId === cat.id ? theme.primary : theme.textPrimary,
                          }}
                          className="ml-2 text-xs font-semibold"
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Event / Trip Selector */}
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs font-bold uppercase tracking-wider mb-2"
                >
                  Event / Trip (e.g. Vacation)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setEventId(null)}
                      style={{
                        backgroundColor: eventId === null
                          ? isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF'
                          : theme.cardSecondary,
                        borderColor: eventId === null ? theme.primary : theme.border,
                        borderWidth: 1,
                      }}
                      className="px-3.5 py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text
                        style={{ color: eventId === null ? theme.primary : theme.textPrimary }}
                        className="text-xs font-semibold"
                      >
                        None (Regular)
                      </Text>
                    </TouchableOpacity>

                    {events.map((ev) => (
                      <TouchableOpacity
                        key={ev.id}
                        onPress={() => setEventId(ev.id)}
                        style={{
                          backgroundColor: eventId === ev.id
                            ? ev.color || theme.primary
                            : theme.cardSecondary,
                          borderColor: eventId === ev.id ? ev.color || theme.primary : theme.border,
                          borderWidth: 1,
                        }}
                        className="flex-row items-center px-3.5 py-2.5 rounded-xl"
                      >
                        <MaterialIcons
                          name={(ev.icon as any) || 'flight'}
                          size={14}
                          color={eventId === ev.id ? '#FFFFFF' : ev.color || theme.primary}
                        />
                        <Text
                          style={{
                            color: eventId === ev.id ? '#FFFFFF' : theme.textPrimary,
                          }}
                          className="ml-1.5 text-xs font-semibold"
                        >
                          {ev.name}
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
                  className="rounded-2xl p-4 mb-4"
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

                {/* Tags Input & Common Chips */}
                <View
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border,
                    borderWidth: 1,
                  }}
                  className="rounded-2xl p-4 mb-6"
                >
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                    Tags (comma separated)
                  </Text>
                  <TextInput
                    style={{ color: theme.textPrimary }}
                    className="text-sm font-medium mb-2"
                    value={tags}
                    onChangeText={setTags}
                    placeholder="e.g. vacation, tax, work"
                    placeholderTextColor={theme.textMuted}
                  />

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-1.5">
                      {COMMON_TAGS.map((ct) => {
                        const active = tags.includes(ct);
                        return (
                          <TouchableOpacity
                            key={ct}
                            onPress={() => handleToggleTag(ct)}
                            style={{
                              backgroundColor: active
                                ? isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF'
                                : theme.cardSecondary,
                              borderColor: active ? theme.primary : theme.border,
                              borderWidth: 1,
                            }}
                            className="px-2.5 py-1 rounded-lg"
                          >
                            <Text
                              style={{
                                color: active ? theme.primary : theme.textSecondary,
                              }}
                              className="text-[11px] font-medium"
                            >
                              #{ct}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* Buttons */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setIsEditing(false)}
                    style={{ backgroundColor: theme.cardSecondary }}
                    className="flex-1 rounded-2xl py-4 items-center"
                  >
                    <Text style={{ color: theme.textPrimary }} className="font-semibold text-base">
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    style={{ backgroundColor: theme.primary }}
                    className="flex-1 rounded-2xl py-4 items-center shadow-md"
                  >
                    <Text className="text-white font-bold text-base">Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CustomDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText || 'OK'}
        cancelText={dialogState.cancelText || 'Cancel'}
        onConfirm={() => {
          setDialogState((prev) => ({ ...prev, visible: false }));
          dialogState.onConfirm?.();
        }}
        onCancel={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
};
