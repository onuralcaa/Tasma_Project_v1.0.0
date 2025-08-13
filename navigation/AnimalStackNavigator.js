import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AnimalListScreen from '../screens/AnimalListScreen';

const Stack = createNativeStackNavigator();

const AnimalStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="AnimalList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="AnimalList" 
        component={AnimalListScreen}
        options={{
          title: 'Hayvanlarım'
        }}
      />
    </Stack.Navigator>
  );
};

export default AnimalStackNavigator;