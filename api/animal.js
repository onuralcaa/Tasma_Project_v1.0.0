import axiosInstance from '../utils/axiosInstance';

// Tüm hayvanları getir
export const getAllAnimals = async () => {
  try {
    const response = await axiosInstance.get('/api/Animal');
    return response.data;
  } catch (error) {
    console.error('Hayvanlar alınırken hata:', error);
    throw error;
  }
};

// Kullanıcıya özgü hayvanları getir
export const getUserAnimals = async (userId) => {
  try {
    console.log('Kullanıcıya özgü hayvanlar getiriliyor:', userId);
    // Önce backend'e userId parametresi eklemeyi deneyelim
    const response = await axiosInstance.get(`/api/Animal?userId=${userId}`);
    console.log('Kullanıcıya özgü hayvanlar:', response.data);
    return response.data;
  } catch (error) {
    console.log('Kullanıcıya özgü hayvan API\'si desteklenmiyor, tüm hayvanları getirip filtreliyoruz');
    // Eğer backend desteklemiyorsa, tüm hayvanları getir
    const allAnimals = await getAllAnimals();
    return allAnimals; // Filtreleme frontend'de yapılacak
  }
};

// ID'ye göre hayvan getir
export const getAnimalById = async (animalId) => {
  try {
    const response = await axiosInstance.get(`/api/Animal/${animalId}`);
    return response.data;
  } catch (error) {
    console.error('Hayvan alınırken hata:', error);
    throw error;
  }
};

// Yeni hayvan ekle
export const addAnimal = async (animalData) => {
  try {
    const response = await axiosInstance.post('/api/Animal', animalData);
    return response.data;
  } catch (error) {
    console.error('Hayvan eklenirken hata:', error);
    throw error;
  }
};

// Hayvan sil
export const deleteAnimal = async (animalId) => {
  try {
    const response = await axiosInstance.delete(`/api/Animal?id=${animalId}`);
    return response.data;
  } catch (error) {
    console.error('Hayvan silinirken hata:', error);
    throw error;
  }
};

// Hayvan güncelle
export const updateAnimal = async (animalData) => {
  try {
    const response = await axiosInstance.put('/api/Animal', animalData);
    return response.data;
  } catch (error) {
    console.error('Hayvan güncellenirken hata:', error);
    throw error;
  }
};
