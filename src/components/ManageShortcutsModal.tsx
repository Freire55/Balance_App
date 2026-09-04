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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import {
  addQuickShortcut,
  deleteQuickShortcut,
  getCategories,
  getQuickShortcuts,
  updateQuickShortcut,
} from '../database/database';
import { Category, QuickShortcut, TransactionType } from '../database/types';
import { CategoryIcon } from './CategoryIcon';
import { CustomDialog } from './CustomDialog';

interface ManageShortcutsModalProps {
  visible: boolean;
  onClose: () => void;
  onShortcutsUpdated: () => void;
}

const SHORTCUT_ICONS = [
  'local-cafe',
  'restaurant',
  'local-grocery-store',
  'directions-car',
  'local-gas-station',
  'shopping-bag',
  'fitness-center',
  'medical-services',
  'movie',
  'flight',
  'computer',
  'home',
  'bolt',
  'card-giftcard',
  'savings',
  'attach-money',
];

export const ManageShortcutsModal: React.FC<ManageShortcutsModalProps> = ({
  visible,
  onClose,
  onShortcutsUpdated,
}) => {
  const insets = useSafeAreaInsets();
  const { formatCurrency, settings, theme, isDark, triggerRefresh } = useApp();

  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingOrEditing, setIsAddingOrEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedIcon, setSelectedIcon] = useState('local-cafe');
  const [type, setType] = useState<TransactionType>('expense');

  // Custom confirmation dialog
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert' | 'danger';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const loadData = React.useCallback(async () => {
    try {
      const [scList, catList] = await Promise.all([
        getQuickShortcuts(),
        getCategories(),
      ]);
      setShortcuts(scList);
      setCategories(catList);
      if (catList.length > 0) {
        setSelectedCategoryId((prev) => prev ?? catList[0].id);
      }
    } catch (e) {
      console.error('Error loading shortcuts in modal:', e);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setIsAddingOrEditing(false);
      setEditingId(null);
      loadData();
    }
  }, [visible, loadData]);

  const handleStartAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(null);
    setTitle('');
    setAmount('');
    setSelectedIcon('local-cafe');
    setType('expense');
    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
    setIsAddingOrEditing(true);
  };

  const handleStartEdit = (sc: QuickShortcut) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingId(sc.id);
    setTitle(sc.title);
    setAmount(sc.amount.toString());
    setSelectedCategoryId(sc.category_id);
    setSelectedIcon(sc.icon || 'local-cafe');
    setType(sc.type);
    setIsAddingOrEditing(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setDialogState({
        visible: true,
        title: 'Title Required',
        message: 'Please enter a name for your quick shortcut.',
        type: 'alert',
      });
      return;
    }

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setDialogState({
        visible: true,
        title: 'Invalid Amount',
        message: 'Please enter a valid positive number for the amount.',
        type: 'alert',
      });
      return;
    }

    if (!selectedCategoryId) {
      setDialogState({
        visible: true,
        title: 'Category Missing',
        message: 'Please select a category.',
        type: 'alert',
      });
      return;
    }

    try {
      if (editingId) {
        await updateQuickShortcut(editingId, title.trim(), selectedIcon, parsedAmount, selectedCategoryId, type);
      } else {
        await addQuickShortcut(title.trim(), selectedIcon, parsedAmount, selectedCategoryId, type);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsAddingOrEditing(false);
      setEditingId(null);
      await loadData();
      triggerRefresh();
      onShortcutsUpdated();
    } catch (e) {
      console.error('Error saving shortcut:', e);
    }
  };

  const handleDelete = (sc: QuickShortcut) => {
    setDialogState({
      visible: true,
      title: 'Delete Shortcut',
      message: `Are you sure you want to remove "${sc.title}"?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteQuickShortcut(sc.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await loadData();
          triggerRefresh();
          onShortcutsUpdated();
        } catch (e) {
          console.error('Error deleting shortcut:', e);
        }
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/70"
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderTopWidth: 1,
            maxHeight: '90%',
            paddingBottom: Math.max(insets?.bottom ?? 0, 16),
          }}
          className="rounded-t-[36px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <View
            style={{ borderBottomColor: theme.border }}
            className="p-5 flex-row items-center justify-between border-b"
          >
            <View className="flex-row items-center">
              <View
                style={{ backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' }}
                className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
              >
                <MaterialIcons name="flash-on" size={22} color={theme.primary} />
              </View>
              <View>
                <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                  {isAddingOrEditing ? (editingId ? 'Edit Shortcut' : 'New Quick-Add') : 'Customize Quick-Add'}
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs">
                  {isAddingOrEditing ? 'Set title, icon & amount' : 'One-tap expense shortcuts on Home'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (isAddingOrEditing) {
                  setIsAddingOrEditing(false);
                } else {
                  onClose();
                }
              }}
              style={{ backgroundColor: theme.cardSecondary }}
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <MaterialIcons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="p-5">
            {!isAddingOrEditing ? (
              // LIST OF SHORTCUTS
              <View>
                <View className="flex-row justify-between items-center mb-3">
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
                    Active Shortcuts ({shortcuts.length})
                  </Text>
                  <TouchableOpacity
                    onPress={handleStartAdd}
                    style={{ backgroundColor: theme.primary }}
                    className="px-3 py-1.5 rounded-xl flex-row items-center"
                  >
                    <MaterialIcons name="add" size={16} color="white" />
                    <Text className="text-white font-bold text-xs ml-1">New Shortcut</Text>
                  </TouchableOpacity>
                </View>

                {shortcuts.length === 0 ? (
                  <View
                    style={{ backgroundColor: theme.cardSecondary }}
                    className="p-8 rounded-3xl items-center my-3"
                  >
                    <MaterialIcons name="touch-app" size={36} color={theme.textMuted} />
                    <Text style={{ color: theme.textPrimary }} className="font-bold text-sm mt-2">
                      No Quick Shortcuts
                    </Text>
                    <Text style={{ color: theme.textSecondary }} className="text-xs text-center mt-1 mb-4">
                      Create 1-tap buttons for your everyday coffees, transit fares, and lunch orders.
                    </Text>
                    <TouchableOpacity
                      onPress={handleStartAdd}
                      style={{ backgroundColor: theme.primary }}
                      className="px-4 py-2.5 rounded-xl"
                    >
                      <Text className="text-white font-bold text-xs">Create Shortcut</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  shortcuts.map((sc) => (
                    <View
                      key={sc.id}
                      style={{
                        backgroundColor: theme.cardSecondary,
                        borderColor: theme.border,
                        borderWidth: 1,
                      }}
                      className="p-3.5 rounded-2xl mb-2.5 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <View
                          style={{
                            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#FFFFFF',
                          }}
                          className="w-10 h-10 rounded-xl items-center justify-center mr-3 shadow-xs"
                        >
                          <MaterialIcons name={sc.icon as any} size={20} color={theme.primary} />
                        </View>
                        <View className="flex-1">
                          <Text
                            style={{ color: theme.textPrimary }}
                            className="font-bold text-sm"
                            numberOfLines={1}
                          >
                            {sc.title}
                          </Text>
                          <Text style={{ color: theme.textSecondary }} className="text-xs">
                            {sc.category_name || 'Uncategorized'} • {formatCurrency(sc.amount)}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          onPress={() => handleStartEdit(sc)}
                          style={{ backgroundColor: theme.card }}
                          className="w-8 h-8 rounded-lg items-center justify-center shadow-xs"
                        >
                          <MaterialIcons name="edit" size={15} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(sc)}
                          style={{ backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#FFF1F2' }}
                          className="w-8 h-8 rounded-lg items-center justify-center shadow-xs"
                        >
                          <MaterialIcons name="delete-outline" size={15} color="#F43F5E" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : (
              // ADD / EDIT FORM
              <View className="pb-6">
                {/* Title */}
                <View
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }}
                  className="rounded-2xl p-3.5 mb-3"
                >
                  <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                    Shortcut Title
                  </Text>
                  <TextInput
                    style={{ color: theme.textPrimary }}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Morning Coffee, Metro Fare, Protein Shake"
                    placeholderTextColor={theme.textMuted}
                    className="font-semibold text-sm"
                  />
                </View>

                {/* Amount */}
                <View
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.border, borderWidth: 1 }}
                  className="rounded-2xl p-3.5 mb-3 flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text style={{ color: theme.textSecondary }} className="text-xs font-semibold mb-1">
                      Fixed Amount ({settings.currencySymbol})
                    </Text>
                    <TextInput
                      style={{ color: theme.textPrimary }}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={theme.textMuted}
                      className="font-extrabold text-xl"
                    />
                  </View>
                </View>

                {/* Category Picker */}
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
                  Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <View className="flex-row gap-2">
                    {categories.map((c) => {
                      const isSelected = selectedCategoryId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => setSelectedCategoryId(c.id)}
                          style={{
                            backgroundColor: isSelected
                              ? isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF'
                              : theme.cardSecondary,
                            borderColor: isSelected ? theme.primary : theme.border,
                            borderWidth: 1,
                          }}
                          className="flex-row items-center px-3 py-2 rounded-xl"
                        >
                          <CategoryIcon icon={c.icon} color={c.color} size={15} containerSize={26} />
                          <Text
                            style={{ color: isSelected ? theme.primary : theme.textPrimary }}
                            className="text-xs font-semibold ml-2"
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Icon Picker */}
                <Text style={{ color: theme.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">
                  Select Icon
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                  <View className="flex-row gap-2">
                    {SHORTCUT_ICONS.map((iconName) => {
                      const isSelected = selectedIcon === iconName;
                      return (
                        <TouchableOpacity
                          key={iconName}
                          onPress={() => setSelectedIcon(iconName)}
                          style={{
                            backgroundColor: isSelected
                              ? isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF'
                              : theme.cardSecondary,
                            borderColor: isSelected ? theme.primary : theme.border,
                            borderWidth: 1,
                          }}
                          className="w-11 h-11 rounded-xl items-center justify-center"
                        >
                          <MaterialIcons
                            name={iconName as any}
                            size={20}
                            color={isSelected ? theme.primary : theme.textSecondary}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Buttons */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setIsAddingOrEditing(false)}
                    style={{ backgroundColor: theme.cardSecondary }}
                    className="flex-1 py-4 rounded-2xl items-center"
                  >
                    <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    style={{ backgroundColor: theme.primary }}
                    className="flex-1 py-4 rounded-2xl items-center shadow-md"
                  >
                    <Text className="text-white font-bold text-sm">
                      {editingId ? 'Save Changes' : 'Create Shortcut'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Reusable Custom Confirmation/Alert Modal */}
      <CustomDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.type === 'danger' ? 'Delete' : 'OK'}
        onConfirm={() => {
          setDialogState((prev) => ({ ...prev, visible: false }));
          dialogState.onConfirm?.();
        }}
        onCancel={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
};
