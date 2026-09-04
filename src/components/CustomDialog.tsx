import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

export interface CustomDialogProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'confirm' | 'alert' | 'danger' | 'success' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({
  visible,
  title,
  message,
  type = 'alert',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  const { theme, isDark } = useApp();

  if (!visible) return null;

  const isConfirmType = type === 'confirm' || type === 'danger';
  const isDanger = type === 'danger';

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return {
          name: 'delete-outline' as const,
          color: '#F43F5E',
          bg: isDark ? 'rgba(244, 63, 94, 0.2)' : '#FFF1F2',
        };
      case 'success':
        return {
          name: 'check-circle' as const,
          color: '#10B981',
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
        };
      case 'confirm':
        return {
          name: 'help-outline' as const,
          color: theme.primary,
          bg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF',
        };
      default:
        return {
          name: 'info-outline' as const,
          color: theme.primary,
          bg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF',
        };
    }
  };

  const icon = getIcon();

  const handleConfirm = () => {
    Haptics.impactAsync(isDanger ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    onConfirm?.();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View className="flex-1 bg-black/60 items-center justify-center p-6">
        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
          }}
          className="w-full max-w-sm rounded-[32px] p-6 items-center shadow-2xl"
        >
          {/* Icon */}
          <View
            style={{ backgroundColor: icon.bg }}
            className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
          >
            <MaterialIcons name={icon.name} size={32} color={icon.color} />
          </View>

          {/* Title */}
          <Text
            style={{ color: theme.textPrimary }}
            className="text-lg font-bold text-center mb-2"
          >
            {title}
          </Text>

          {/* Message */}
          <Text
            style={{ color: theme.textSecondary }}
            className="text-sm text-center leading-5 mb-6"
          >
            {message}
          </Text>

          {/* Action Buttons */}
          <View className="flex-row w-full gap-3">
            {isConfirmType && (
              <TouchableOpacity
                onPress={handleCancel}
                style={{ backgroundColor: theme.cardSecondary }}
                className="flex-1 py-3.5 rounded-2xl items-center justify-center"
              >
                <Text style={{ color: theme.textPrimary }} className="font-semibold text-sm">
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleConfirm}
              style={{
                backgroundColor: isDanger ? '#F43F5E' : theme.primary,
              }}
              className="flex-1 py-3.5 rounded-2xl items-center justify-center shadow-md"
            >
              <Text className="text-white font-bold text-sm">
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
