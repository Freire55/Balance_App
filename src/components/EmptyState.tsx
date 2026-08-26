import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

interface EmptyStateProps {
  icon?: any;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'receipt-long',
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}) => {
  const { theme } = useApp();

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
      }}
      className="rounded-3xl p-8 items-center shadow-sm my-4"
    >
      <View
        style={{
          backgroundColor: '#EEF2FF',
        }}
        className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
      >
        <MaterialIcons name={icon} size={32} color="#4F46E5" />
      </View>
      <Text
        style={{ color: theme.textPrimary }}
        className="font-bold text-lg text-center mb-1"
      >
        {title}
      </Text>
      <Text
        style={{ color: theme.textSecondary }}
        className="text-sm text-center max-w-xs leading-5 mb-6"
      >
        {description}
      </Text>

      {actionText && onAction && (
        <TouchableOpacity
          onPress={onAction}
          className="bg-indigo-600 px-6 py-3 rounded-xl flex-row items-center justify-center shadow-sm w-full max-w-xs"
        >
          <MaterialIcons name="add" size={20} color="white" />
          <Text className="text-white font-semibold text-sm ml-1.5">{actionText}</Text>
        </TouchableOpacity>
      )}

      {secondaryActionText && onSecondaryAction && (
        <TouchableOpacity
          onPress={onSecondaryAction}
          className="mt-3 py-2 px-4 rounded-xl items-center justify-center"
        >
          <Text
            style={{ color: '#4F46E5' }}
            className="font-semibold text-sm"
          >
            {secondaryActionText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
