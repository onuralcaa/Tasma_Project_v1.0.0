import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'auth_token';

export const saveToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch (error) {
    console.error('Token kaydedilirken hata:', error);
    return false;
  }
};

export const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Token okunurken hata:', error);
    return null;
  }
};

export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return true;
  } catch (error) {
    console.error('Token silinirken hata:', error);
    return false;
  }
};

export const getUserIdFromToken = async () => {
  try {
    const token = await getToken();
    if (!token) {
      console.log('getUserIdFromToken: Token bulunamadı');
      return null;
    }
    
    const decoded = jwtDecode(token);
    console.log('getUserIdFromToken - Decoded token:', decoded);
    console.log('getUserIdFromToken - Available fields:', Object.keys(decoded));
    
    // Token içindeki userId field'ını al - Microsoft claims format'ı da kontrol et
    const userId = decoded.nameid || 
                   decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
                   decoded.userId || 
                   decoded.sub || 
                   decoded.id || 
                   decoded.user_id || 
                   decoded.user?.id;
    
    console.log('getUserIdFromToken - Bulunan userId:', userId);
    
    if (!userId) {
      console.log('getUserIdFromToken - HATA: Token içinde hiçbir userId field\'ı bulunamadı!');
      console.log('getUserIdFromToken - Token contents:', JSON.stringify(decoded, null, 2));
    }
    
    return userId;
  } catch (error) {
    console.error('getUserIdFromToken - Token çözümlenirken hata:', error);
    return null;
  }
};

// Token'ın geçerliliğini kontrol et
export const isTokenValid = async () => {
  try {
    const token = await getToken();
    if (!token) {
      return false;
    }
    
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    
    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Token geçerlilik kontrolü hatası:', error);
    return false;
  }
};

// Token'dan kullanıcı rolünü al
export const getUserRoleFromToken = async () => {
  try {
    const token = await getToken();
    if (!token) {
      console.log('getUserRoleFromToken: Token bulunamadı');
      return null;
    }
    
    const decoded = jwtDecode(token);
    console.log('getUserRoleFromToken - Decoded token:', decoded);
    
    // Role field'ını al
    const role = decoded.role ||
                 decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
                 decoded.user_role ||
                 decoded.authorities ||
                 'user'; // default role
    
    console.log('getUserRoleFromToken - Bulunan role:', role);
    return role;
  } catch (error) {
    console.error('getUserRoleFromToken - Token çözümlenirken hata:', error);
    return null;
  }
};
