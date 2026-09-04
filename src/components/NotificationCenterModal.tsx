import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import {
  clearAllNotifications,
  getAppNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../database/database';
import { AppNotification } from '../database/types';
import { RootNavigationProp } from '../navigation/types';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onUnreadChange?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
  onUnreadChange,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigationProp>();
  const { theme, isDark } = useApp();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const data = await getAppNotifications(50);
      setNotifications(data);
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const handleNotificationPress = async (item: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!item.is_read) {
      await markNotificationAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n))
      );
      onUnreadChange?.();
    }

    onClose();

    // Navigate to relevant section
    if (item.type === 'month_end' || item.type === 'year_end' || item.type === 'budget') {
      navigation.navigate('MainTabs', { screen: 'Stats' });
    } else if (item.type === 'recurring') {
      navigation.navigate('Recurring');
    }
  };

  const handleMarkAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    onUnreadChange?.();
  };

  const handleClearAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await clearAllNotifications();
    setNotifications([]);
    onUnreadChange?.();
  };

  const getIconForType = (type: AppNotification['type']) => {
    switch (type) {
      case 'recurring':
        return { name: 'repeat', color: '#8B5CF6', bg: isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF' };
      case 'month_end':
        return { name: 'pie-chart', color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' };
      case 'year_end':
        return { name: 'insights', color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFFBEB' };
      case 'budget':
        return { name: 'warning', color: '#F43F5E', bg: isDark ? 'rgba(244, 63, 94, 0.2)' : '#FFF1F2' };
      default:
        return { name: 'notifications', color: '#6366F1', bg: isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF' };
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderTopWidth: 1,
            maxHeight: '85%',
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
                <MaterialIcons name="notifications" size={22} color={theme.primary} />
              </View>
              <View>
                <Text style={{ color: theme.textPrimary }} className="text-lg font-bold">
                  Notifications
                </Text>
                <Text style={{ color: theme.textSecondary }} className="text-xs font-medium">
                  {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: theme.cardSecondary }}
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <MaterialIcons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Action Bar */}
          {notifications.length > 0 && (
            <View
              style={{ borderBottomColor: theme.border }}
              className="px-5 py-2.5 flex-row justify-between items-center border-b"
            >
              {unreadCount > 0 ? (
                <TouchableOpacity onPress={handleMarkAllRead} className="py-1">
                  <Text style={{ color: theme.primary }} className="text-xs font-bold">
                    Mark all as read
                  </Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              <TouchableOpacity onPress={handleClearAll} className="py-1">
                <Text style={{ color: theme.textMuted }} className="text-xs font-semibold">
                  Clear all
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List Content */}
          {loading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View className="py-20 px-6 items-center justify-center">
              <View
                style={{ backgroundColor: theme.cardSecondary }}
                className="w-16 h-16 rounded-3xl items-center justify-center mb-3"
              >
                <MaterialIcons name="notifications-none" size={32} color={theme.textMuted} />
              </View>
              <Text style={{ color: theme.textPrimary }} className="text-base font-bold text-center mb-1">
                No Notifications
              </Text>
              <Text style={{ color: theme.textSecondary }} className="text-xs text-center max-w-xs leading-5">
                Recurring bill reminders, end-of-month balance reports, and budget warnings will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
              renderItem={({ item }) => {
                const icon = getIconForType(item.type);
                const isUnread = !item.is_read;

                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => handleNotificationPress(item)}
                    style={{
                      backgroundColor: isUnread
                        ? isDark ? 'rgba(99, 102, 241, 0.12)' : '#F5F7FF'
                        : theme.card,
                      borderColor: isUnread ? theme.primary : theme.border,
                      borderWidth: 1,
                    }}
                    className="p-3.5 rounded-2xl mb-2.5 flex-row items-start shadow-sm"
                  >
                    <View
                      style={{ backgroundColor: icon.bg }}
                      className="w-10 h-10 rounded-xl items-center justify-center mr-3 mt-0.5"
                    >
                      <MaterialIcons name={icon.name as any} size={20} color={icon.color} />
                    </View>

                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center justify-between mb-0.5">
                        <Text
                          style={{
                            color: theme.textPrimary,
                            fontWeight: isUnread ? '700' : '600',
                          }}
                          className="text-sm flex-1 mr-2"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={{ color: theme.textMuted }} className="text-[10px]">
                          {formatDate(item.created_at)}
                        </Text>
                      </View>

                      <Text
                        style={{ color: theme.textSecondary }}
                        className="text-xs leading-4"
                        numberOfLines={2}
                      >
                        {item.body}
                      </Text>
                    </View>

                    {isUnread && (
                      <View
                        style={{ backgroundColor: theme.primary }}
                        className="w-2.5 h-2.5 rounded-full mt-1.5"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};
