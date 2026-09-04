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

export const TransactionItem: React.FC<TransactionItemProps> = React.memo(({
  transaction,
  onPress,
  onLongPress,
  showDate = true,
}) => {
  const { formatCurrency, theme, isDark } = useApp();

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

  const tagList = React.useMemo(() => {
    if (!transaction.tags) return [];
    return transaction.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }, [transaction.tags]);

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
        shadowOpacity: isDark ? 0.2 : 0.05,
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
          <View className="flex-row items-center flex-wrap mt-0.5">
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-medium mr-1"
              numberOfLines={1}
            >
              {transaction.category_name || 'Uncategorized'}
            </Text>
            {showDate && (
              <>
                <Text style={{ color: theme.textMuted }} className="text-xs mr-1">•</Text>
                <Text style={{ color: theme.textMuted }} className="text-xs mr-1">{formattedDate}</Text>
              </>
            )}
            {transaction.recurring_rule_id ? (
              <>
                <Text style={{ color: theme.textMuted }} className="text-xs mr-1">•</Text>
                <Text
                  style={{
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF',
                    color: isDark ? '#A78BFA' : '#7C3AED',
                  }}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1"
                >
                  Recurring
                </Text>
              </>
            ) : null}
            {transaction.event_name ? (
              <>
                <Text style={{ color: theme.textMuted }} className="text-xs mr-1">•</Text>
                <Text
                  style={{
                    backgroundColor: isDark ? 'rgba(244, 63, 94, 0.2)' : '#FFF1F2',
                    color: transaction.event_color || '#F43F5E',
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 mt-0.5"
                >
                  ✈️ {transaction.event_name}
                </Text>
              </>
            ) : null}
            {tagList.map((tag, idx) => (
              <Text
                key={idx}
                style={{
                  backgroundColor: theme.cardSecondary,
                  color: theme.textMuted,
                }}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded mr-1 mt-0.5"
              >
                #{tag}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View className="items-end">
        <Text
          style={{
            color: isIncome
              ? isDark ? '#34D399' : '#10B981'
              : theme.textPrimary,
          }}
          className="text-base font-bold tracking-tight"
        >
          {isIncome ? '+' : '-'}
          {formatCurrency(transaction.amount)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

TransactionItem.displayName = 'TransactionItem';
