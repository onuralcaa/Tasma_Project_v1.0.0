import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import AnimalStackNavigator from './AnimalStackNavigator';
import DeviceListScreen from '../screens/DeviceListScreen';
import AccountScreen from '../screens/AccountScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Animals') {
            iconName = focused ? 'paw' : 'paw-outline';
          } else if (route.name === 'Devices') {
            iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
          } else if (route.name === 'Account') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#27ae60',
        tabBarInactiveTintColor: '#95a5a6',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#ecf0f1',
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 5 : 10,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 50 + insets.bottom : 70,
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 0 : 0, // iOS'ta 10px yukarı kaldır
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarLabel: 'Ana Sayfa',
        }}
      />
      <Tab.Screen 
        name="Animals" 
        component={AnimalStackNavigator} 
        options={{
          tabBarLabel: 'Hayvanlar',
        }}
      />
      <Tab.Screen 
        name="Devices" 
        component={DeviceListScreen} 
        options={{
          tabBarLabel: 'Cihazlar',
        }}
      />
      <Tab.Screen 
        name="Account" 
        component={AccountScreen} 
        options={{
          tabBarLabel: 'Hesap',
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
