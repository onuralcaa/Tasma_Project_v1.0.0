import axios from 'axios';
import { saveToken, getToken } from '../utils/storage';

// Base URL ve axios instance
const BASE_URL = 'http://188.132.202.184:8080';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 saniye timeout
});

// Token varsa otomatik olarak header'a ekle
export const setupAuthHeader = async () => {
  const token = await getToken();
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
};

// Login işlemi
export const login = async (userName, passWord) => {
  try {
    console.log('Giriş isteği başlatılıyor...', { userName, url: `${BASE_URL}/api/User/Login` });
    
    const response = await api.post('/api/User/Login', {
      userName,
      passWord
    });
    
    console.log('Giriş isteği başarılı:', response.status, response.data);
    
    if (response.data && response.data.token) {
      // Token'ı kaydet
      await saveToken(response.data.token);
      // Header'ı güncelle
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      
      return { success: true, token: response.data.token, data: response.data };
    } else if (response.data) {
      // Token yoksa ama başka data varsa (token başka bir field'da olabilir)
      const token = response.data.access_token || response.data.accessToken || response.data;
      if (typeof token === 'string') {
        await saveToken(token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return { success: true, token, data: response.data };
      }
    }
    
    return { success: false, error: 'Token alınamadı' };
  } catch (error) {
    console.error('Login error detay:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      timeout: error.code === 'ECONNABORTED' ? 'Timeout aşıldı' : 'Timeout değil',
    });
    
    let errorMessage = 'Giriş başarısız';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Sunucu yanıt vermiyor (30 saniye timeout). Lütfen daha sonra tekrar deneyin.';
    } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      errorMessage = 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Kullanıcı adı veya şifre hatalı.';
    } else if (error.response?.status === 500) {
      errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
};

// Register işlemi
export const register = async (userName, passWord) => {
  try {
    console.log('Kayıt isteği başlatılıyor...', { 
      userName, 
      url: `${BASE_URL}/api/User/Register`,
      timestamp: new Date().toISOString()
    });
    
    const startTime = Date.now();
    
    // Sadece userName, passWord ve role ile kayıt
    const requestData = {
      userName,
      passWord,
      role: "user"
    };

    console.log('Kayıt verileri gönderiliyor:', requestData);
    
    const response = await api.post('/api/User/Register', requestData);
    
    const endTime = Date.now();
    console.log('Kayıt isteği başarılı:', {
      status: response.status, 
      data: response.data,
      duration: `${endTime - startTime}ms`
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const endTime = Date.now();
    console.error('Register error detay:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      timeout: error.code === 'ECONNABORTED' ? 'Timeout aşıldı' : 'Timeout değil',
      headers: error.config?.headers,
      timestamp: new Date().toISOString()
    });
    
    let errorMessage = 'Kayıt başarısız';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Sunucu yanıt vermiyor (60 saniye timeout). Veritabanı bağlantısı yavaş olabilir.';
    } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      errorMessage = 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
    } else if (error.response?.status === 500) {
      errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
    } else if (error.response?.status === 400) {
      errorMessage = error.response?.data?.message || 'Geçersiz bilgiler. Lütfen kontrol edin.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
};

// API bağlantısını test eden fonksiyon
export const testConnection = async () => {
  try {
    console.log('API bağlantısı test ediliyor...', BASE_URL);
    
    // Basit bir GET isteği ile sunucuya erişmeyi dene
    const response = await api.get('/api/User/test', { timeout: 5000 });
    
    console.log('API bağlantısı başarılı:', response.status);
    return { success: true, message: 'API bağlantısı çalışıyor' };
  } catch (error) {
    console.log('API bağlantı testi:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    
    if (error.code === 'ECONNABORTED') {
      return { success: false, error: 'Sunucu yanıt vermiyor (timeout)' };
    } else if (error.response?.status === 404) {
      // 404 alması normal, sunucu çalışıyor demek
      return { success: true, message: 'API sunucusu çalışıyor' };
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return { success: false, error: 'Sunucuya bağlanılamıyor' };
    }
    
    return { success: false, error: error.message };
  }
};

// Export axios instance for other API calls
export default api;
