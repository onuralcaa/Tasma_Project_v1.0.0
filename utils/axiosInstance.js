import axios from 'axios';
import { getToken } from './storage';

const API_BASE_URL = 'http://188.132.202.184:8080'; // Auth ile aynı port

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor - Her istekte token'ı otomatik ekle
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      console.log('API isteği yapılıyor:', config.url);
      const token = await getToken();
      console.log('Token mevcut:', !!token);
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('Authorization header eklendi');
      } else {
        console.log('UYARI: Token bulunamadı!');
      }
    } catch (error) {
      console.log('Token alınırken hata:', error);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Hata yönetimi
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.log('API Error:', error.response?.data || error.message);
    console.log('API Error Status:', error.response?.status);
    console.log('API Error Config:', error.config?.url);
    
    // 401 Unauthorized hatası
    if (error.response?.status === 401) {
      console.log('401 Unauthorized - Token geçersiz veya eksik');
      // Token'ı temizle ve giriş sayfasına yönlendir
      // Bu işlemi screens'de handle edeceğiz
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
