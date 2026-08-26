import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

interface MetricCardProps {
  title: string;
  amount: number;
  type?: 'income' | 'expense' | 'neutral' | 'balance';
  iconName?: any;
  subtext?: string;
  trend?: string;
  trendPositive?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  amount,
  type = 'neutral',
  iconName,
  subtext,
  trend,
  trendPositive,
}) => {
  const { formatCurrency, theme } = useApp();

  const getColors = () => {
    switch (type) {
      case 'income':
        return {
          iconBg: '#ECFDF5',
          iconColor: '#059669',
          textColor: '#059669',
        };
      case 'expense':
        return {
          iconBg: '#FFF1F2',
          iconColor: '#E11D48',
          textColor: '#E11D48',
        };
      case 'balance':
        return {
          iconBg: '#EEF2FF',
          iconColor: '#4F46E5',
          textColor: theme.textPrimary,
        };
      default:
        return {
          iconBg: '#F1F5F9',
          iconColor: theme.textSecondary,
          textColor: theme.textPrimary,
        };
    }
  };

  const colors = getColors();

  return (
    <View
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
      className="p-4 rounded-2xl flex-1"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text
          style={{ color: theme.textSecondary }}
          className="text-xs font-semibold uppercase tracking-wider"
        >
          {title}
        </Text>
        {iconName && (
          <View
            style={{ backgroundColor: colors.iconBg }}
            className="w-7 h-7 rounded-lg items-center justify-center"
          >
            <MaterialIcons name={iconName} size={16} color={colors.iconColor} />
          </View>
        )}
      </View>

      <Text
        style={{
          color: type === 'income' ? colors.textColor : type === 'expense' ? colors.textColor : theme.textPrimary,
        }}
        className="text-xl font-bold tracking-tight mb-0.5"
        numberOfLines={1}
      >
        {type === 'income' ? '+' : type === 'expense' ? '-' : ''}
        {formatCurrency(amount || 0)}
      </Text>

      {subtext ? (
        <Text
          style={{ color: theme.textMuted }}
          className="text-xs font-medium"
          numberOfLines={1}
        >
          {subtext}
        </Text>
      ) : null}

      {trend ? (
        <View className="flex-row items-center mt-1">
          <MaterialIcons
            name={trendPositive ? 'trending-up' : 'trending-down'}
            size={14}
            color={trendPositive ? '#10B981' : '#F43F5E'}
          />
          <Text
            style={{
              color: trendPositive ? '#10B981' : '#F43F5E',
            }}
            className="text-xs font-semibold ml-1"
          >
            {trend}
          </Text>
        </View>
      ) : null}
    </View>
  );
};
