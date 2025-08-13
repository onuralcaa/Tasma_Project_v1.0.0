import axiosInstance from '../utils/axiosInstance';

// Tüm device sensor verilerini getir
export const getAllDeviceSensors = async () => {
  try {
    console.log('DeviceSensor API çağrısı yapılıyor...');
    console.log('API isteği yapılıyor: /api/DeviceSensor');
    
    const response = await axiosInstance.get('/api/DeviceSensor');
    console.log('API\'den gelen tüm device sensor verileri:', response.data);
    
    console.log('Sensor device ID türleri:', response.data.map(s => ({ 
      sensorId: s.deviceSensorId, 
      deviceId: s.deviceId, 
      type: typeof s.deviceId,
      isOnline: s.isOnline // Yeni isOnline alanı
    })));
    
    return response.data;
  } catch (error) {
    console.error('Device sensor verileri alınırken hata:', error);
    console.error('Hata detayları:', error.response?.data || error.message);
    throw error;
  }
};

// Belirli bir device ID'sine göre sensor verilerini getir
export const getDeviceSensorsByDeviceId = async (deviceId) => {
  try {
    console.log('Device ID\'ye göre sensor verileri alınıyor:', deviceId);
    
    const response = await axiosInstance.get(`/api/DeviceSensor/device/${deviceId}`);
    console.log('Device sensor verileri:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Device sensor verileri alınırken hata:', error);
    throw error;
  }
};

// Yeni device sensor verisi ekle
export const addDeviceSensor = async (sensorData) => {
  try {
    console.log('Yeni device sensor verisi ekleniyor:', sensorData);
    
    const response = await axiosInstance.post('/api/DeviceSensor', sensorData);
    console.log('Device sensor verisi eklendi:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Device sensor verisi eklenirken hata:', error);
    throw error;
  }
};

// Device sensor verisini güncelle
export const updateDeviceSensor = async (sensorId, sensorData) => {
  try {
    console.log('Device sensor verisi güncelleniyor:', sensorId, sensorData);
    
    const response = await axiosInstance.put(`/api/DeviceSensor/${sensorId}`, sensorData);
    console.log('Device sensor verisi güncellendi:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Device sensor verisi güncellenirken hata:', error);
    throw error;
  }
};

// Device sensor verisini sil
export const deleteDeviceSensor = async (sensorId) => {
  try {
    console.log('Device sensor verisi siliniyor:', sensorId);
    
    const response = await axiosInstance.delete(`/api/DeviceSensor/${sensorId}`);
    console.log('Device sensor verisi silindi');
    
    return response.data;
  } catch (error) {
    console.error('Device sensor verisi silinirken hata:', error);
    throw error;
  }
};
