import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

interface CategoryIconProps {
  icon?: string;
  color?: string;
  size?: number;
  containerSize?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon = 'category',
  color = '#3B82F6',
  size = 20,
  containerSize = 44,
}) => {
  const safeColor = color || '#3B82F6';
  const safeIcon = icon || 'category';

  // Map common icon strings safely to MaterialIcons
  const validIconName = (name: string): any => {
    const validIcons = [
      'restaurant', 'local-grocery-store', 'home', 'directions-car', 'bolt',
      'shopping-bag', 'fitness-center', 'movie', 'subscriptions', 'flight',
      'spa', 'school', 'more-horiz', 'work', 'computer', 'trending-up',
      'card-giftcard', 'receipt-long', 'account-balance-wallet', 'category',
      'attach-money', 'local-cafe', 'local-bar', 'directions-bus', 'local-hospital',
      'medical-services', 'sports-esports', 'child-care', 'pets', 'checkroom',
      'build', 'phone-iphone', 'savings'
    ];
    return validIcons.includes(name) ? name : 'category';
  };

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2.8,
        backgroundColor: safeColor.startsWith('#') && safeColor.length === 7 ? `${safeColor}20` : 'rgba(99, 102, 241, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <MaterialIcons
        name={validIconName(safeIcon)}
        size={size}
        color={safeColor}
      />
    </View>
  );
};
