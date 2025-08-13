import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Alert, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import SplashScreen from './screens/SplashScreen';
import TabNavigator from './navigation/TabNavigator';
import { getToken, isTokenValid, removeToken } from './utils/storage';
import { setupAuthHeader } from './api/auth';

// Console uyarılarını ve hata mesajlarını gizle
LogBox.ignoreAllLogs();
console.disableYellowBox = true;

// Geliştirme modunda bile uyarıları tamamen kapat
if (__DEV__) {
  console.warn = () => {};
  console.error = () => {};
}

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authCheckKey, setAuthCheckKey] = useState(0); // Force recheck
  const [showSplash, setShowSplash] = useState(true); // Splash screen kontrolü

  useEffect(() => {
    checkAuthState();
  }, [authCheckKey]);

  const checkAuthState = async () => {
    try {
      console.log('Auth state kontrol ediliyor...');
      const token = await getToken();
      console.log('Mevcut token:', token ? 'Token var' : 'Token yok');
      
      if (token) {
        // Token varsa geçerliliğini kontrol et
        const tokenValid = await isTokenValid();
        console.log('Token geçerli mi?', tokenValid);
        
        if (tokenValid) {
          // Token geçerli, axios header'ına ekle
          await setupAuthHeader();
          setIsLoggedIn(true);
        } else {
          // Token geçersiz, temizle
          console.log('Token geçersiz, temizleniyor...');
          await removeToken();
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Auth state kontrol edilirken hata:', error);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Global auth state update function
  global.updateAuthState = () => {
    setAuthCheckKey(prev => prev + 1);
  };

  // Splash screen'i gizleme fonksiyonu
  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  // Eğer splash screen gösteriliyorsa
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (isLoggedIn) {
    // Kullanıcı giriş yapmış, ana uygulamayı göster
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <TabNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#3498db',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ 
              title: 'Giriş Yap',
              headerShown: false 
            }} 
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen} 
            options={{ 
              title: 'Kayıt Ol',
              headerShown: false 
            }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7f8c8d',
  },
});
