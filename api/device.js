import axiosInstance from '../utils/axiosInstance';

// Tüm cihazları getir
export const getAllDevices = async () => {
  try {
    console.log('Device API çağrısı yapılıyor...');
    const response = await axiosInstance.get('/api/Device');
    console.log('API\'den gelen tüm cihazlar:', response.data);
    console.log('Cihaz ID türleri:', response.data.map(d => ({ 
      name: d.deviceName, 
      id: d.deviceId, 
      type: typeof d.deviceId 
    })));
    return response.data;
  } catch (error) {
    console.error('Cihazlar alınırken hata:', error);
    throw error;
  }
};

// Kullanıcıya özgü cihazları getir
export const getUserDevices = async (userId) => {
  try {
    console.log('Kullanıcıya özgü cihazlar getiriliyor:', userId);
    // Önce tüm cihazları çek, sonra backend'e userId parametresi eklemeyi deneyelim
    const response = await axiosInstance.get(`/api/Device?userId=${userId}`);
    console.log('Kullanıcıya özgü cihazlar:', response.data);
    return response.data;
  } catch (error) {
    console.log('Kullanıcıya özgü cihaz API\'si desteklenmiyor, tüm cihazları getirip filtreliyoruz');
    // Eğer backend desteklemiyorsa, tüm cihazları getir
    const allDevices = await getAllDevices();
    return allDevices; // Filtreleme frontend'de yapılacak
  }
};

// ID'ye göre cihaz getir
export const getDeviceById = async (deviceId) => {
  try {
    const response = await axiosInstance.get(`/api/Device/${deviceId}`);
    return response.data;
  } catch (error) {
    console.error('Cihaz alınırken hata:', error);
    throw error;
  }
};

// Yeni cihaz ekle
export const addDevice = async (deviceData) => {
  try {
    const response = await axiosInstance.post('/api/Device', deviceData);
    return response.data;
  } catch (error) {
    console.error('Cihaz eklenirken hata:', error);
    throw error;
  }
};

// Cihaz sil
export const deleteDevice = async (deviceId) => {
  try {
    const response = await axiosInstance.delete(`/api/Device?id=${deviceId}`);
    return response.data;
  } catch (error) {
    console.error('Cihaz silinirken hata:', error);
    throw error;
  }
};

// Cihaz güncelle
export const updateDevice = async (deviceData) => {
  try {
    const response = await axiosInstance.put('/api/Device', deviceData);
    return response.data;
  } catch (error) {
    console.error('Cihaz güncellenirken hata:', error);
    throw error;
  }
};
