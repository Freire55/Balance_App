export async function scheduleNotificationAsync(request?: any) {
  return 'notif-1';
}

export async function setNotificationChannelAsync(channelId: string, channel: any) {}

export async function requestPermissionsAsync() {
  return { status: 'granted' };
}

export async function getPermissionsAsync() {
  return { status: 'granted' };
}

export const AndroidImportance = {
  HIGH: 4,
  DEFAULT: 3,
};
