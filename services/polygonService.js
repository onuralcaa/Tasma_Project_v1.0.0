import axiosInstance from '../utils/axiosInstance';

// Polygon API servisleri
export const getAllPolygons = async () => {
  try {
    const response = await axiosInstance.get('/api/Polygon');
    return response.data;
  } catch (error) {
    console.error('Poligonlar yüklenirken hata:', error);
    throw error;
  }
};

export const getPolygonById = async (id) => {
  try {
    const response = await axiosInstance.get(`/api/Polygon/${id}`);
    return response.data;
  } catch (error) {
    console.error('Poligon yüklenirken hata:', error);
    throw error;
  }
};

export const createPolygon = async (polygonData) => {
  try {
    const response = await axiosInstance.post('/api/Polygon', {
      polygonName: polygonData.polygonName,
      polygonCreatedTime: polygonData.polygonCreatedTime || new Date().toISOString(),
      userId: polygonData.userId
    });
    return response.data;
  } catch (error) {
    console.error('Poligon oluşturulurken hata:', error);
    throw error;
  }
};

export const updatePolygon = async (polygonData) => {
  try {
    const response = await axiosInstance.put('/api/Polygon', {
      polygonId: polygonData.polygonId,
      polygonName: polygonData.polygonName,
      polygonCreatedTime: polygonData.polygonCreatedTime,
      userId: polygonData.userId
    });
    return response.data;
  } catch (error) {
    console.error('Poligon güncellenirken hata:', error);
    throw error;
  }
};

export const deletePolygon = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/Polygon?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Poligon silinirken hata:', error);
    throw error;
  }
};

// PolygonPoint API servisleri
export const getAllPolygonPoints = async () => {
  try {
    const response = await axiosInstance.get('/api/PolygonPoint');
    return response.data;
  } catch (error) {
    console.error('Poligon noktaları yüklenirken hata:', error);
    throw error;
  }
};

export const getPolygonPointById = async (id) => {
  try {
    const response = await axiosInstance.get(`/api/PolygonPoint/${id}`);
    return response.data;
  } catch (error) {
    console.error('Poligon noktası yüklenirken hata:', error);
    throw error;
  }
};

export const createPolygonPoint = async (pointData) => {
  try {
    const response = await axiosInstance.post('/api/PolygonPoint', {
      polygonPointOrder: pointData.polygonPointOrder,
      polygonPointLatitude: pointData.polygonPointLatitude,
      polygonPointLongitude: pointData.polygonPointLongitude,
      polygonId: pointData.polygonId
    });
    return response.data;
  } catch (error) {
    console.error('Poligon noktası oluşturulurken hata:', error);
    throw error;
  }
};

export const updatePolygonPoint = async (pointData) => {
  try {
    const response = await axiosInstance.put('/api/PolygonPoint', {
      polygonPointId: pointData.polygonPointId,
      polygonPointOrder: pointData.polygonPointOrder,
      polygonPointLatitude: pointData.polygonPointLatitude,
      polygonPointLongitude: pointData.polygonPointLongitude,
      polygonId: pointData.polygonId
    });
    return response.data;
  } catch (error) {
    console.error('Poligon noktası güncellenirken hata:', error);
    throw error;
  }
};

export const deletePolygonPoint = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/PolygonPoint?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Poligon noktası silinirken hata:', error);
    throw error;
  }
};

// Yardımcı fonksiyonlar
export const getPolygonPointsByPolygonId = async (polygonId) => {
  try {
    const allPoints = await getAllPolygonPoints();
    return allPoints.filter(point => point.polygonId === polygonId)
                   .sort((a, b) => parseInt(a.polygonPointOrder) - parseInt(b.polygonPointOrder));
  } catch (error) {
    console.error('Poligon noktaları filtrelenirken hata:', error);
    throw error;
  }
};

// Cihazın poligon içinde olup olmadığını kontrol eden fonksiyon
export const isPointInsidePolygon = (latitude, longitude, polygonPoints) => {
  const points = polygonPoints.map(point => [point.polygonPointLatitude, point.polygonPointLongitude]);
  
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    
    if (((yi > longitude) !== (yj > longitude)) && 
        (latitude < (xj - xi) * (longitude - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

// Kullanıcıya ait poligonları getir
export const getUserPolygons = async (userId) => {
  try {
    const allPolygons = await getAllPolygons();
    return allPolygons.filter(polygon => polygon.userId === userId);
  } catch (error) {
    console.error('Kullanıcı poligonları yüklenirken hata:', error);
    throw error;
  }
};
