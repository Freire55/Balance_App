export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
};

export const Platform = {
  OS: 'ios',
  select: (obj: any) => obj.ios ?? obj.default,
};

export const LogBox = {
  ignoreLogs: () => {},
};

export default {
  AppState,
  Platform,
  LogBox,
};
