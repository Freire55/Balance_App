import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, NavigatorScreenParams, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Stats: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  NewTransaction: { initialMode?: 'normal' | 'recurring' } | undefined;
  Recurring: undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type NewTransactionRouteProp = RouteProp<RootStackParamList, 'NewTransaction'>;

export type TabScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
