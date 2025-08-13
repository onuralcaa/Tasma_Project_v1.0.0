import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, removeToken } from './storage';

// Debug için AsyncStorage temizleme fonksiyonu
export const clearAllStorage = async () => {
  try {
    console.log('AsyncStorage temizleniyor...');
    await AsyncStorage.clear();
    console.log('AsyncStorage başarıyla temizlendi');
    return true;
  } catch (error) {
    console.error('AsyncStorage temizlenirken hata:', error);
    return false;
  }
};

// Sadece token temizleme
export const clearAuthToken = async () => {
  try {
    console.log('Auth token temizleniyor...');
    const result = await removeToken();
    console.log('Auth token temizlendi:', result);
    return result;
  } catch (error) {
    console.error('Auth token temizlenirken hata:', error);
    return false;
  }
};

// Mevcut token bilgisini görüntüle
export const showCurrentToken = async () => {
  try {
    const token = await getToken();
    console.log('Mevcut token:', token);
    return token;
  } catch (error) {
    console.error('Token alınamadı:', error);
    return null;
  }
};

// AsyncStorage'daki tüm verileri göster
export const showAllStorageData = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('AsyncStorage keys:', keys);
    
    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`${key}:`, value);
    }
  } catch (error) {
    console.error('Storage verileri alınamadı:', error);
  }
};
