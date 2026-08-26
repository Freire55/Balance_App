import * as Haptics from 'expo-haptics';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { Transaction } from '../database/types';
import { CategoryIcon } from './CategoryIcon';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (tx: Transaction) => void;
  onLongPress?: (tx: Transaction) => void;
  showDate?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onPress,
  onLongPress,
  showDate = true,
}) => {
  const { formatCurrency, theme } = useApp();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(transaction);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.(transaction);
  };

  const isIncome = transaction.type === 'income';

  const formattedDate = React.useMemo(() => {
    if (!transaction.created_at) return '';
    const date = new Date(transaction.created_at);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return 'Today';
    const isThisYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: isThisYear ? undefined : 'numeric',
    });
  }, [transaction.created_at]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={{
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}
      className="rounded-2xl p-4 mb-2.5 flex-row items-center justify-between"
    >
      <View className="flex-row items-center flex-1 mr-3">
        <CategoryIcon
          icon={transaction.category_icon}
          color={transaction.category_color || (isIncome ? '#10B981' : '#3B82F6')}
          size={22}
          containerSize={46}
        />
        <View className="ml-3.5 flex-1">
          <Text
            style={{ color: theme.textPrimary }}
            className="font-semibold text-base"
            numberOfLines={1}
          >
            {transaction.description || transaction.category_name || 'Transaction'}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-medium"
              numberOfLines={1}
            >
              {transaction.category_name || 'Uncategorized'}
            </Text>
            {showDate && (
              <>
                <Text style={{ color: theme.textMuted }} className="text-xs mx-1.5">•</Text>
                <Text style={{ color: theme.textMuted }} className="text-xs">{formattedDate}</Text>
              </>
            )}
            {transaction.recurring_rule_id && (
              <>
                <Text style={{ color: theme.textMuted }} className="text-xs mx-1.5">•</Text>
                <Text
                  style={{
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                  }}
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                >
                  Recurring
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View className="items-end">
        <Text
          style={{
            color: isIncome ? '#10B981' : theme.textPrimary,
          }}
          className="text-base font-bold tracking-tight"
        >
          {isIncome ? '+' : '-'}
          {formatCurrency(transaction.amount)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
