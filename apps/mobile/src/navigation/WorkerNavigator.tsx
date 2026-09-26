import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HistoryScreen } from '../screens/worker/HistoryScreen';
import { HomeScreen } from '../screens/worker/HomeScreen';
import { TabBar } from '../ui/TabBar';
import type { WorkerTabParamList } from './types';

const Tab = createBottomTabNavigator<WorkerTabParamList>();

const ITEMS = {
  Home: { icon: 'home', labelKey: 'tabs.home' },
  History: { icon: 'calendar', labelKey: 'tabs.history' },
} as const;

export function WorkerNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} items={ITEMS} height={76} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
