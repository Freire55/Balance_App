import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { RootNavigationProp } from '../navigation/types';

export default function NavBar({ state, navigation }: BottomTabBarProps) {
  const rootNavigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useApp();

  const currentRouteName = state.routes[state.index]?.name;

  const tabs = [
    {
      name: 'Home',
      label: 'Home',
      icon: 'grid-view' as const,
    },
    {
      name: 'History',
      label: 'History',
      icon: 'receipt-long' as const,
    },
    {
      name: 'Stats',
      label: 'Stats',
      icon: 'insights' as const,
    },
    {
      name: 'Settings',
      label: 'Settings',
      icon: 'tune' as const,
    },
  ];

  const handleTabPress = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(name);
  };

  const handleQuickAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rootNavigation.navigate('NewTransaction');
  };

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        paddingBottom: Math.max(insets?.bottom ?? 0, 12),
      }}
      className="shadow-lg"
    >
      <View className="flex-row items-center justify-around h-16 px-2">
        {/* Tab 1: Home */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress(tabs[0].name)}
          className="items-center justify-center flex-1 py-1"
        >
          <View
            style={{
              backgroundColor: currentRouteName === 'Home' ? '#EEF2FF' : 'transparent',
            }}
            className="w-10 h-7 rounded-full items-center justify-center"
          >
            <MaterialIcons
              name={tabs[0].icon}
              size={22}
              color={currentRouteName === 'Home' ? '#6366F1' : theme.textMuted}
            />
          </View>
          <Text
            style={{
              color: currentRouteName === 'Home' ? '#6366F1' : theme.textSecondary,
            }}
            className="text-[11px] font-semibold mt-0.5"
          >
            {tabs[0].label}
          </Text>
        </TouchableOpacity>

        {/* Tab 2: History */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress(tabs[1].name)}
          className="items-center justify-center flex-1 py-1"
        >
          <View
            style={{
              backgroundColor: currentRouteName === 'History' ? '#EEF2FF' : 'transparent',
            }}
            className="w-10 h-7 rounded-full items-center justify-center"
          >
            <MaterialIcons
              name={tabs[1].icon}
              size={22}
              color={currentRouteName === 'History' ? '#6366F1' : theme.textMuted}
            />
          </View>
          <Text
            style={{
              color: currentRouteName === 'History' ? '#6366F1' : theme.textSecondary,
            }}
            className="text-[11px] font-semibold mt-0.5"
          >
            {tabs[1].label}
          </Text>
        </TouchableOpacity>

        {/* Central Floating Quick-Add Button */}
        <View className="items-center justify-center -mt-6 px-1">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleQuickAddPress}
            style={{
              backgroundColor: '#6366F1',
              borderColor: theme.card,
              borderWidth: 4,
              shadowColor: '#6366F1',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 10,
            }}
            className="w-14 h-14 rounded-full items-center justify-center"
          >
            <MaterialIcons name="add" size={30} color="white" />
          </TouchableOpacity>
        </View>

        {/* Tab 3: Stats */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress(tabs[2].name)}
          className="items-center justify-center flex-1 py-1"
        >
          <View
            style={{
              backgroundColor: currentRouteName === 'Stats' ? '#EEF2FF' : 'transparent',
            }}
            className="w-10 h-7 rounded-full items-center justify-center"
          >
            <MaterialIcons
              name={tabs[2].icon}
              size={22}
              color={currentRouteName === 'Stats' ? '#6366F1' : theme.textMuted}
            />
          </View>
          <Text
            style={{
              color: currentRouteName === 'Stats' ? '#6366F1' : theme.textSecondary,
            }}
            className="text-[11px] font-semibold mt-0.5"
          >
            {tabs[2].label}
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Settings */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress(tabs[3].name)}
          className="items-center justify-center flex-1 py-1"
        >
          <View
            style={{
              backgroundColor: currentRouteName === 'Settings' ? '#EEF2FF' : 'transparent',
            }}
            className="w-10 h-7 rounded-full items-center justify-center"
          >
            <MaterialIcons
              name={tabs[3].icon}
              size={22}
              color={currentRouteName === 'Settings' ? '#6366F1' : theme.textMuted}
            />
          </View>
          <Text
            style={{
              color: currentRouteName === 'Settings' ? '#6366F1' : theme.textSecondary,
            }}
            className="text-[11px] font-semibold mt-0.5"
          >
            {tabs[3].label}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
