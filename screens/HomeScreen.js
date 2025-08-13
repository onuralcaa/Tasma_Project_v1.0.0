import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Platform, ScrollView, TouchableOpacity, Dimensions, Modal, ActivityIndicator, Image, TextInput, Animated } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getAllDevices, getUserDevices } from '../api/device';
import { getAllDeviceSensors } from '../api/deviceSensor';
import { getAllAnimals, getUserAnimals } from '../api/animal';
import { getUserIdFromToken, getUserRoleFromToken, isTokenValid } from '../utils/storage';
import { 
  getAllPolygons, 
  getAllPolygonPoints, 
  createPolygon, 
  createPolygonPoint, 
  updatePolygon,
  deletePolygon,
  deletePolygonPoint,
  getUserPolygons,
  getPolygonPointsByPolygonId,
  isPointInsidePolygon 
} from '../services/polygonService';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceSensors, setDeviceSensors] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]); // Kullanıcıya özgü filtrelenmiş cihazlar
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false); // Konum yenileme loading state'i
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [mapHTML, setMapHTML] = useState('');
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  // Polygon (alan) yönetimi için state'ler
  const [polygons, setPolygons] = useState([]);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState([]);
  const [areaViolations, setAreaViolations] = useState([]); // Alan dışında kalan cihazlar
  const [polygonModalVisible, setPolygonModalVisible] = useState(false);
  const [newPolygonName, setNewPolygonName] = useState('');
  const [previousDeviceStates, setPreviousDeviceStates] = useState({}); // Cihaz durumlarını takip için
  const [editingPolygon, setEditingPolygon] = useState(null); // Düzenlenen polygon
  const [isEditMode, setIsEditMode] = useState(false); // Düzenleme modu
  const [isPolygonListVisible, setIsPolygonListVisible] = useState(false); // Polygon listesi görünürlük
  const [violationVisible, setViolationVisible] = useState(true); // Alan ihlali uyarısı görünürlük
  const [deviceIconBase64, setDeviceIconBase64] = useState(''); // PNG ikon için base64 data
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const modalUpdateIntervalRef = useRef(null); // Modal için ayrı interval
  const pulseAnim = useRef(new Animated.Value(1)).current; // Canlı veri animasyonu

  useEffect(() => {
    initializeScreen();
    loadDeviceIcon(); // PNG ikonu yükle
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup interval when component unmounts
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (modalUpdateIntervalRef.current) {
        clearInterval(modalUpdateIntervalRef.current);
      }
    };
  }, []);

  // Sayfa focus olduğunda verileri yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🔄 HomeScreen focus - Veriler yenileniyor...');
      // Loading state'ini aktifleştir
      setLoading(true);
      initializeScreen();
    });

    return unsubscribe;
  }, [navigation]);

  // Modal açık olduğunda gerçek zamanlı veri güncellemesi
  useEffect(() => {
    if (modalVisible && selectedDevice) {
      // Modal açıldığında gerçek zamanlı güncellemeleri başlat
      const startModalUpdates = () => {
        if (modalUpdateIntervalRef.current) {
          clearInterval(modalUpdateIntervalRef.current);
        }
        
        modalUpdateIntervalRef.current = setInterval(async () => {
          try {
            console.log('🔄 Modal için canlı veri güncelleniyor...');
            
            // Tüm sensor verilerini al
            const newSensorData = await getAllDeviceSensors();
            
            // Kullanıcıya özgü sensor verilerini filtrele
            let filteredSensorData = [];
            if (userRole === 'admin') {
              filteredSensorData = newSensorData || [];
            } else {
              const userDeviceIds = filteredDevices.map(device => device.deviceId);
              filteredSensorData = (newSensorData || []).filter(sensor => 
                userDeviceIds.includes(sensor.deviceId)
              );
            }
            
            // Seçili cihaza ait güncel sensor verilerini bul
            const updatedSensorData = filteredSensorData
              .filter(sensor => {
                const sensorDeviceId = sensor.deviceId?.toString();
                const deviceId = selectedDevice.deviceId?.toString();
                return sensorDeviceId === deviceId;
              })
              .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
            
            // selectedDevice'ı güncelle
            if (updatedSensorData.length > 0) {
              setSelectedDevice(prev => ({
                ...prev,
                sensorData: updatedSensorData
              }));
            }
            
            // Ana sayfanın sensor verilerini de güncelle
            setDeviceSensors(filteredSensorData);
            
          } catch (error) {
            console.error('🔄 Modal veri güncelleme hatası:', error);
          }
        }, 3000); // 3 saniyede bir güncelle
      };
      
      startModalUpdates();
      
      // Cleanup function
      return () => {
        if (modalUpdateIntervalRef.current) {
          clearInterval(modalUpdateIntervalRef.current);
          modalUpdateIntervalRef.current = null;
        }
      };
    }
  }, [modalVisible, selectedDevice, userRole, filteredDevices]);

  // Canlı veri göstergesi animasyonu
  useEffect(() => {
    if (modalVisible) {
      const startPulseAnimation = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };
      
      startPulseAnimation();
    } else {
      // Modal kapatıldığında animasyonu durdur
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [modalVisible, pulseAnim]);

  // PNG ikon dosyasını base64 formatına çevir
  const loadDeviceIcon = async () => {
    try {
      // React Native'de asset URL'ini doğrudan alacağız
      const iconAsset = require('../assets/send.png');
      const resolvedAsset = Image.resolveAssetSource(iconAsset);
      
      if (resolvedAsset && resolvedAsset.uri) {
        setDeviceIconBase64(resolvedAsset.uri);
        console.log('📱 Device icon loaded successfully:', resolvedAsset.uri);
      } else {
        console.log('❌ Device icon could not be resolved, trying alternative method');
        // Alternatif: asset path'ini doğrudan kullan
        setDeviceIconBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
      }
    } catch (error) {
      console.error('❌ PNG ikon yüklenirken hata:', error);
      // Hata durumunda boş string kullan, SVG fallback devreye girecek
      setDeviceIconBase64('');
    }
  };

  // Cihazın aktif/pasif durumunu kontrol eden yardımcı fonksiyon
  const isDeviceOnline = (deviceId, sensorDataList) => {
    // DeviceId kontrolü
    if (!deviceId || deviceId === "" || deviceId === "undefined") {
      return false;
    }

    const deviceSensor = sensorDataList.find(sensor => String(sensor.deviceId) === String(deviceId));
    if (!deviceSensor) {
      return false;
    }
    
    // API'den gelen isOnline değerini kullan
    const isOnline = deviceSensor.isOnline === true;
    
    return isOnline;
  };

  const initializeScreen = async () => {
    try {
      // Token kontrolü
      const tokenValid = await isTokenValid();
      if (!tokenValid) {
        Alert.alert('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın.');
        return;
      }

      // Kullanıcı bilgilerini al
      const currentUserId = await getUserIdFromToken();
      const currentUserRole = await getUserRoleFromToken();
      
      // console.log('HomeScreen - Current user ID:', currentUserId);
      // console.log('HomeScreen - Current user role:', currentUserRole);
      
      setUserId(currentUserId);
      setUserRole(currentUserRole);

      // Konum izni ve konum alma
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Konum erişim izni verilmedi');
        Alert.alert('Konum İzni', 'Harita özelliklerini kullanabilmek için konum izni vermeniz gerekiyor.');
      } else {
        try {
          let locationData = await Location.getCurrentPositionAsync({});
          const userLocation = {
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setLocation(userLocation);
          
          // Konum alındıktan sonra verileri yükle ve HTML'i oluştur
          if (currentUserId) {
            await loadDataWithLocation(userLocation, currentUserId, currentUserRole);
          }
        } catch (error) {
          // console.log('Konum alınırken hata:', error);
          setErrorMsg('Konum bilgisi alınamadı');
          // Konum alınamazsa varsayılan konumla devam et
          const defaultLocation = {
            latitude: 39.9334,
            longitude: 32.8597,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setLocation(defaultLocation);
          if (currentUserId) {
            await loadDataWithLocation(defaultLocation, currentUserId, currentUserRole);
          }
        }
      }
    } catch (error) {
      console.error('Ekran başlatılırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDataWithLocation = async (userLocation, currentUserId, currentUserRole) => {
    try {
      console.log('🔄 Ana sayfa verileri yükleniyor...', { currentUserId, currentUserRole });
      
      let devicesData, sensorsData, animalsData;
      
      if (currentUserRole === 'admin') {
        // Admin tüm verileri görebilir
        console.log('🔐 HomeScreen - Admin kullanıcısı: Tüm veriler getiriliyor');
        [devicesData, sensorsData, animalsData] = await Promise.all([
          getAllDevices().catch(err => {
            console.error('Cihazlar yüklenirken hata:', err);
            return [];
          }),
          getAllDeviceSensors().catch(err => {
            console.error('Sensor verileri yüklenirken hata:', err);
            return [];
          }),
          getAllAnimals().catch(err => {
            console.error('Hayvanlar yüklenirken hata:', err);
            return [];
          })
        ]);
        console.log('✅ HomeScreen - Admin: Tüm veriler başarıyla yüklendi');
      } else {
        // Normal kullanıcı: Önce kullanıcıya özgü API'leri dene
        console.log('👤 HomeScreen - Normal kullanıcı: Kullanıcıya özgü veriler getiriliyor');
        try {
          // Yeni API fonksiyonlarını dene (sensor veriler hala tüm liste olacak, filtreleme yapacağız)
          [animalsData, devicesData, sensorsData] = await Promise.all([
            getUserAnimals(currentUserId),
            getUserDevices(currentUserId),
            getAllDeviceSensors().catch(err => {
              console.error('Sensor verileri yüklenirken hata:', err);
              return [];
            })
          ]);
          console.log('✅ HomeScreen - Kullanıcıya özgü API başarılı');
        } catch (error) {
          console.log('⚠️ HomeScreen - Kullanıcıya özgü API desteklenmiyor, manuel filtreleme yapılıyor');
          // Fallback: Tüm verileri getir ve frontend'de filtrele
          [devicesData, sensorsData, animalsData] = await Promise.all([
            getAllDevices().catch(err => {
              console.error('Cihazlar yüklenirken hata:', err);
              return [];
            }),
            getAllDeviceSensors().catch(err => {
              console.error('Sensor verileri yüklenirken hata:', err);
              return [];
            }),
            getAllAnimals().catch(err => {
              console.error('Hayvanlar yüklenirken hata:', err);
              return [];
            })
          ]);
          
          // Kullanıcıya özgü verileri filtrele
          animalsData = (animalsData || []).filter(animal => {
            const matches = animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString();
            // console.log(`HomeScreen Hayvan ${animal.animalName}: userId=${animal.userId}, currentUserId=${currentUserId}, matches=${matches}`);
            return matches;
          });

          // Kullanıcının hayvanlarına bağlı cihazları filtrele
          const userAnimalIds = animalsData.map(animal => animal.animalId);
          devicesData = (devicesData || []).filter(device => {
            const matches = userAnimalIds.includes(device.animalId);
            // console.log(`HomeScreen Cihaz ${device.deviceName}: animalId=${device.animalId}, userAnimalIds=${userAnimalIds}, matches=${matches}`);
            return matches;
          });
        }

        // Kullanıcının cihazlarına ait sensor verilerini filtrele (her durumda gerekli)
        const userDeviceIds = devicesData.map(device => device.deviceId);
        sensorsData = (sensorsData || []).filter(sensor => {
          const matches = userDeviceIds.includes(sensor.deviceId);
          // console.log(`HomeScreen Sensor: deviceId=${sensor.deviceId}, userDeviceIds=${userDeviceIds}, matches=${matches}`);
          return matches;
        });
      }

      console.log('📊 HomeScreen - Final veriler:', {
        hayvanSayisi: animalsData?.length || 0,
        cihazSayisi: devicesData?.length || 0,
        sensorSayisi: sensorsData?.length || 0,
        userRole: currentUserRole
      });

      setDevices(devicesData || []);
      setDeviceSensors(sensorsData || []);
      setAnimals(animalsData || []);
      
      // Kullanıcıya özgü filtrelenmiş cihazları da set et
      let userFilteredDevices = devicesData || [];
      if (currentUserRole !== 'admin') {
        // Normal kullanıcı için filtreleme
        const userAnimalsFiltered = (animalsData || []).filter(animal => {
          const matches = animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString();
          return matches;
        });
        
        const userAnimalIds = userAnimalsFiltered.map(animal => animal.animalId);
        userFilteredDevices = (devicesData || []).filter(device => {
          const matches = userAnimalIds.includes(device.animalId);
          return matches;
        });
      }
      setFilteredDevices(userFilteredDevices);
      console.log('🎯 HomeScreen - Filtrelenmiş cihazlar:', {
        toplamCihaz: devicesData?.length || 0,
        filtrelenmişCihaz: userFilteredDevices.length,
        cihazAdları: userFilteredDevices.map(d => d.deviceName)
      });

      // DeviceId kontrolü - hangi cihazların deviceId'si eksik kontrol et
      console.log('🔍 DeviceId Kontrolü:');
      userFilteredDevices.forEach(device => {
        if (!device.deviceId || device.deviceId === "" || device.deviceId === "undefined") {
          console.log(`❌ ${device.deviceName}: DeviceId EKSIK! (MAC: ${device.deviceMacAdress})`);
        } else {
          console.log(`✅ ${device.deviceName}: DeviceId mevcut (${device.deviceId})`);
        }
      });
      
      // Polygon verilerini yükle
      await loadPolygonData(currentUserId, currentUserRole);
      
      // Veri yüklendikten sonra HTML'i oluştur
      const html = generateMapHTML(userLocation.latitude, userLocation.longitude, devicesData || [], sensorsData || [], animalsData || [], currentUserId, currentUserRole);
      setMapHTML(html);
      
      // Başlangıç cihaz durumlarını ayarla
      const initialDeviceStates = {};
      userFilteredDevices.forEach(device => {
        const isOnline = isDeviceOnline(device.deviceId, sensorsData || []);
        initialDeviceStates[device.deviceId] = isOnline;
      });
      setPreviousDeviceStates(initialDeviceStates);
      
      // Son güncelleme zamanını ayarla
      setLastUpdateTime(new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      }));

    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  // Polygon verilerini yükle
  const loadPolygonData = async (currentUserId, currentUserRole) => {
    try {
      let polygonsData, polygonPointsData;
      
      if (currentUserRole === 'admin') {
        // Admin tüm alanları görebilir
        [polygonsData, polygonPointsData] = await Promise.all([
          getAllPolygons().catch(err => {
            console.error('Poligonlar yüklenirken hata:', err);
            return [];
          }),
          getAllPolygonPoints().catch(err => {
            console.error('Poligon noktaları yüklenirken hata:', err);
            return [];
          })
        ]);
      } else {
        // Normal kullanıcı sadece kendi alanlarını görebilir
        [polygonsData, polygonPointsData] = await Promise.all([
          getUserPolygons(currentUserId).catch(err => {
            console.error('Kullanıcı poligonları yüklenirken hata:', err);
            return [];
          }),
          getAllPolygonPoints().catch(err => {
            console.error('Poligon noktaları yüklenirken hata:', err);
            return [];
          })
        ]);
      }

      setPolygons(polygonsData || []);
      setPolygonPoints(polygonPointsData || []);
      
      console.log(`✅ ${polygonsData?.length || 0} poligon ve ${polygonPointsData?.length || 0} nokta yüklendi`);
    } catch (error) {
      console.error('Polygon verileri yüklenirken hata:', error);
    }
  };

  // Cihazların alan kontrolünü yap
  const checkDeviceAreaViolations = async () => {
    try {
      if (!polygons || polygons.length === 0 || !filteredDevices || filteredDevices.length === 0) {
        setAreaViolations([]);
        return;
      }

      const violations = [];
      
      for (const device of filteredDevices) {
        // Sadece çevrimiçi cihazları kontrol et
        const isOnline = isDeviceOnline(device.deviceId, deviceSensors);
        if (!isOnline) continue;

        // Cihazın güncel konumunu al
        const deviceSensor = deviceSensors.find(sensor => 
          String(sensor.deviceId) === String(device.deviceId) && sensor.isOnline
        );
        
        if (!deviceSensor || !deviceSensor.deviceSensorLatitude || !deviceSensor.deviceSensorLongitude) {
          continue;
        }

        const deviceLat = deviceSensor.deviceSensorLatitude;
        const deviceLng = deviceSensor.deviceSensorLongitude;

        // Cihazın herhangi bir alanda olup olmadığını kontrol et
        let isInsideAnyPolygon = false;
        
        for (const polygon of polygons) {
          // Bu poligona ait noktaları al
          const polygonPointsForThisPolygon = polygonPoints.filter(point => 
            point.polygonId === polygon.polygonId
          ).sort((a, b) => parseInt(a.polygonPointOrder) - parseInt(b.polygonPointOrder));
          
          if (polygonPointsForThisPolygon.length >= 3) {
            const isInside = isPointInsidePolygon(deviceLat, deviceLng, polygonPointsForThisPolygon);
            if (isInside) {
              isInsideAnyPolygon = true;
              break;
            }
          }
        }

        // Eğer hiçbir alanda değilse, ihlal olarak kaydet
        if (!isInsideAnyPolygon) {
          const connectedAnimal = animals.find(animal => animal.animalId === device.animalId);
          violations.push({
            device,
            animal: connectedAnimal,
            sensor: deviceSensor,
            violationTime: new Date().toISOString()
          });
        }
      }

      setAreaViolations(violations);
      
      // Eğer yeni ihlaller varsa kullanıcıyı uyar ve uyarıyı göster
      if (violations.length > 0) {
        console.log(`⚠️ ${violations.length} cihaz güvenli alan dışında!`);
        setViolationVisible(true); // Yeni ihlal durumunda uyarıyı tekrar göster
      }
      
    } catch (error) {
      console.error('Alan kontrolü yapılırken hata:', error);
    }
  };

  // Cihaz durumları değiştiğinde haritayı yenile
  const checkAndReloadMapIfNeeded = (newSensorData) => {
    if (!filteredDevices || filteredDevices.length === 0) return;

    // Mevcut cihaz durumlarını belirle
    const currentDeviceStates = {};
    filteredDevices.forEach(device => {
      const isOnline = isDeviceOnline(device.deviceId, newSensorData);
      currentDeviceStates[device.deviceId] = isOnline;
    });

    // Önceki durumlarla karşılaştır
    let hasStatusChanged = false;
    for (const deviceId in currentDeviceStates) {
      const currentStatus = currentDeviceStates[deviceId];
      const previousStatus = previousDeviceStates[deviceId];
      
      // Eğer durum değiştiyse (undefined'dan bir değere veya tersi)
      if (previousStatus !== undefined && previousStatus !== currentStatus) {
        console.log(`🔄 Cihaz ${deviceId} durumu değişti: ${previousStatus ? 'Çevrimiçi' : 'Çevrimdışı'} → ${currentStatus ? 'Çevrimiçi' : 'Çevrimdışı'}`);
        hasStatusChanged = true;
        break;
      }
    }

    // Durum değişmişse haritayı yeniden yükle
    if (hasStatusChanged && location) {
      console.log('🗺️ Cihaz durumu değişti - Harita yeniden yükleniyor...');
      const html = generateMapHTML(location.latitude, location.longitude, devices, newSensorData, animals, userId, userRole);
      setMapHTML(html);
    }

    // Mevcut durumları kaydet
    setPreviousDeviceStates(currentDeviceStates);
  };

  // Gerçek zamanlı veri güncelleme
  const startRealTimeUpdates = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    
    updateIntervalRef.current = setInterval(async () => {
      try {
        // console.log('🔄 Gerçek zamanlı veri güncelleniyor...');
        
        if (!userId) {
          console.log('🔄 Kullanıcı ID bulunamadı, güncelleme atlanıyor');
          return;
        }

        const newSensorData = await getAllDeviceSensors();
        
        // Kullanıcıya özgü sensor verilerini filtrele
        let filteredSensorData = [];
        if (userRole === 'admin') {
          filteredSensorData = newSensorData || [];
        } else {
          // Normal kullanıcı için filtreleme - sadece kendi cihazlarına ait sensor verileri
          const userDeviceIds = filteredDevices.map(device => device.deviceId);
          filteredSensorData = (newSensorData || []).filter(sensor => 
            userDeviceIds.includes(sensor.deviceId)
          );
        }
        
        // Yeni verilerle state'i güncelle
        setDeviceSensors(filteredSensorData);
        setLastUpdateTime(new Date().toLocaleTimeString('tr-TR', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }));
        
        // Cihaz durumu değişikliklerini kontrol et ve gerekirse haritayı yenile
        checkAndReloadMapIfNeeded(filteredSensorData);
        
        // Cihaz durumlarını kontrol et
        let onlineDeviceCount = 0;
        filteredDevices.forEach(device => {
          const isOnline = isDeviceOnline(device.deviceId, filteredSensorData);
          if (isOnline) onlineDeviceCount++;
        });
        
        // Eğer harita yeniden yüklenmediyse, sadece marker pozisyonlarını güncelle
        if (webViewRef.current && location && mapHTML) {
          updateMapPositions(filteredSensorData);
        }
        
        // Alan kontrolünü yap
        await checkDeviceAreaViolations();
      } catch (error) {
        console.error('🔄 Gerçek zamanlı güncelleme hatası:', error);
      }
    }, 3000); // 3 saniyede bir güncelle
  };

  const stopRealTimeUpdates = () => {
    // console.log('⏹️ Gerçek zamanlı güncelleme durduruldu');
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };

  // Debounce timeout referansı
  const mapUpdateTimeoutRef = useRef(null);

  const updateMapPositions = (newSensorData) => {
    // Önceki timeout'u temizle
    if (mapUpdateTimeoutRef.current) {
      clearTimeout(mapUpdateTimeoutRef.current);
    }
    
    // 500ms bekle - kullanıcı harita ile etkileşimde ise güncellemeyi ertele
    mapUpdateTimeoutRef.current = setTimeout(() => {
      if (!webViewRef.current || !newSensorData) {
        console.log('🔄 WebView ref veya sensor data yok - güncelleme atlandı');
        return;
      }
      
      executeMapUpdate(newSensorData);
    }, 500);
  };

  const executeMapUpdate = (newSensorData) => {
    const updateCommand = `
      try {
        // Yeni sensor verilerinden çevrimiçi/çevrimdışı durumları belirle
        const sensorDataArray = ${JSON.stringify(newSensorData)};
        const deviceStatuses = {};
        
        // Filtrelenmiş cihazları da gönder
        const filteredDevicesList = ${JSON.stringify(filteredDevices)};
        const animalsList = ${JSON.stringify(animals)};
        
        // Her cihazın durumunu belirle
        sensorDataArray.forEach(sensor => {
          const normalizedSensorDeviceId = sensor.deviceId.toString();
          deviceStatuses[normalizedSensorDeviceId] = {
            isOnline: sensor.isOnline === true,
            lat: sensor.deviceSensorLatitude,
            lng: sensor.deviceSensorLongitude,
            sensor: sensor
          };
        });
        
        // Yönlü cihaz ikonu oluşturma fonksiyonu
        function createDirectionalDeviceIcon(yaw = 0, isOnline = true) {
          const color = '#e74c3c'; // Kırmızı renk
          
          // Yaw değerini normalize et (0-360 arası)
          const normalizedYaw = ((yaw % 360) + 360) % 360;
          
          // Büyütülmüş triangle - 30x30 boyut
          const triangleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30" style="overflow: visible;">' +
            '<path d="M15 3 L24 24 L15 20 L6 24 Z" fill="' + color + '" stroke="#fff" stroke-width="1.5"' +
            ' transform="rotate(' + normalizedYaw + ' 15 15)"' +
            ' style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5))"/>' +
            '</svg>';
          
          return L.divIcon({
            className: 'triangle-device-icon',
            html: triangleSvg,
            iconSize: [30, 30],
            iconAnchor: [15, 15] // Tam merkez noktası
          });
        }
        
        // Mevcut tüm markerları kontrol et
        if (window.deviceMarkers) {
          Object.keys(window.deviceMarkers).forEach(deviceId => {
            const marker = window.deviceMarkers[deviceId];
            
            // deviceId'yi string olarak normalize et
            const normalizedDeviceId = deviceId.toString();
            const status = deviceStatuses[normalizedDeviceId];
            
            if (status) {
              if (status.isOnline) {
                // Çevrimiçi cihaz - marker'ı göster ve güncelle
                if (marker && marker.getLatLng) {
                  const newPos = [status.lat, status.lng];
                  marker.setLatLng(newPos);
                  
                  // Yönlü ikonu güncelle (Yaw değerine göre) - her zaman güncelle
                  const deviceYaw = status.sensor.deviceSensorYaw || 0;
                  const updatedIcon = createDirectionalDeviceIcon(deviceYaw, true);
                  marker.setIcon(updatedIcon);
                  
                  // Marker'ı haritaya ekle (eğer kaldırılmışsa)
                  if (!window.map.hasLayer(marker)) {
                    marker.addTo(window.map);
                  }
                  
                  // Popup içeriğini tamamen yeniden oluştur
                  if (marker.getPopup && marker.getPopup()) {
                    // Cihaza bağlı hayvanı bul
                    const connectedAnimal = animalsList.find(animal => animal.animalId === filteredDevicesList.find(dev => dev.deviceId.toString() === normalizedDeviceId)?.animalId);
                    
                    const newPopupContent = '<div class="device-popup">' +
                      '<div class="popup-title">📱 ' + (filteredDevicesList.find(dev => dev.deviceId.toString() === normalizedDeviceId)?.deviceName || 'Cihaz') + '</div>' +
                      '<div class="popup-info"><strong>Durum:</strong> <span style="color: green;">🟢 Çevrimiçi</span></div>' +
                      '<div class="popup-info"><strong>Hayvan:</strong> ' + (connectedAnimal ? connectedAnimal.animalName : 'Bağlı değil') + '</div>' +
                      '<div class="popup-info"><strong>MAC:</strong> ' + (filteredDevicesList.find(dev => dev.deviceId.toString() === normalizedDeviceId)?.deviceMacAdress || 'N/A') + '</div>' +
                      '<div class="popup-info"><strong>GPS:</strong> ' + status.lat.toFixed(5) + ', ' + status.lng.toFixed(5) + '</div>' +
                      '<div class="popup-info"><strong>Batarya:</strong> ' + (status.sensor.deviceSensorBatteryStatus || 'N/A') + '%</div>' +
                      '<div class="popup-info"><strong>İvme:</strong> ' + (status.sensor.deviceSensorAccelaration || 'N/A') + ' m/s²</div>' +
                      '<div class="popup-info"><strong>Yön (Yaw):</strong> ' + (status.sensor.deviceSensorYaw || 'N/A') + '°</div>' +
                      '<button class="popup-button" onclick="if(window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({type: \\'deviceClick\\', deviceId: \\''+normalizedDeviceId+'\\'})); }">' +
                      'Tasma Detayları' +
                      '</button>' +
                      '</div>';
                    
                    marker.getPopup().setContent(newPopupContent);
                  }
                }
              } else {
                // Çevrimdışı cihaz - marker'ı gizle
                if (marker && window.map.hasLayer(marker)) {
                  window.map.removeLayer(marker);
                }
              }
            } else {
              // Sensor verisi olmayan cihazları da gizle (çevrimdışı kabul et)
              if (marker && window.map.hasLayer(marker)) {
                window.map.removeLayer(marker);
              }
            }
          });
          
          // Çevrimiçi olan ama henüz haritada olmayan cihazları ekle
          filteredDevicesList.forEach(device => {
            // DeviceId kontrolü
            if (!device.deviceId || device.deviceId === "" || device.deviceId === "undefined") {
              return;
            }
            
            const deviceId = device.deviceId.toString();
            const status = deviceStatuses[deviceId];
            
            if (status && status.isOnline && !window.deviceMarkers[deviceId]) {
              // Cihaza bağlı hayvanı bul
              const connectedAnimal = animalsList.find(animal => animal.animalId === device.animalId);
              
              // Yönlü ikon oluştur
              const deviceYaw = status.sensor.deviceSensorYaw || 0;
              const triangleIcon = createDirectionalDeviceIcon(deviceYaw, true, deviceIconUri);
              
              // Yeni marker oluştur
              const newMarker = L.marker([status.lat, status.lng], {icon: triangleIcon}).addTo(window.map);
              
              // Global referansa ekle
              window.deviceMarkers[deviceId] = newMarker;
              
              // Popup içeriği oluştur
              const popupContent = '<div class="device-popup">' +
                '<div class="popup-title">📱 ' + device.deviceName + '</div>' +
                '<div class="popup-info"><strong>Durum:</strong> <span style="color: green;">🟢 Çevrimiçi</span></div>' +
                '<div class="popup-info"><strong>Hayvan:</strong> ' + (connectedAnimal ? connectedAnimal.animalName : 'Bağlı değil') + '</div>' +
                '<div class="popup-info"><strong>MAC:</strong> ' + device.deviceMacAdress + '</div>' +
                '<div class="popup-info"><strong>GPS:</strong> ' + status.lat.toFixed(5) + ', ' + status.lng.toFixed(5) + '</div>' +
                '<div class="popup-info"><strong>Batarya:</strong> ' + (status.sensor.deviceSensorBatteryStatus || 'N/A') + '%</div>' +
                '<div class="popup-info"><strong>İvme:</strong> ' + (status.sensor.deviceSensorAccelaration || 'N/A') + ' m/s²</div>' +
                '<div class="popup-info"><strong>Yön (Yaw):</strong> ' + (status.sensor.deviceSensorYaw || 'N/A') + '°</div>' +
                '<button class="popup-button" onclick="if(window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({type: \\'deviceClick\\', deviceId: \\''+deviceId+'\\'})); }">' +
                'Tasma Detayları' +
                '</button>' +
                '</div>';
              
              newMarker.bindPopup(popupContent);
            }
          });
        }
        
      } catch (error) {
        console.error('Marker güncelleme hatası:', error);
      }
    `;
    
    webViewRef.current.injectJavaScript(updateCommand);
  };

  // Harita için HTML içeriği oluştur
  const generateMapHTML = (lat, lng, devicesList = devices, sensorsList = deviceSensors, animalsList = animals, currentUserId = userId, currentUserRole = userRole) => {
    // console.log('🗺️ Harita HTML oluşturuluyor...');
    // console.log('🗺️ Kullanıcı ID:', currentUserId);
    // console.log('🗺️ Kullanıcı Rolü:', currentUserRole);
    // console.log('🗺️ Gönderilen cihazlar:', devicesList);
    // console.log('🗺️ Gönderilen sensor verileri:', sensorsList);

    // Kullanıcıya özgü filtreleme uygula
    let filteredDevices = devicesList;
    let filteredSensors = sensorsList;
    let filteredAnimals = animalsList;

    if (currentUserRole !== 'admin') {
      // console.log('🗺️ Normal kullanıcı - Harita verileri filtreleniyor...');
      
      // Normal kullanıcı: Sadece kendi hayvanları
      filteredAnimals = animalsList.filter(animal => {
        const matches = animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString();
        // console.log(`🗺️ Hayvan ${animal.animalName}: userId=${animal.userId}, currentUserId=${currentUserId}, matches=${matches}`);
        return matches;
      });

      // Kullanıcının hayvanlarına bağlı cihazları filtrele
      const userAnimalIds = filteredAnimals.map(animal => animal.animalId);
      filteredDevices = devicesList.filter(device => {
        const matches = userAnimalIds.includes(device.animalId);
        // console.log(`🗺️ Cihaz ${device.deviceName}: animalId=${device.animalId}, userAnimalIds=${userAnimalIds}, matches=${matches}`);
        return matches;
      });

      // Kullanıcının cihazlarına ait sensor verilerini filtrele
      const userDeviceIds = filteredDevices.map(device => device.deviceId);
      filteredSensors = sensorsList.filter(sensor => {
        const matches = userDeviceIds.includes(sensor.deviceId);
        // console.log(`🗺️ Sensor: deviceId=${sensor.deviceId}, userDeviceIds=${userDeviceIds}, matches=${matches}`);
        return matches;
      });
    } else {
      // console.log('🗺️ Admin kullanıcısı - Tüm veriler haritada gösteriliyor');
    }

    // console.log('🗺️ Haritada gösterilecek final veriler:', {
    //   cihazSayisi: filteredDevices.length,
    //   sensorSayisi: filteredSensors.length,
    //   hayvanSayisi: filteredAnimals.length,
    //   userRole: currentUserRole
    // });
    
    // Cihaz konumlarını ve sensor verilerini birleştir - SADECE ÇEVRİMİÇİ CİHAZLAR
    const deviceLocations = filteredDevices
      .filter(device => {
        // DeviceId kontrolü
        if (!device.deviceId || device.deviceId === "" || device.deviceId === "undefined") {
          return false;
        }
        
        // Sadece çevrimiçi cihazları haritada göster
        const isOnline = isDeviceOnline(device.deviceId, filteredSensors);
        return isOnline;
      })
      .map(device => {
      // console.log(`🗺️ Cihaz işleniyor: ${device.deviceName} (ID: ${device.deviceId})`);
      
      // Bu cihaza ait en son sensor verilerini bul
      const deviceSensorData = filteredSensors
        .filter(sensor => {
          // Hem string hem number karşılaştırması yap
          const sensorDeviceId = sensor.deviceId?.toString();
          const deviceId = device.deviceId?.toString();
          const match = sensorDeviceId === deviceId;
          // console.log(`🗺️ Sensor eşleştirme: "${sensorDeviceId}" === "${deviceId}" = ${match}`);
          return match;
        })
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];

      // console.log(`🗺️ ${device.deviceName} için bulunan sensor verisi:`, deviceSensorData);

      // Cihaza bağlı hayvanı bul
      const connectedAnimal = filteredAnimals.find(animal => animal.animalId === device.animalId);

      const location = {
        device,
        sensorData: deviceSensorData,
        animal: connectedAnimal,
        // Eğer sensor verisi varsa onun koordinatlarını kullan, yoksa varsayılan konum
        lat: deviceSensorData?.deviceSensorLatitude || (lat + (Math.random() - 0.5) * 0.01),
        lng: deviceSensorData?.deviceSensorLongitude || (lng + (Math.random() - 0.5) * 0.01)
      };
      
      // console.log(`${device.deviceName} lokasyon bilgisi:`, location);
      return location;
    });

    // console.log('Tüm cihaz lokasyonları:', deviceLocations);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <style>
            body, html { margin: 0; padding: 0; height: 100%; }
            #map { height: 100%; width: 100%; }
            .device-popup {
                font-family: Arial, sans-serif;
                max-width: 200px;
            }
            .popup-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 5px;
                color: #2c3e50;
            }
            .popup-info {
                font-size: 12px;
                margin: 2px 0;
                color: #34495e;
            }
            .popup-button {
                background: #27ae60;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                margin-top: 8px;
                cursor: pointer;
                font-size: 11px;
            }
            .device-label {
                background: rgba(255, 255, 255, 0.9);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                color: #2c3e50;
                border: 1px solid #bdc3c7;
                text-align: center;
                white-space: nowrap;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            .point-label {
                cursor: move !important;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
            .point-label div {
                cursor: move !important;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
            .triangle-device-icon {
                transition: none; /* Animasyonu kaldır, daha stabil konumlandırma için */
                z-index: 1000;
                transform-origin: center center;
            }
            .triangle-device-icon svg {
                filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
                transition: none; /* SVG animasyonunu da kaldır */
            }
            .png-device-icon {
                transition: none; /* PNG için de animasyon kaldır */
                z-index: 1000;
                transform-origin: center center;
                filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
            }
            .polygon-popup {
                font-family: Arial, sans-serif;
                max-width: 200px;
            }
            .polygon-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 5px;
                color: #e67e22;
            }
            .polygon-info {
                font-size: 12px;
                margin: 2px 0;
                color: #34495e;
            }
            .edit-polygon-btn, .save-polygon-btn, .cancel-edit-btn {
                background: #3498db;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                margin: 3px 2px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            }
            .save-polygon-btn {
                background: #27ae60;
            }
            .cancel-edit-btn {
                background: #e74c3c;
            }
            .edit-polygon-btn:hover, .save-polygon-btn:hover, .cancel-edit-btn:hover {
                opacity: 0.8;
            }
            .passive-polygon {
                cursor: pointer;
                transition: opacity 0.2s ease;
            }
            .passive-polygon:hover {
                opacity: 0.8;
            }
            .active-polygon {
                cursor: default;
            }
            .editable-point {
                cursor: move;
                transition: none;
            }
            .edit-point-label {
                cursor: move;
                transition: none;
            }
            .drawing-controls {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                background: rgba(255, 255, 255, 0.95);
                padding: 12px 16px;
                border-radius: 25px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                display: none; /* WebView butonlarını gizle */
                gap: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            .drawing-info-panel {
                position: absolute;
                top: 5px;
                right: 5px;
                z-index: 1000;
                background: rgba(255, 255, 255, 0.95);
                padding: 10px 15px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                display: none;
                min-width: 160px;
                font-size: 13px;
            }
            .info-title {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 8px;
                border-bottom: 2px solid #3498db;
                padding-bottom: 4px;
            }
            .info-item {
                font-size: 12px;
                color: #34495e;
                margin: 4px 0;
                display: flex;
                justify-content: space-between;
            }
            .info-value {
                font-weight: bold;
                color: #3498db;
            }
            .extra-controls {
                position: absolute;
                bottom: 35px;
                left: 5px;
                z-index: 1000;
                background: rgba(255, 255, 255, 0.95);
                padding: 10px 15px;
                border-radius: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                display: none;
                flex-direction: column;
                gap: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                max-width: 120px;
            }
            .draw-button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                min-width: 80px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
            }
            .draw-button:hover {
                background: #45a049;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
            }
            .draw-button.clear-btn {
                background: #f44336;
                box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
            }
            .draw-button.clear-btn:hover {
                background: #da190b;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
            }
            .draw-button.save-btn {
                background: #2196F3;
                box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
            }
            .draw-button.save-btn:hover {
                background: #0b7dda;
                box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
            }
            .draw-button.active {
                background: linear-gradient(45deg, #FF9800, #FF5722);
                box-shadow: 0 4px 15px rgba(255, 152, 0, 0.6);
                animation: drawingPulse 2s infinite;
                border: 2px solid #fff;
                transform: scale(1.05);
            }
            .draw-button.active:hover {
                background: linear-gradient(45deg, #F57C00, #E64A19);
                transform: scale(1.08);
            }
            @keyframes drawingPulse {
                0% { 
                    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.6);
                    border-color: #fff;
                }
                50% { 
                    box-shadow: 0 6px 25px rgba(255, 152, 0, 0.8);
                    border-color: #FFE0B2;
                }
                100% { 
                    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.6);
                    border-color: #fff;
                }
            }
            .extra-button {
                background: #9C27B0;
                color: white;
                border: none;
                padding: 8px 14px;
                border-radius: 18px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                min-width: 70px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 6px rgba(156, 39, 176, 0.3);
            }
            .extra-button:hover {
                background: #7B1FA2;
                transform: translateY(-1px);
                box-shadow: 0 3px 8px rgba(156, 39, 176, 0.4);
            }
            .extra-button.undo-btn {
                background: #2196F3;
                box-shadow: 0 2px 6px rgba(33, 150, 243, 0.3);
            }
            .extra-button.undo-btn:hover {
                background: #1976D2;
            }
            .extra-button.confirm-btn {
                background: #4CAF50;
                box-shadow: 0 2px 6px rgba(76, 175, 80, 0.3);
            }
            .extra-button.confirm-btn:hover {
                background: #45a049;
            }
            .extra-button.reset-btn {
                background: #f44336;
                box-shadow: 0 2px 6px rgba(244, 67, 54, 0.3);
            }
            .extra-button.reset-btn:hover {
                background: #da190b;
            }
            @keyframes drawingPulse {
                0% { 
                    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.6);
                    border-color: #fff;
                }
                50% { 
                    box-shadow: 0 6px 25px rgba(255, 152, 0, 0.8);
                    border-color: #FFE0B2;
                }
                100% { 
                    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.6);
                    border-color: #fff;
                }
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <div class="drawing-info-panel" id="drawingInfoPanel">
            <div class="info-title">Alan Çizimi</div>
            <div class="info-item">
                <span>Eklenen Nokta:</span>
                <span class="info-value" id="pointCount">0</span>
            </div>
            <div class="info-item">
                <span>Alandaki Cihaz:</span>
                <span class="info-value" id="deviceCount">0</span>
            </div>
            <div class="info-item">
                <span>Durum:</span>
                <span class="info-value" id="drawingStatus">Hazır</span>
            </div>
        </div>
        <div class="extra-controls" id="extraControls">
            <button id="undoBtn" class="extra-button undo-btn" onclick="undoLastPoint()">
                Geri Al
            </button>
            <button id="resetBtn" class="extra-button reset-btn" onclick="resetDrawing()">
                Sıfırla
            </button>
            <button id="confirmBtn" class="extra-button confirm-btn" onclick="confirmDrawing()">
                Onayla
            </button>
            <button id="helpBtn" class="extra-button" onclick="showHelp()">
                Yardım
            </button>
        </div>
        <div class="drawing-controls">
            <button id="drawPolygonBtn" class="draw-button" onclick="toggleDrawingMode()">
                Alan Çiz
            </button>
            <button id="clearPolygonsBtn" class="draw-button clear-btn" onclick="clearAllPolygons()">
                Temizle
            </button>
            <button id="savePolygonBtn" class="draw-button save-btn" onclick="saveCurrentPolygon()" style="display: none;">
                Kaydet
            </button>
        </div>
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
        <script>
            var map = L.map('map').setView([${lat}, ${lng}], 13);
            
            // Global marker ve polygon referansları
            window.deviceMarkers = {};
            window.polygons = [];
            window.currentDrawingPolygon = null;
            window.drawingPoints = [];
            window.isDrawingMode = false;
            window.map = map;
            window.tempMarkers = []; // Geçici nokta markerları için
            window.draggedPointIndex = null; // Sürüklenen nokta indexi
            window.isDragging = false; // Sürükleme durumu
            window.editingPolygonActive = false; // Düzenleme modunda polygon aktif mi
            
            // Panellerin çift tıklama event'lerini engelle
            document.addEventListener('DOMContentLoaded', function() {
                // Alan çizimi bilgi paneli için çift tıklama engelleyici
                const infoPanel = document.getElementById('drawingInfoPanel');
                const extraControls = document.getElementById('extraControls');
                
                function preventDoubleClickZoom(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }
                
                if (infoPanel) {
                    infoPanel.addEventListener('dblclick', preventDoubleClickZoom);
                    infoPanel.addEventListener('touchstart', function(e) {
                        e.stopPropagation();
                    });
                }
                
                if (extraControls) {
                    extraControls.addEventListener('dblclick', preventDoubleClickZoom);
                    extraControls.addEventListener('touchstart', function(e) {
                        e.stopPropagation();
                    });
                }
            });
            
            // Cihaz verileri
            const deviceData = ${JSON.stringify(deviceLocations.map(loc => ({
                id: loc.device.deviceId,
                name: loc.device.deviceName,
                lat: loc.lat,
                lng: loc.lng,
                isOnline: loc.sensorData?.isOnline || false
            })))};
            
            // Bilgi panelini güncelle
            function updateInfoPanel() {
                const pointCountEl = document.getElementById('pointCount');
                const deviceCountEl = document.getElementById('deviceCount');
                const statusEl = document.getElementById('drawingStatus');
                
                if (pointCountEl) pointCountEl.textContent = window.drawingPoints.length;
                
                // Çizilen alan içindeki cihaz sayısını hesapla
                let devicesInArea = 0;
                if (window.drawingPoints.length >= 3) {
                    devicesInArea = deviceData.filter(device => {
                        if (!device.isOnline) return false;
                        return isPointInsidePolygon(device.lat, device.lng, window.drawingPoints.map(p => ({
                            polygonPointLatitude: p[0],
                            polygonPointLongitude: p[1]
                        })));
                    }).length;
                }
                
                if (deviceCountEl) deviceCountEl.textContent = devicesInArea;
                
                // Durum güncelle
                if (statusEl) {
                    if (!window.isDrawingMode) {
                        statusEl.textContent = 'Hazır';
                        statusEl.style.color = '#4CAF50';
                    } else if (window.drawingPoints.length === 0) {
                        statusEl.textContent = 'Çizim Başladı';
                        statusEl.style.color = '#FF9800';
                    } else if (window.drawingPoints.length < 3) {
                        statusEl.textContent = 'Nokta Ekleniyor';
                        statusEl.style.color = '#2196F3';
                    } else {
                        statusEl.textContent = window.isDragging ? 'Sürükleniyor...' : 'Alan Tamamlandı';
                        statusEl.style.color = window.isDragging ? '#FF5722' : '#4CAF50';
                    }
                }
            }
            
            // Nokta içinde polygon kontrolü (basitleştirilmiş ray casting algoritması)
            function isPointInsidePolygon(lat, lng, polygonPoints) {
                let inside = false;
                for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
                    const xi = polygonPoints[i].polygonPointLatitude;
                    const yi = polygonPoints[i].polygonPointLongitude;
                    const xj = polygonPoints[j].polygonPointLatitude;
                    const yj = polygonPoints[j].polygonPointLongitude;
                    
                    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
                        inside = !inside;
                    }
                }
                return inside;
            }
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // Kullanıcının mevcut konumu (mavi marker)
            var userIcon = L.icon({
                iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="blue"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'),
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            });
            
            window.userMarker = L.marker([${lat}, ${lng}], {icon: userIcon}).addTo(map)
                .bindPopup('<div class="device-popup"><div class="popup-title">Mevcut Konumunuz</div></div>');
            
            // Yönlü cihaz ikonu oluşturma fonksiyonu
            function createDirectionalDeviceIcon(yaw = 0, isOnline = true) {
                const color = '#e74c3c'; // Kırmızı renk
                
                // Yaw değerini normalize et (0-360 arası)
                const normalizedYaw = ((yaw % 360) + 360) % 360;
                
                // Büyütülmüş triangle - 30x30 boyut
                const triangleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30" style="overflow: visible;">' +
                    '<path d="M15 3 L24 24 L15 20 L6 24 Z" fill="' + color + '" stroke="#fff" stroke-width="1.5"' +
                    ' transform="rotate(' + normalizedYaw + ' 15 15)"' +
                    ' style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5))"/>' +
                    '</svg>';
                
                return L.divIcon({
                    className: 'triangle-device-icon',
                    html: triangleSvg,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15] // Tam merkez noktası
                });
            }
            
            // Varsayılan cihaz ikonu (eski sistem için backup)
            var deviceIcon = createDirectionalDeviceIcon(0, true);

            // Polygon verileri
            const polygonData = ${JSON.stringify(polygons)};
            const polygonPointsData = ${JSON.stringify(polygonPoints)};
            
            // Mevcut polygonları yükle
            loadExistingPolygons();
            
            // Polygon çizim fonksiyonları
            function loadExistingPolygons() {
                polygonData.forEach(polygon => {
                    const points = polygonPointsData
                        .filter(point => point.polygonId === polygon.polygonId)
                        .sort((a, b) => parseInt(a.polygonPointOrder) - parseInt(b.polygonPointOrder))
                        .map(point => [point.polygonPointLatitude, point.polygonPointLongitude]);
                    
                    if (points.length >= 3) {
                        // Passive durum - sadece görsel gösterim
                        const leafletPolygon = L.polygon(points, {
                            color: '#e67e22',
                            fillColor: '#f39c12',
                            fillOpacity: 0.2,
                            weight: 2,
                            className: 'passive-polygon'
                        }).addTo(map);
                        
                        // Popup ekle
                        leafletPolygon.bindPopup(
                            '<div class="polygon-popup">' +
                            '<div class="polygon-title">🔒 ' + polygon.polygonName + '</div>' +
                            '<div class="polygon-info"><strong>Oluşturma:</strong> ' + new Date(polygon.polygonCreatedTime).toLocaleDateString('tr-TR') + '</div>' +
                            '<div class="polygon-info"><strong>Nokta Sayısı:</strong> ' + points.length + '</div>' +
                            '<div class="polygon-info"><strong>Durum:</strong> <span style="color: #95a5a6;">Pasif Görünüm</span></div>' +
                            '<button class="edit-polygon-btn" onclick="activatePolygonEdit(' + polygon.polygonId + ')">Düzenle</button>' +
                            '</div>'
                        );
                        
                        // Double click ile aktif düzenleme moduna geç
                        leafletPolygon.on('dblclick', function() {
                            activatePolygonEdit(polygon.polygonId);
                        });
                        
                        window.polygons.push({
                            leafletPolygon: leafletPolygon,
                            data: polygon,
                            points: points,
                            isActive: false // Passive durum
                        });
                    }
                });
                
                console.log('📐 ' + window.polygons.length + ' güvenli alan yüklendi (pasif mod)');
            }
            
            // Polygon düzenleme modunu aktifleştir
            function activatePolygonEdit(polygonId) {
                // Tüm polygonları passive yap
                deactivateAllPolygons();
                
                // Belirtilen polygon'u active yap
                const polygonObj = window.polygons.find(p => p.data.polygonId === polygonId);
                if (!polygonObj) return;
                
                // Passive polygon'u kaldır
                map.removeLayer(polygonObj.leafletPolygon);
                
                // Active polygon oluştur (sürüklenebilir noktalarla)
                const activePolygon = L.polygon(polygonObj.points, {
                    color: '#3498db',
                    fillColor: '#3498db',
                    fillOpacity: 0.3,
                    weight: 3,
                    className: 'active-polygon'
                }).addTo(map);
                
                // Sürüklenebilir noktaları ekle
                const editablePoints = [];
                polygonObj.points.forEach((point, index) => {
                    const editPoint = L.circleMarker(point, {
                        color: '#3498db',
                        fillColor: '#3498db',
                        fillOpacity: 0.9,
                        radius: 10,
                        weight: 3,
                        className: 'editable-point'
                    }).addTo(map);
                    
                    // Nokta numarası etiketi
                    const pointLabel = L.divIcon({
                        className: 'edit-point-label',
                        html: '<div style="background: #3498db; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); cursor: move;">' + (index + 1) + '</div>',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    
                    const labelMarker = L.marker(point, {icon: pointLabel}).addTo(map);
                    
                    // Sürükle-bırak işlevselliği
                    makeExistingPointDraggable(editPoint, labelMarker, index, polygonObj, activePolygon);
                    makeExistingPointDraggable(labelMarker, editPoint, index, polygonObj, activePolygon);
                    
                    editablePoints.push(editPoint, labelMarker);
                });
                
                // Polygon objesini güncelle
                polygonObj.leafletPolygon = activePolygon;
                polygonObj.editablePoints = editablePoints;
                polygonObj.isActive = true;
                
                // Popup güncelle
                activePolygon.bindPopup(
                    '<div class="polygon-popup">' +
                    '<div class="polygon-title">' + polygonObj.data.polygonName + ' (Düzenleme)</div>' +
                    '<div class="polygon-info"><strong>Durum:</strong> <span style="color: #3498db;">Aktif Düzenleme</span></div>' +
                    '<div class="polygon-info"><strong>Nokta Sayısı:</strong> ' + polygonObj.points.length + '</div>' +
                    '<button class="save-polygon-btn" onclick="savePolygonChanges(' + polygonId + ')">💾 Kaydet</button>' +
                    '<button class="cancel-edit-btn" onclick="deactivatePolygonEdit(' + polygonId + ')">❌ İptal</button>' +
                    '</div>'
                );
                
                // Haritayı polygon'a odakla
                map.fitBounds(activePolygon.getBounds(), {
                    padding: [20, 20],
                    maxZoom: 16
                });
                
                console.log('✏️ Polygon düzenleme modu aktif:', polygonObj.data.polygonName);
            }
            
            // Tüm polygonları passive yap
            function deactivateAllPolygons() {
                window.polygons.forEach(polygonObj => {
                    if (polygonObj.isActive) {
                        deactivatePolygonEdit(polygonObj.data.polygonId);
                    }
                });
            }
            
            // Polygon düzenleme modunu kapat
            function deactivatePolygonEdit(polygonId) {
                const polygonObj = window.polygons.find(p => p.data.polygonId === polygonId);
                if (!polygonObj || !polygonObj.isActive) return;
                
                // Editable noktaları kaldır
                if (polygonObj.editablePoints) {
                    polygonObj.editablePoints.forEach(point => {
                        map.removeLayer(point);
                    });
                    delete polygonObj.editablePoints;
                }
                
                // Active polygon'u kaldır
                map.removeLayer(polygonObj.leafletPolygon);
                
                // Passive polygon'u tekrar ekle
                const passivePolygon = L.polygon(polygonObj.points, {
                    color: '#e67e22',
                    fillColor: '#f39c12',
                    fillOpacity: 0.2,
                    weight: 2,
                    className: 'passive-polygon'
                }).addTo(map);
                
                passivePolygon.bindPopup(
                    '<div class="polygon-popup">' +
                    '<div class="polygon-title">🔒 ' + polygonObj.data.polygonName + '</div>' +
                    '<div class="polygon-info"><strong>Oluşturma:</strong> ' + new Date(polygonObj.data.polygonCreatedTime).toLocaleDateString('tr-TR') + '</div>' +
                    '<div class="polygon-info"><strong>Nokta Sayısı:</strong> ' + polygonObj.points.length + '</div>' +
                    '<div class="polygon-info"><strong>Durum:</strong> <span style="color: #95a5a6;">Pasif Görünüm</span></div>' +
                    '<button class="edit-polygon-btn" onclick="activatePolygonEdit(' + polygonObj.data.polygonId + ')">Düzenle</button>' +
                    '</div>'
                );
                
                passivePolygon.on('dblclick', function() {
                    activatePolygonEdit(polygonId);
                });
                
                polygonObj.leafletPolygon = passivePolygon;
                polygonObj.isActive = false;
                
                console.log('🔒 Polygon pasif moda alındı:', polygonObj.data.polygonName);
            }
            
            // Var olan polygon noktaları için sürükle-bırak
            function makeExistingPointDraggable(marker, partnerMarker, pointIndex, polygonObj, activePolygon) {
                let isDragging = false;
                
                marker.on('mousedown touchstart', function(e) {
                    isDragging = true;
                    map.dragging.disable();
                    e.originalEvent.preventDefault();
                });
                
                map.on('mousemove touchmove', function(e) {
                    if (isDragging) {
                        const newLatLng = e.latlng;
                        marker.setLatLng(newLatLng);
                        partnerMarker.setLatLng(newLatLng);
                        
                        // Koordinatları güncelle
                        polygonObj.points[pointIndex] = [newLatLng.lat, newLatLng.lng];
                        
                        // Polygon'u yeniden çiz
                        const newLatLngs = polygonObj.points.map(p => [p[0], p[1]]);
                        activePolygon.setLatLngs(newLatLngs);
                    }
                });
                
                map.on('mouseup touchend', function(e) {
                    if (isDragging) {
                        isDragging = false;
                        map.dragging.enable();
                    }
                });
            }
            
            // Polygon değişikliklerini kaydet
            function savePolygonChanges(polygonId) {
                const polygonObj = window.polygons.find(p => p.data.polygonId === polygonId);
                if (!polygonObj || !polygonObj.isActive) return;
                
                // React Native'e güncellenen polygon bilgilerini gönder
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'updatePolygon',
                        polygonId: polygonId,
                        points: polygonObj.points,
                        polygonData: polygonObj.data
                    }));
                }
                
                console.log('💾 Polygon değişiklikleri kaydediliyor:', polygonObj.data.polygonName);
            }
            
            // Çizim modunu aç/kapat
            function toggleDrawingMode() {
                window.isDrawingMode = !window.isDrawingMode;
                const btn = document.getElementById('drawPolygonBtn');
                const saveBtn = document.getElementById('savePolygonBtn');
                const infoPanel = document.getElementById('drawingInfoPanel');
                const extraControls = document.getElementById('extraControls');
                
                // React Native'e çizim modu durumunu bildir
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'drawingModeChanged',
                        isDrawingMode: window.isDrawingMode
                    }));
                }
                
                if (window.isDrawingMode) {
                    btn.textContent = 'Çizimi İptal Et';
                    btn.classList.add('active');
                    saveBtn.style.display = 'inline-block';
                    infoPanel.style.display = 'block';
                    extraControls.style.display = 'flex';
                    map.getContainer().style.cursor = 'crosshair';
                    
                    // Çift tıklama ile yakınlaştırma özelliğini kapat
                    map.doubleClickZoom.disable();
                    
                    // Tıklama olayını başlat
                    map.on('click', onMapClick);
                } else {
                    btn.textContent = 'Alan Çiz';
                    btn.classList.remove('active');
                    saveBtn.style.display = 'none';
                    infoPanel.style.display = 'none';
                    extraControls.style.display = 'none';
                    map.getContainer().style.cursor = '';
                    
                    // Çift tıklama ile yakınlaştırma özelliğini tekrar aç
                    map.doubleClickZoom.enable();
                    
                    // Tıklama olayını durdur
                    map.off('click', onMapClick);
                    
                    // Geçici çizimi temizle
                    resetDrawing();
                }
                
                updateInfoPanel();
            }
            
            // Harita tıklama olayı
            function onMapClick(e) {
                if (!window.isDrawingMode) return;
                
                const point = [e.latlng.lat, e.latlng.lng];
                window.drawingPoints.push(point);
                
                // Geçici polygon çiz
                if (window.currentDrawingPolygon) {
                    map.removeLayer(window.currentDrawingPolygon);
                }
                
                if (window.drawingPoints.length >= 3) {
                    window.currentDrawingPolygon = L.polygon(window.drawingPoints, {
                        color: '#27ae60',
                        fillColor: '#2ecc71',
                        fillOpacity: 0.3,
                        weight: 2,
                        dashArray: '5, 5'
                    }).addTo(map);
                } else if (window.drawingPoints.length >= 2) {
                    window.currentDrawingPolygon = L.polyline(window.drawingPoints, {
                        color: '#27ae60',
                        weight: 2,
                        dashArray: '5, 5'
                    }).addTo(map);
                }
                
                // Sürüklenebilir nokta marker'ı ekle
                const pointMarker = L.circleMarker(point, {
                    color: '#27ae60',
                    fillColor: '#2ecc71',
                    fillOpacity: 0.8,
                    radius: 8,
                    weight: 2
                }).addTo(map);
                
                // Sürükle-bırak işlevselliği ekle
                makePointDraggable(pointMarker, window.drawingPoints.length - 1);
                
                // Nokta numarası etiketi ekle
                const pointLabel = L.divIcon({
                    className: 'point-label',
                    html: '<div style="background: #27ae60; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: move;">' + window.drawingPoints.length + '</div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                
                const labelMarker = L.marker(point, {icon: pointLabel}).addTo(map);
                
                // Etiket için de sürükle-bırak ekle
                makePointDraggable(labelMarker, window.drawingPoints.length - 1);
                
                // Geçici marker'ları sakla
                window.tempMarkers.push(pointMarker, labelMarker);
                
                // Bilgi panelini güncelle
                updateInfoPanel();
            }
            
            // Nokta sürükle-bırak işlevselliği
            function makePointDraggable(marker, pointIndex) {
                let isDragging = false;
                
                marker.on('mousedown touchstart', function(e) {
                    isDragging = true;
                    window.isDragging = true;
                    window.draggedPointIndex = pointIndex;
                    map.dragging.disable();
                    e.originalEvent.preventDefault();
                });
                
                map.on('mousemove touchmove', function(e) {
                    if (isDragging && window.draggedPointIndex === pointIndex) {
                        const newLatLng = e.latlng;
                        marker.setLatLng(newLatLng);
                        
                        // Koordinatları güncelle
                        window.drawingPoints[pointIndex] = [newLatLng.lat, newLatLng.lng];
                        
                        // Polygon'u yeniden çiz
                        if (window.currentDrawingPolygon) {
                            map.removeLayer(window.currentDrawingPolygon);
                        }
                        
                        if (window.drawingPoints.length >= 3) {
                            window.currentDrawingPolygon = L.polygon(window.drawingPoints, {
                                color: '#27ae60',
                                fillColor: '#2ecc71',
                                fillOpacity: 0.3,
                                weight: 2,
                                dashArray: '5, 5'
                            }).addTo(map);
                        } else if (window.drawingPoints.length >= 2) {
                            window.currentDrawingPolygon = L.polyline(window.drawingPoints, {
                                color: '#27ae60',
                                weight: 2,
                                dashArray: '5, 5'
                            }).addTo(map);
                        }
                        
                        // Diğer marker'ları da güncelle
                        updatePointMarkers();
                        
                        // Bilgi panelini güncelle
                        updateInfoPanel();
                    }
                });
                
                map.on('mouseup touchend', function(e) {
                    if (isDragging && window.draggedPointIndex === pointIndex) {
                        isDragging = false;
                        window.isDragging = false;
                        window.draggedPointIndex = null;
                        map.dragging.enable();
                    }
                });
            }
            
            // Nokta marker'larını güncelle
            function updatePointMarkers() {
                // Tüm geçici marker'ları temizle
                window.tempMarkers.forEach(marker => {
                    map.removeLayer(marker);
                });
                window.tempMarkers = [];
                
                // Yeni marker'ları oluştur
                window.drawingPoints.forEach((point, index) => {
                    // Nokta marker'ı
                    const pointMarker = L.circleMarker(point, {
                        color: '#27ae60',
                        fillColor: '#2ecc71',
                        fillOpacity: 0.8,
                        radius: 8,
                        weight: 2
                    }).addTo(map);
                    
                    makePointDraggable(pointMarker, index);
                    
                    // Nokta numarası etiketi
                    const pointLabel = L.divIcon({
                        className: 'point-label',
                        html: '<div style="background: #27ae60; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: move;">' + (index + 1) + '</div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    
                    const labelMarker = L.marker(point, {icon: pointLabel}).addTo(map);
                    makePointDraggable(labelMarker, index);
                    
                    window.tempMarkers.push(pointMarker, labelMarker);
                });
            }
            
            // Polygon kaydet
            function saveCurrentPolygon() {
                if (window.drawingPoints.length < 3) {
                    alert('En az 3 nokta gerekli!');
                    return;
                }
                
                // React Native'e polygon verilerini gönder
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'savePolygon',
                        points: window.drawingPoints
                    }));
                }
                
                // Çizim modunu manuel olarak kapat (yakınlaştırma olmadan)
                window.isDrawingMode = false;
                const btn = document.getElementById('drawPolygonBtn');
                const saveBtn = document.getElementById('savePolygonBtn');
                const infoPanel = document.getElementById('drawingInfoPanel');
                const extraControls = document.getElementById('extraControls');
                
                btn.textContent = 'Alan Çiz';
                btn.classList.remove('active');
                saveBtn.style.display = 'none';
                infoPanel.style.display = 'none';
                extraControls.style.display = 'none';
                map.getContainer().style.cursor = '';
                
                // Çift tıklama ile yakınlaştırma özelliğini tekrar aç
                map.doubleClickZoom.enable();
                
                // Tıklama olayını durdur
                map.off('click', onMapClick);
                
                // Geçici çizimi temizle
                resetDrawing();
                updateInfoPanel();
            }
            
            // Son noktayı geri al
            function undoLastPoint() {
                if (window.drawingPoints.length === 0) return;
                
                // Son noktayı kaldır
                window.drawingPoints.pop();
                
                // Tüm marker'ları temizle ve yeniden oluştur
                updatePointMarkers();
                
                // Polygon'u yeniden çiz
                if (window.currentDrawingPolygon) {
                    map.removeLayer(window.currentDrawingPolygon);
                    window.currentDrawingPolygon = null;
                }
                
                if (window.drawingPoints.length >= 3) {
                    window.currentDrawingPolygon = L.polygon(window.drawingPoints, {
                        color: '#27ae60',
                        fillColor: '#2ecc71',
                        fillOpacity: 0.3,
                        weight: 2,
                        dashArray: '5, 5'
                    }).addTo(map);
                } else if (window.drawingPoints.length >= 2) {
                    window.currentDrawingPolygon = L.polyline(window.drawingPoints, {
                        color: '#27ae60',
                        weight: 2,
                        dashArray: '5, 5'
                    }).addTo(map);
                }
                
                updateInfoPanel();
            }
            
            // Çizimi sıfırla
            function resetDrawing() {
                // Geçici çizimi temizle
                if (window.currentDrawingPolygon) {
                    map.removeLayer(window.currentDrawingPolygon);
                    window.currentDrawingPolygon = null;
                }
                
                // Tüm geçici marker'ları temizle
                window.tempMarkers.forEach(marker => {
                    map.removeLayer(marker);
                });
                window.tempMarkers = [];
                
                // Çizim noktalarını temizle
                window.drawingPoints = [];
                window.draggedPointIndex = null;
                window.isDragging = false;
                
                updateInfoPanel();
            }
            
            // Çizimi onayla (Kaydet butonuna alternatif)
            function confirmDrawing() {
                if (window.drawingPoints.length < 3) {
                    alert('Alan oluşturmak için en az 3 nokta gerekli!');
                    return;
                }
                
                // Onaylama mesajı göster
                const deviceCount = deviceData.filter(device => {
                    if (!device.isOnline) return false;
                    return isPointInsidePolygon(device.lat, device.lng, window.drawingPoints.map(p => ({
                        polygonPointLatitude: p[0],
                        polygonPointLongitude: p[1]
                    })));
                }).length;
                
                const confirmMsg = 'Bu alanı kaydetmek istediğinizden emin misiniz?\\n\\n' +
                                 '• Nokta Sayısı: ' + window.drawingPoints.length + '\\n' +
                                 '• Alan İçindeki Cihaz: ' + deviceCount + '\\n\\n' +
                                 'Onaylıyor musunuz?';
                
                if (confirm(confirmMsg)) {
                    // React Native'e polygon verilerini gönder
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'savePolygon',
                            points: window.drawingPoints,
                            deviceCount: deviceCount
                        }));
                    }
                    
                    // Çizim modunu manuel olarak kapat (yakınlaştırma olmadan)
                    window.isDrawingMode = false;
                    const btn = document.getElementById('drawPolygonBtn');
                    const saveBtn = document.getElementById('savePolygonBtn');
                    const infoPanel = document.getElementById('drawingInfoPanel');
                    const extraControls = document.getElementById('extraControls');
                    
                    btn.textContent = 'Alan Çiz';
                    btn.classList.remove('active');
                    saveBtn.style.display = 'none';
                    infoPanel.style.display = 'none';
                    extraControls.style.display = 'none';
                    map.getContainer().style.cursor = '';
                    
                    // Çift tıklama ile yakınlaştırma özelliğini tekrar aç
                    map.doubleClickZoom.enable();
                    
                    // Tıklama olayını durdur
                    map.off('click', onMapClick);
                    
                    // Geçici çizimi temizle
                    resetDrawing();
                    updateInfoPanel();
                } else {
                    // Kullanıcı iptal etti, çizime devam edebilir
                    console.log('Kullanıcı alan kaydını iptal etti');
                }
            }
            
            // Yardım göster
            function showHelp() {
                alert('🎯 Alan Çizimi Rehberi\\n\\n' +
                      '📍 Nokta Ekleme:\\n' +
                      '• Harita üzerine tıklayarak nokta ekleyin\\n' +
                      '• Her nokta numaralandırılır\\n' +
                      '• En az 3 nokta gereklidir\\n\\n' +
                      '🛠️ Düzenleme Araçları:\\n' +
                      '• "Geri Al": Son noktayı siler\\n' +
                      '• "Sıfırla": Tüm çizimi temizler\\n' +
                      '• "Onayla": Alanı kaydetmeye hazırlar\\n\\n' +
                      '📊 Bilgi Paneli:\\n' +
                      '• Sağ üstte canlı bilgiler\\n' +
                      '• Nokta sayısı ve alan içi cihaz sayısı\\n' +
                      '• Çizim durumu takibi\\n\\n' +
                      '💾 Kaydetme:\\n' +
                      '• "Onayla" veya "Kaydet" ile tamamlayın\\n' +
                      '• Alan adı vermeniz istenecek');
            }
            
            // Tüm polygonları temizle
            function clearAllPolygons() {
                if (confirm('Tüm güvenli alanları silmek istediğinizden emin misiniz?')) {
                    window.polygons.forEach(polygon => {
                        map.removeLayer(polygon.leafletPolygon);
                    });
                    window.polygons = [];
                    
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'clearAllPolygons'
                        }));
                    }
                }
            }
            
            // Başlangıç bilgi paneli güncelleme
            updateInfoPanel();

            // Cihazları haritaya ekle
            ${deviceLocations.map((deviceLoc, index) => `
                // Cihaz için yönlü ikon oluştur
                var deviceYaw${index} = ${deviceLoc.sensorData?.deviceSensorYaw || 0};
                var deviceOnline${index} = ${deviceLoc.sensorData?.isOnline || false};
                var triangleIcon${index} = createDirectionalDeviceIcon(deviceYaw${index}, deviceOnline${index});
                
                // Cihaz marker'ı
                var deviceMarker${index} = L.marker([${deviceLoc.lat}, ${deviceLoc.lng}], {icon: triangleIcon${index}}).addTo(map);
                
                // Global referansa ekle
                window.deviceMarkers['${deviceLoc.device.deviceId}'] = deviceMarker${index};
                
                var popupContent${index} = \`
                    <div class="device-popup">
                        <div class="popup-title">📱 ${deviceLoc.device.deviceName}</div>
                        <div class="popup-info"><strong>Durum:</strong> <span style="color: ${deviceLoc.sensorData?.isOnline ? 'green' : 'red'};">${deviceLoc.sensorData?.isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}</span></div>
                        <div class="popup-info"><strong>Hayvan:</strong> ${deviceLoc.animal?.animalName || 'Bağlı değil'}</div>
                        <div class="popup-info"><strong>MAC:</strong> ${deviceLoc.device.deviceMacAdress}</div>
                        ${deviceLoc.sensorData ? `
                        <div class="popup-info"><strong>GPS:</strong> ${deviceLoc.sensorData.deviceSensorLatitude?.toFixed(5) || 'N/A'}, ${deviceLoc.sensorData.deviceSensorLongitude?.toFixed(5) || 'N/A'}</div>
                        <div class="popup-info"><strong>Batarya:</strong> ${deviceLoc.sensorData.deviceSensorBatteryStatus || 'N/A'}%</div>
                        <div class="popup-info"><strong>İvme:</strong> ${deviceLoc.sensorData.deviceSensorAccelaration || 'N/A'} m/s²</div>
                        <div class="popup-info"><strong>Yön (Yaw):</strong> ${deviceLoc.sensorData.deviceSensorYaw || 'N/A'}°</div>
                        ${(deviceLoc.sensorData.deviceSensorValidateDate || deviceLoc.sensorData.deviceSensorValidDate || deviceLoc.sensorData.timestamp) ? `
                        <div class="popup-info"><strong>Son GPS:</strong> ${new Date(deviceLoc.sensorData.deviceSensorValidateDate || deviceLoc.sensorData.deviceSensorValidDate || deviceLoc.sensorData.timestamp).toLocaleString('tr-TR', { 
                            day: '2-digit', month: '2-digit', 
                            hour: '2-digit', minute: '2-digit' 
                        })}</div>
                        ` : ''}
                        ` : '<div class="popup-info">ESP32 sensor verisi yok</div>'}
                        <button class="popup-button" onclick="console.log('Button clicked for device: ${deviceLoc.device.deviceId}'); if(window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({type: 'deviceClick', deviceId: '${deviceLoc.device.deviceId}'})); }">
                            Tasma Detayları
                        </button>
                    </div>
                \`;
                
                deviceMarker${index}.bindPopup(popupContent${index});
            `).join('')}
            
            // Konum güncellendiğinde çağrılacak fonksiyon
            window.updateLocation = function(newLat, newLng) {
                map.panTo([newLat, newLng]);
                if (window.userMarker) {
                    window.userMarker.setLatLng([newLat, newLng]);
                }
            };
            
            // Cihaza animasyonlu olarak gitme fonksiyonu
            window.flyToDevice = function(deviceLat, deviceLng, deviceName) {
                console.log('Flying to device:', deviceName, 'at', deviceLat, deviceLng);
                map.flyTo([deviceLat, deviceLng], 18, {
                    animate: true,
                    duration: 2.0 // 2 saniye animasyon
                });
            };
        </script>
    </body>
    </html>
    `;
  };

  const refreshLocation = async () => {
    if (locationLoading) return; // Zaten işlem devam ediyorsa çık
    
    try {
      setLocationLoading(true); // Loading başlat
      setErrorMsg(null);
      
      // Önce konum izinlerini kontrol et
      let { status } = await Location.getForegroundPermissionsAsync();
      console.log('📍 Mevcut konum izin durumu:', status);
      
      if (status !== 'granted') {
        // İzin yoksa tekrar iste
        console.log('📍 Konum izni yok, tekrar isteniyor...');
        let { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') {
          setErrorMsg('Konum izni gerekli');
          Alert.alert('Konum İzni', 'Harita özelliklerini kullanabilmek için konum izni vermeniz gerekiyor.');
          return;
        }
      }
      
      // Konum servislerinin açık olup olmadığını kontrol et
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      console.log('📍 Konum servisleri durumu:', isLocationEnabled);
      
      if (!isLocationEnabled) {
        setErrorMsg('Konum servisleri kapalı');
        Alert.alert('Konum Servisleri', 'Lütfen cihazınızın konum servislerini açın.');
        return;
      }
      
      console.log('📍 Konum alınmaya başlandı...');
      
      let newLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000, // 15 saniye timeout
        maximumAge: 10000, // 10 saniye önce alınan konum kabul edilir
      });
      
      console.log('📍 Yeni konum alındı:', {
        lat: newLocation.coords.latitude.toFixed(6),
        lng: newLocation.coords.longitude.toFixed(6),
        accuracy: newLocation.coords.accuracy
      });
      
      const userLocation = {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setLocation(userLocation);
      
      // WebView kontrolü
      if (!mapReady) {
        console.log('📍 Harita henüz hazır değil');
        setErrorMsg('Harita yükleniyor, lütfen bekleyin');
        return;
      }
      
      if (!webViewRef?.current) {
        console.log('📍 WebView referansı yok');
        setErrorMsg('Harita bağlantısı kurulamadı');
        return;
      }
      
      // Haritayı kullanıcının konumuna animasyonlu olarak götür
      console.log('📍 Harita konumu güncelleniyor...');
      const script = `
        try {
          if (window.map && window.map.flyTo) {
            // Kullanıcının yeni konumuna animasyonlu hareket ve zoom
            window.map.flyTo([${userLocation.latitude}, ${userLocation.longitude}], 18, {
              animate: true,
              duration: 2.0
            });
            
            // Kullanıcı marker'ını da güncelle
            if (window.userMarker) {
              window.userMarker.setLatLng([${userLocation.latitude}, ${userLocation.longitude}]);
            }
            
            console.log('Kullanıcı konumuna animasyonlu hareket tamamlandı');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('Konum başarıyla güncellendi');
            }
          } else {
            console.error('Harita objesi bulunamadı');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('Harita objesi hatası');
            }
          }
        } catch (error) {
          console.error('Konum animasyonu hatası:', error);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('Animasyon hatası: ' + error.message);
          }
        }
      `;
      webViewRef.current.injectJavaScript(script);
      
      // Başarı mesajı
      console.log('📍 Konum güncelleme işlemi tamamlandı');
      
    } catch (error) {
      console.error('📍 Konum yenileme hatası:', error);
      
      // Hata tipine göre kullanıcı dostu mesaj
      if (error.code === 'E_LOCATION_TIMEOUT') {
        setErrorMsg('Konum alınamadı - Zaman aşımı');
      } else if (error.code === 'E_LOCATION_UNAVAILABLE') {
        setErrorMsg('Konum servisi kullanılamıyor');
      } else if (error.code === 'E_LOCATION_DENIED') {
        setErrorMsg('Konum izni reddedildi');
      } else {
        setErrorMsg('Konum güncellenemedi - Tekrar deneyin');
      }
    } finally {
      setLocationLoading(false); // Loading sonlandır
    }
  };

  // WebView'den gelen mesajları işle
  const handleWebViewMessage = (event) => {
    try {
      const messageData = event.nativeEvent.data;
      // console.log('WebView mesajı alındı:', messageData);
      
      // DeviceClick mesajı değilse return et
      if (typeof messageData === 'string') {
        if (messageData.includes('WebView JavaScript çalışıyor') || 
            messageData.includes('flyToDevice') || 
            messageData.includes('Manuel flyTo') ||
            messageData.includes('Konum güncellemeleri') ||
            messageData.includes('konumu güncellendi') ||
            messageData.includes('Marker güncellemeleri') ||
            messageData.includes('JavaScript hatası') ||
            messageData.includes('📍')) {
          return;
        }
      }

      // JSON parse denemeye çalış
      let message;
      try {
        message = JSON.parse(messageData);
      } catch (parseError) {
        // console.log('JSON parse hatası, string mesaj:', messageData);
        return;
      }

      // console.log('Parsed WebView mesajı:', message);
      
      if (message.type === 'deviceClick') {
        // console.log('Tıklanan cihaz ID:', message.deviceId);
        // console.log('Mevcut filtrelenmiş cihazlar:', filteredDevices.map(d => ({ id: d.deviceId, name: d.deviceName })));
        
        // Device ID'yi string olarak karşılaştır
        const clickedDeviceId = message.deviceId?.toString();
        const device = filteredDevices.find(d => d.deviceId?.toString() === clickedDeviceId);
        // console.log('Bulunan cihaz:', device);
        
        if (device) {
          // Bu cihaza ait sensor verilerini bul
          const deviceSensorData = deviceSensors
            .filter(sensor => {
              const sensorDeviceId = sensor.deviceId?.toString();
              const deviceId = device.deviceId?.toString();
              const match = sensorDeviceId === deviceId;
              // console.log(`Modal sensor kontrolü: "${sensorDeviceId}" === "${deviceId}" = ${match}`);
              return match;
            })
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
          
          // console.log('Bulunan sensor verileri:', deviceSensorData);
          
          // Cihaza bağlı hayvanı bul
          const connectedAnimal = animals.find(animal => animal.animalId === device.animalId);
          
          setSelectedDevice({
            ...device,
            sensorData: deviceSensorData,
            animal: connectedAnimal
          });
          setModalVisible(true);
        } else {
          // console.log('Cihaz bulunamadı! Aranan ID:', message.deviceId);
          // console.log('Aranan ID tipi:', typeof message.deviceId);
          // console.log('Mevcut filtrelenmiş cihaz ID\'leri ve tipleri:', filteredDevices.map(d => ({ 
          //   id: d.deviceId, 
          //   type: typeof d.deviceId, 
          //   name: d.deviceName 
          // })));
          Alert.alert('Hata', 'Cihaz bulunamadı');
        }
      } else if (message.type === 'savePolygon') {
        // Polygon kaydetme
        if (message.points && message.points.length >= 3) {
          setCurrentDrawingPoints(message.points);
          setPolygonModalVisible(true);
        }
      } else if (message.type === 'updatePolygon') {
        // Var olan polygon güncelleme
        handleUpdatePolygon(message.polygonId, message.points, message.polygonData);
      } else if (message.type === 'clearAllPolygons') {
        // Tüm polygonları sil
        handleClearAllPolygons();
      } else if (message.type === 'drawingModeChanged') {
        // Çizim modu durumu değişti
        setIsDrawingMode(message.isDrawingMode);
      }
    } catch (error) {
      console.error('WebView mesajı işlenirken hata:', error);
    }
  };

  // Polygon güncelleme fonksiyonu
  const handleUpdatePolygon = async (polygonId, updatedPoints, polygonData) => {
    try {
      console.log('🔄 Polygon güncelleniyor...', {
        polygonId: polygonId,
        name: polygonData.polygonName,
        pointCount: updatedPoints.length
      });

      // Polygon bilgilerini güncelle
      const updatePolygonData = {
        polygonId: polygonId,
        polygonName: polygonData.polygonName,
        polygonCreatedTime: polygonData.polygonCreatedTime,
        userId: userId
      };

      await updatePolygon(updatePolygonData);
      console.log('✅ Polygon güncellendi');

      // Eski polygon noktalarını sil
      const oldPoints = await getPolygonPointsByPolygonId(polygonId);
      for (const point of oldPoints) {
        await deletePolygonPoint(point.polygonPointId);
      }
      console.log('🗑️ Eski polygon noktaları silindi');

      // Yeni polygon noktalarını kaydet
      for (let i = 0; i < updatedPoints.length; i++) {
        const point = updatedPoints[i];
        const pointData = {
          polygonPointOrder: (i + 1).toString(),
          polygonPointLatitude: point[0],
          polygonPointLongitude: point[1],
          polygonId: polygonId
        };

        await createPolygonPoint(pointData);
      }
      console.log('✅ Yeni polygon noktaları kaydedildi');

      Alert.alert('Başarılı', `"${polygonData.polygonName}" adlı güvenli alan güncellendi`);
      
      // Polygon verilerini yeniden yükle
      await loadPolygonData(userId, userRole);
      
      // Haritayı yeniden oluştur
      const html = generateMapHTML(location.latitude, location.longitude, devices, deviceSensors, animals, userId, userRole);
      setMapHTML(html);

      // Edit polygon'u kaldır
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.editPolygon) {
            window.map.removeLayer(window.editPolygon);
            window.editPolygon = null;
          }
          // Güncellenen polygon'u passive moda al
          deactivatePolygonEdit(${polygonId});
        `);
      }

    } catch (error) {
      console.error('❌ Polygon güncellenirken hata:', error);
      Alert.alert('Hata', 'Polygon güncellenemedi: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  // Polygon kaydetme fonksiyonu
  const handleSavePolygon = async () => {
    if (!newPolygonName.trim()) {
      Alert.alert('Hata', 'Lütfen alan adı girin');
      return;
    }

    if (!currentDrawingPoints || currentDrawingPoints.length < 3) {
      Alert.alert('Hata', 'En az 3 nokta gerekli');
      return;
    }

    try {
      if (isEditMode && editingPolygon) {
        // Düzenleme modu - mevcut polygon'u güncelle
        console.log('🔄 Polygon güncelleniyor...', {
          polygonId: editingPolygon.polygonId,
          name: newPolygonName.trim(),
          pointCount: currentDrawingPoints.length
        });

        // Polygon bilgilerini güncelle
        const updatePolygonData = {
          polygonId: editingPolygon.polygonId,
          polygonName: newPolygonName.trim(),
          polygonCreatedTime: editingPolygon.polygonCreatedTime,
          userId: userId
        };

        await updatePolygon(updatePolygonData);
        console.log('✅ Polygon güncellendi');

        // Eski polygon noktalarını sil
        const oldPoints = await getPolygonPointsByPolygonId(editingPolygon.polygonId);
        for (const point of oldPoints) {
          await deletePolygonPoint(point.polygonPointId);
        }
        console.log('🗑️ Eski polygon noktaları silindi');

        // Yeni polygon noktalarını kaydet
        for (let i = 0; i < currentDrawingPoints.length; i++) {
          const point = currentDrawingPoints[i];
          const pointData = {
            polygonPointOrder: (i + 1).toString(),
            polygonPointLatitude: point[0],
            polygonPointLongitude: point[1],
            polygonId: editingPolygon.polygonId
          };

          await createPolygonPoint(pointData);
        }
        console.log('✅ Yeni polygon noktaları kaydedildi');

        Alert.alert('Başarılı', `"${newPolygonName}" adlı güvenli alan güncellendi`);

      } else {
        // Yeni polygon oluşturma modu
        console.log('🔄 Polygon kaydediliyor...', {
          name: newPolygonName.trim(),
          pointCount: currentDrawingPoints.length,
          userId: userId
        });

        // Önce polygon oluştur
        const polygonData = {
          polygonName: newPolygonName.trim(),
          polygonCreatedTime: new Date().toISOString(),
          userId: userId
        };

        const polygonResponse = await createPolygon(polygonData);
        console.log('✅ Polygon oluşturuldu:', polygonResponse);

        // API dokümantasyonuna göre response "Başarıyla Eklendi" text döner
        // Yeni oluşturulan polygon'ı bulmak için tüm polygon'ları tekrar yükle
        const allPolygons = await getAllPolygons();
        const newPolygon = allPolygons
          .filter(p => p.userId === userId && p.polygonName === newPolygonName.trim())
          .sort((a, b) => new Date(b.polygonCreatedTime) - new Date(a.polygonCreatedTime))[0];
        
        if (!newPolygon || !newPolygon.polygonId) {
          throw new Error('Oluşturulan polygon bulunamadı');
        }

        console.log('🔍 Yeni polygon bulundu:', newPolygon);

        // Polygon noktalarını sırasıyla kaydet
        for (let i = 0; i < currentDrawingPoints.length; i++) {
          const point = currentDrawingPoints[i];
          const pointData = {
            polygonPointOrder: (i + 1).toString(),
            polygonPointLatitude: point[0],
            polygonPointLongitude: point[1],
            polygonId: newPolygon.polygonId
          };

          console.log(`📍 Nokta ${i + 1} kaydediliyor:`, pointData);
          const pointResponse = await createPolygonPoint(pointData);
          console.log(`✅ Nokta ${i + 1} kaydedildi:`, pointResponse);
        }

        Alert.alert('Başarılı', `"${newPolygonName}" adlı güvenli alan oluşturuldu`);
      }
      
      // State'leri temizle
      setPolygonModalVisible(false);
      setNewPolygonName('');
      setCurrentDrawingPoints([]);
      setIsDrawingMode(false);
      setIsEditMode(false);
      setEditingPolygon(null);
      
      // Polygon verilerini yeniden yükle
      await loadPolygonData(userId, userRole);
      
      // Haritayı yeniden oluştur
      const html = generateMapHTML(location.latitude, location.longitude, devices, deviceSensors, animals, userId, userRole);
      setMapHTML(html);

      // Edit polygon'u kaldır
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.editPolygon) {
            window.map.removeLayer(window.editPolygon);
            window.editPolygon = null;
          }
          if (window.isDrawing) {
            window.isDrawing = false;
            const drawBtn = document.getElementById('drawPolygonBtn');
            const saveBtn = document.getElementById('savePolygonBtn');
            if (drawBtn) drawBtn.style.display = 'block';
            if (saveBtn) saveBtn.style.display = 'none';
          }
        `);
      }

    } catch (error) {
      console.error('❌ Polygon kaydedilirken hata:', error);
      Alert.alert('Hata', 'Alan kaydedilemedi: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  // Polygon silme fonksiyonu
  const handleDeletePolygon = async () => {
    if (!editingPolygon) return;

    try {
      Alert.alert(
        'Güvenli Alan Sil',
        `"${editingPolygon.polygonName}" adlı güvenli alanı silmek istediğinizden emin misiniz?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('🗑️ Polygon siliniyor:', editingPolygon.polygonId);

                // Önce polygon noktalarını sil
                const polygonPoints = await getPolygonPointsByPolygonId(editingPolygon.polygonId);
                for (const point of polygonPoints) {
                  await deletePolygonPoint(point.polygonPointId);
                }
                console.log('✅ Polygon noktaları silindi');

                // Sonra polygon'u sil
                await deletePolygon(editingPolygon.polygonId);
                console.log('✅ Polygon silindi');

                Alert.alert('Başarılı', `"${editingPolygon.polygonName}" adlı güvenli alan silindi`);

                // State'leri temizle
                setPolygonModalVisible(false);
                setNewPolygonName('');
                setCurrentDrawingPoints([]);
                setIsEditMode(false);
                setEditingPolygon(null);

                // Polygon verilerini yeniden yükle
                await loadPolygonData(userId, userRole);

                // Haritayı yeniden oluştur
                const html = generateMapHTML(location.latitude, location.longitude, devices, deviceSensors, animals, userId, userRole);
                setMapHTML(html);

                // Edit polygon'u kaldır ve haritadan silinen polygon'u da kaldır
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(`
                    try {
                      // Edit polygon'u kaldır
                      if (window.editPolygon) {
                        window.map.removeLayer(window.editPolygon);
                        window.editPolygon = null;
                      }
                      
                      // Silinen polygon'u haritadan kaldır
                      if (window.polygons) {
                        window.polygons = window.polygons.filter(polygon => {
                          if (polygon.data.polygonId === ${editingPolygon.polygonId}) {
                            // Bu polygon'u haritadan kaldır
                            if (polygon.leafletPolygon && window.map.hasLayer(polygon.leafletPolygon)) {
                              window.map.removeLayer(polygon.leafletPolygon);
                            }
                            return false; // Array'den kaldır
                          }
                          return true; // Array'de tut
                        });
                        console.log('🗑️ Polygon haritadan kaldırıldı: ${editingPolygon.polygonId}');
                      }
                    } catch (error) {
                      console.error('Polygon haritadan kaldırılırken hata:', error);
                    }
                  `);
                }

              } catch (error) {
                console.error('❌ Polygon silinirken hata:', error);
                Alert.alert('Hata', 'Alan silinemedi: ' + (error.message || 'Bilinmeyen hata'));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Polygon silme işlemi hatası:', error);
    }
  };

  // Tüm polygonları sil
  const handleClearAllPolygons = async () => {
    try {
      Alert.alert(
        'Güvenli Alanları Sil', 
        'Tüm güvenli alanları silmek istediğinizden emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Sil', 
            style: 'destructive',
            onPress: async () => {
              try {
                // Kullanıcının polygonlarını sil
                const userPolygons = userRole === 'admin' ? polygons : polygons.filter(p => p.userId === userId);
                
                for (const polygon of userPolygons) {
                  await deletePolygon(polygon.polygonId);
                }
                
                Alert.alert('Başarılı', 'Tüm güvenli alanlar silindi');
                
                // Polygon verilerini yeniden yükle
                await loadPolygonData(userId, userRole);
                
                // Haritayı yeniden oluştur
                const html = generateMapHTML(location.latitude, location.longitude, devices, deviceSensors, animals, userId, userRole);
                setMapHTML(html);
                
              } catch (error) {
                console.error('Polygonlar silinirken hata:', error);
                Alert.alert('Hata', 'Alanlar silinemedi: ' + (error.message || 'Bilinmeyen hata'));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Polygon silme işlemi hatası:', error);
    }
  };

  // Polygon düzenleme fonksiyonu
  const handlePolygonEdit = async (polygon) => {
    try {
      console.log('🔧 Polygon düzenleme başlatılıyor:', polygon);
      
      // Polygon noktalarını al
      const polygonPoints = await getPolygonPointsByPolygonId(polygon.polygonId);
      console.log('📍 Polygon noktaları:', polygonPoints);
      
      // Polygon noktalarını coordinate formatına çevir
      const coordinates = polygonPoints.map(point => [
        point.polygonPointLatitude,
        point.polygonPointLongitude
      ]);
      
      // State'leri düzenleme moduna ayarla
      setEditingPolygon(polygon);
      setIsEditMode(true);
      setNewPolygonName(polygon.polygonName);
      setCurrentDrawingPoints(coordinates);
      setPolygonModalVisible(true);
      
      // Haritada polygon'u highlight yap
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          // Düzenleme modu için polygon'u vurgula
          if (window.map) {
            const coordinates = ${JSON.stringify(coordinates)};
            
            // Mevcut edit polygon'u varsa kaldır
            if (window.editPolygon) {
              window.map.removeLayer(window.editPolygon);
            }
            
            // Yeni edit polygon'u ekle
            window.editPolygon = L.polygon(coordinates, {
              color: '#ff6b00',
              fillColor: '#ff6b00',
              fillOpacity: 0.3,
              weight: 3,
              dashArray: '10, 5'
            }).addTo(window.map);
            
            // Polygon'a zoom yap
            window.map.fitBounds(window.editPolygon.getBounds(), {
              padding: [20, 20],
              maxZoom: 15
            });
          }
        `);
      }
      
    } catch (error) {
      console.error('❌ Polygon düzenleme hatası:', error);
      Alert.alert('Hata', 'Polygon düzenlenemedi: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  // Cihaza animasyonlu olarak gitme fonksiyonu
  const flyToDevice = (device) => {
    // console.log('flyToDevice çağrıldı:', device.deviceName);
    // console.log('mapReady durumu:', mapReady);
    // console.log('webViewRef durumu:', !!webViewRef?.current);
    
    // Cihaza ait sensor verisini bul
    const sensorData = deviceSensors.find(sensor => String(sensor.deviceId) === String(device.deviceId));
    
    if (sensorData && sensorData.deviceSensorLatitude && sensorData.deviceSensorLongitude) {
      // Gerçek sensor verisi varsa o konuma git
      const lat = sensorData.deviceSensorLatitude;
      const lng = sensorData.deviceSensorLongitude;
      
      // console.log(`${device.deviceName} cihazına gidiliyor - Lat: ${lat}, Lng: ${lng}`);
      
      // WebView'e animasyonlu hareket komutu gönder
      if (mapReady && webViewRef?.current) {
        // React Native'den WebView'a mesaj gönderme
        const script = `
          try {
            // console.log('=== WebView JavaScript Test Başlatıldı ===');
            
            // React Native'e debug mesajı gönder
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('WebView JavaScript çalışıyor!');
            }
            
            // Debug bilgilerini kontrol et
            // console.log('window var mı:', typeof window);
            // console.log('map var mı:', typeof window.map);
            // console.log('flyToDevice var mı:', typeof window.flyToDevice);
            
            // FlyTo fonksiyonunu çağır
            if (typeof window.flyToDevice === 'function') {
              // console.log('flyToDevice fonksiyonu çağrılıyor...');
              window.flyToDevice(${lat}, ${lng}, '${device.deviceName}');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('flyToDevice başarıyla çağrıldı');
              }
            } else if (window.map && window.map.flyTo) {
              // console.log('Manuel map.flyTo çağrılıyor...');
              window.map.flyTo([${lat}, ${lng}], 18, { animate: true, duration: 2 });
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('Manuel flyTo başarıyla çağrıldı');
              }
            } else {
              // console.log('Hiçbir flyTo yöntemi bulunamadı');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage('FlyTo yöntemi bulunamadı - map: ' + typeof window.map);
              }
            }
            
            // console.log('=== WebView JavaScript Test Tamamlandı ===');
          } catch (error) {
            // console.log('JavaScript hatası:', error);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage('JavaScript hatası: ' + error.message);
            }
          }
          true;
        `;
        
        // console.log('JavaScript injection çalıştırılıyor');
        webViewRef.current.injectJavaScript(script);
      } else {
        // console.log('Harita henüz hazır değil veya WebView ref yok - mapReady:', mapReady, 'webViewRef:', !!webViewRef?.current);
      }
    } else {
      // Sensor verisi yoksa rastgele konum kullan (test amaçlı)
      const lat = 37.0 + Math.random() * 0.1;
      const lng = 37.3 + Math.random() * 0.1;
      
      // console.log(`${device.deviceName} cihazına gidiliyor (test konumu) - Lat: ${lat}, Lng: ${lng}`);
      
      if (mapReady && webViewRef?.current) {
        // Test konumu için de aynı debug kodu
        const checkScript = `
          // console.log('=== FlyToDevice Debug (Test) ===');
          // console.log('window object keys:', Object.keys(window).filter(k => k.includes('fly') || k.includes('map') || k.includes('update')));
          // console.log('window.flyToDevice type:', typeof window.flyToDevice);
          // console.log('window.map exists:', typeof window.map !== 'undefined');
          
          if (typeof window.flyToDevice === 'function') {
            // console.log('Calling flyToDevice with test params:', ${lat}, ${lng}, '${device.deviceName}');
            try {
              window.flyToDevice(${lat}, ${lng}, '${device.deviceName}');
              // console.log('flyToDevice called successfully (test)');
            } catch (error) {
              // console.error('Error calling flyToDevice (test):', error);
            }
          } else {
            // console.error('window.flyToDevice is not a function (test)');
            if (window.map) {
              // console.log('Attempting manual flyTo (test)...');
              window.map.flyTo([${lat}, ${lng}], 18, {
                animate: true,
                duration: 2.0
              });
            }
          }
          // console.log('=== End Debug (Test) ===');
        `;
        
        // console.log('JavaScript injection çalıştırılıyor (test)');
        webViewRef.current.injectJavaScript(checkScript);
      } else {
        // console.log('Harita henüz hazır değil veya WebView ref yok (test) - mapReady:', mapReady, 'webViewRef:', !!webViewRef?.current);
      }
    }
    
    // Dropdown'u kapat
    setDropdownVisible(false);
  };

  // Dropdown toggle fonksiyonu
  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>PeTag</Text>
          <Text style={styles.headerSubtitle}>
            Çiftlik Yönetim Sistemi
            {lastUpdateTime && ` • Son Güncelleme: ${lastUpdateTime}`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Cihaz Dropdown */}
          <View style={styles.deviceDropdownContainer}>
            <TouchableOpacity 
              style={styles.deviceCount}
              onPress={toggleDropdown}
            >
              <Text style={styles.deviceCountText}>{filteredDevices.length} Cihaz</Text>
              <Ionicons 
                name={dropdownVisible ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#fff" 
                style={styles.chevronIcon}
              />
            </TouchableOpacity>
            
            {/* Dropdown Menu */}
            {dropdownVisible && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {filteredDevices.map((device, index) => {
                    const sensorData = deviceSensors.find(sensor => String(sensor.deviceId) === String(device.deviceId));
                    const animal = animals.find(a => a.animalId === device.animalId);
                    const isOnline = isDeviceOnline(device.deviceId, deviceSensors);
                    
                    return (
                      <TouchableOpacity
                        key={device.deviceId}
                        style={[
                          styles.dropdownItem,
                          index === filteredDevices.length - 1 && styles.dropdownItemLast,
                          !isOnline && { opacity: 0.6 } // Çevrimdışı cihazları soluklaştır
                        ]}
                        onPress={() => {
                          if (isOnline) {
                            flyToDevice(device);
                          } else {
                            // Çevrimdışı cihazlara tıklanamaz
                            console.log(`Cihaz ${device.deviceName} çevrimdışı - konumuna gidilemez`);
                          }
                        }}
                        disabled={!isOnline} // Çevrimdışı cihazları devre dışı bırak
                      >
                        <View style={styles.deviceInfo}>
                          <View style={styles.deviceHeader}>
                            <Text style={styles.deviceName}>{device.deviceName}</Text>
                            <View style={[
                              styles.statusIndicator,
                              { backgroundColor: isOnline ? '#27ae60' : '#e74c3c' }
                            ]} />
                            <Text style={[
                              styles.statusText,
                              { color: isOnline ? '#27ae60' : '#e74c3c' }
                            ]}>
                              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                            </Text>
                          </View>
                          <Text style={styles.animalName}>
                            {animal ? animal.animalName : 'Hayvan atanmamış'}
                          </Text>
                          {sensorData && isOnline ? (
                            <>
                              <Text style={styles.locationText}>
                                📍 {sensorData.deviceSensorLatitude?.toFixed(5)}, {sensorData.deviceSensorLongitude?.toFixed(5)}
                              </Text>
                              {(sensorData.deviceSensorValidateDate || sensorData.deviceSensorValidDate || sensorData.timestamp) && (
                                <Text style={styles.lastUpdateText}>
                                  🕒 Son GPS: {new Date(sensorData.deviceSensorValidateDate || sensorData.deviceSensorValidDate || sensorData.timestamp).toLocaleString('tr-TR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Text>
                              )}
                            </>
                          ) : (
                            <>
                              <Text style={styles.offlineText}>
                                📴 Cihaz çevrimdışı
                              </Text>
                              {sensorData && (sensorData.deviceSensorValidateDate || sensorData.deviceSensorValidDate || sensorData.timestamp) && (
                                <Text style={styles.lastUpdateOfflineText}>
                                  🕒 Son GPS: {new Date(sensorData.deviceSensorValidateDate || sensorData.deviceSensorValidDate || sensorData.timestamp).toLocaleString('tr-TR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Text>
                              )}
                            </>
                          )}
                        </View>
                        <Ionicons name="location-outline" size={18} color="#3498db" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <Image 
            source={require('../assets/logo.jpg')} 
            style={styles.mainLoadingLogo}
            resizeMode="contain"
          />
          <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          {location && mapHTML ? (
            <WebView
              ref={webViewRef}
              source={{
                html: mapHTML
              }}
              style={styles.map}
              javaScriptEnabled={true}
              onLoadEnd={() => {
                setMapReady(true);
                console.log('🗺️ Harita yüklendi, gerçek zamanlı güncellemeler başlatılıyor...');
                // Harita yüklendikten sonra gerçek zamanlı güncellemeleri başlat
                setTimeout(() => {
                  startRealTimeUpdates();
                }, 1000);
              }}
              onMessage={handleWebViewMessage}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.mapLoadingContainer}>
                  <Image 
                    source={require('../assets/logo.jpg')} 
                    style={styles.mapLoadingLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.mapLoadingText}>Harita yükleniyor...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.alternativeContainer}>
              <View style={styles.infoCard}>
                <Image 
                  source={require('../assets/logo.jpg')} 
                  style={styles.infoCardLogo}
                  resizeMode="contain"
                />
                <Text style={styles.infoTitle}>GPS Konum Sistemi</Text>
                <Text style={styles.infoText}>
                  Konum bilgisi alınıyor, harita yüklenecek...
                </Text>
                <Text style={styles.waitingText}>Lütfen bekleyin...</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Polygon Listesi - Sağ kenarda açılır-kapanır */}
      {polygons && polygons.length > 0 && (
        <View style={styles.polygonToggleContainer}>
          <TouchableOpacity
            style={styles.polygonToggleButton}
            onPress={() => setIsPolygonListVisible(!isPolygonListVisible)}
          >
            <Text style={styles.polygonToggleText}>🏛️</Text>
            <Text style={styles.polygonToggleCount}>{polygons.length}</Text>
            <Ionicons 
              name={isPolygonListVisible ? "chevron-up" : "chevron-down"} 
              size={14} 
              color="#fff" 
            />
          </TouchableOpacity>
          
          {isPolygonListVisible && (
            <View style={styles.polygonListContainer}>
              <Text style={styles.polygonListTitle}>Güvenli Alanlar</Text>
              <ScrollView 
                style={styles.polygonScrollView}
                showsVerticalScrollIndicator={false}
              >
                {polygons.map((polygon, index) => (
                  <TouchableOpacity
                    key={polygon.polygonId}
                    style={styles.polygonItem}
                    onPress={() => handlePolygonEdit(polygon)}
                  >
                    <View style={styles.polygonIcon}>
                      <Text style={styles.polygonIconText}>🏛️</Text>
                    </View>
                    <View style={styles.polygonInfo}>
                      <Text style={styles.polygonName} numberOfLines={1}>
                        {polygon.polygonName}
                      </Text>
                      <Text style={styles.polygonDate}>
                        {new Date(polygon.polygonCreatedTime).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      <View style={[styles.controlsContainer, { 
        bottom: Platform.OS === 'ios' ? 40 + insets.bottom : 30
      }]}>
        <TouchableOpacity 
          style={[
            styles.actionButton,
            locationLoading && { opacity: 0.7 } // Loading sırasında soluklaştır
          ]}
          onPress={refreshLocation}
          disabled={locationLoading} // Loading sırasında buton devre dışı
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="locate" size={20} color="#fff" />
          )}
          <Text style={styles.actionButtonText}>
            {locationLoading ? 'Konum Alınıyor...' : 'Konumum'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Polygon Drawing Controls */}
      <View style={styles.polygonControlsContainer}>
        <TouchableOpacity 
          style={[
            styles.polygonButton, 
            styles.drawButton,
            isDrawingMode && styles.drawButtonActive // Aktif durum stili
          ]}
          onPress={() => {
            if (webViewRef?.current) {
              webViewRef.current.injectJavaScript('toggleDrawingMode();');
            }
          }}
        >
          <Text style={styles.polygonButtonText}>Alan Çiz</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.polygonButton, styles.clearButton]}
          onPress={() => {
            if (webViewRef?.current) {
              webViewRef.current.injectJavaScript('clearAllPolygons();');
            }
          }}
        >
          <Text style={styles.polygonButtonText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Alan İhlali Uyarısı */}
      {areaViolations && areaViolations.length > 0 && violationVisible && (
        <View style={styles.violationContainer}>
          <View style={styles.violationHeader}>
            <Ionicons name="warning" size={20} color="#e74c3c" />
            <Text style={styles.violationTitle}>⚠️ GÜVENLİ ALAN DIŞINDA!</Text>
            <TouchableOpacity 
              style={styles.violationCloseButton}
              onPress={() => setViolationVisible(false)}
            >
              <Ionicons name="close" size={18} color="#e74c3c" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.violationList} nestedScrollEnabled>
            {areaViolations.map((violation, index) => (
              <View key={index} style={styles.violationItem}>
                <Text style={styles.violationDeviceName}>
                  📱 {violation.device.deviceName}
                </Text>
                <Text style={styles.violationAnimalName}>
                  🐄 {violation.animal?.animalName || 'Hayvan atanmamış'}
                </Text>
                <Text style={styles.violationTime}>
                  🕒 {new Date(violation.violationTime).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Device Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  🔧 {selectedDevice?.deviceName}
                </Text>
                <View style={styles.liveIndicator}>
                  <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                  <Text style={styles.liveText}>Canlı Veri</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#7f8c8d" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.modalScrollContent}
            >
              {selectedDevice && (
                <>
                  {/* Cihaz Bilgileri */}
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>📱 Cihaz Bilgileri</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Cihaz Adı:</Text>
                      <Text style={styles.infoValue}>{selectedDevice.deviceName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Bağlantı Durumu:</Text>
                      <Text style={[styles.infoValue, {
                        color: isDeviceOnline(selectedDevice.deviceId, deviceSensors) ? '#27ae60' : '#e74c3c'
                      }]}>
                        {isDeviceOnline(selectedDevice.deviceId, deviceSensors) ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Bağlı Hayvan:</Text>
                      <Text style={styles.infoValue}>
                        {selectedDevice.animal?.animalName || 'Bağlı değil'}
                      </Text>
                    </View>
                  </View>

                  {/* Sensor Verileri */}
                  {selectedDevice.sensorData && selectedDevice.sensorData.length > 0 ? (
                    <View style={styles.infoSection}>
                      <View style={styles.sensorHeaderContainer}>
                        <Text style={styles.sectionTitle}>
                          📊 ESP32 Sensor Verileri 
                          {isDeviceOnline(selectedDevice.deviceId, deviceSensors) ? 
                            ' (Aktif)' : ' (Son Kayıtlar - Cihaz Çevrimdışı)'}
                        </Text>
                        <Text style={styles.lastUpdateTime}>
                          🕒 Son güncelleme: {new Date().toLocaleTimeString('tr-TR', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </Text>
                      </View>
                      {!isDeviceOnline(selectedDevice.deviceId, deviceSensors) && (
                        <View style={styles.offlineWarning}>
                          <Text style={styles.offlineWarningText}>
                            ⚠️ Bu cihaz şu anda çevrimdışı. Aşağıdaki veriler son kaydedilen bilgilerdir.
                          </Text>
                        </View>
                      )}
                      {selectedDevice.sensorData.slice(0, 1).map((sensor, index) => (
                        <View key={index} style={styles.sensorDataCard}>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>📍 Enlem:</Text>
                            <Text style={styles.infoValue}>{sensor.deviceSensorLatitude?.toFixed(6) || 'N/A'}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>📍 Boylam:</Text>
                            <Text style={styles.infoValue}>{sensor.deviceSensorLongitude?.toFixed(6) || 'N/A'}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>⚡ İvme:</Text>
                            <Text style={styles.infoValue}>{sensor.deviceSensorAccelaration || 'N/A'} m/s²</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>� Pil Durumu:</Text>
                            <Text style={[styles.infoValue, {
                              color: parseInt(sensor.deviceSensorBatteryStatus) > 50 ? '#27ae60' : 
                                     parseInt(sensor.deviceSensorBatteryStatus) > 20 ? '#f39c12' : '#e74c3c'
                            }]}>{sensor.deviceSensorBatteryStatus || 'N/A'}%</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>🧭 Yaw (Z-ekseni):</Text>
                            <Text style={styles.infoValue}>{sensor.deviceSensorYaw || 'N/A'}°</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>� Pitch (X-ekseni):</Text>
                            <Text style={styles.infoValue}>{sensor.deviceSensorPitch || 'N/A'}°</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>� Roll (Y-ekseni):</Text>
                            <Text style={styles.infoValue}>{sensor.deviceSensorRoll || 'N/A'}°</Text>
                          </View>
                          
                          {/* Tarih ve Zaman Bilgisi */}
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>📅 GPS Tarihi:</Text>
                            <Text style={styles.infoValue}>
                              {sensor.deviceSensorValidateDate ? 
                                new Date(sensor.deviceSensorValidateDate).toLocaleString('tr-TR') : 
                                (sensor.deviceSensorValidDate ? 
                                  new Date(sensor.deviceSensorValidDate).toLocaleString('tr-TR') :
                                  (sensor.timestamp ? new Date(sensor.timestamp).toLocaleString('tr-TR') : 'N/A')
                                )
                              }
                            </Text>
                          </View>
                          
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>🟢 Bağlantı Durumu:</Text>
                            <Text style={[styles.infoValue, {
                              color: sensor.isOnline ? '#27ae60' : '#e74c3c'
                            }]}>
                              {sensor.isOnline ? 'Çevrimiçi (API)' : 'Çevrimdışı (API)'}
                            </Text>
                          </View>
                          
                          {/* Sensor ID ve Device ID bilgileri */}
                          <View style={styles.technicalInfo}>
                            <Text style={styles.technicalTitle}>🔧 Teknik Bilgiler</Text>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Sensor ID:</Text>
                              <Text style={styles.infoValue}>{sensor.deviceSensorId || 'N/A'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Device ID:</Text>
                              <Text style={styles.infoValue}>{sensor.deviceId || 'N/A'}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                      
                      {/* Tüm sensor verilerini göster */}
                      {selectedDevice.sensorData.length > 1 && (
                        <View style={styles.historicalData}>
                          <Text style={styles.sectionTitle}>📈 Geçmiş Veriler ({selectedDevice.sensorData.length - 1} kayıt)</Text>
                          {selectedDevice.sensorData.slice(1, 4).map((sensor, index) => (
                            <View key={index} style={styles.historicalItem}>
                              <Text style={styles.historicalTime}>
                                Kayıt #{index + 2}
                              </Text>
                              <Text style={styles.historicalInfo}>
                                📍 {sensor.deviceSensorLatitude?.toFixed(4) || 'N/A'}, {sensor.deviceSensorLongitude?.toFixed(4) || 'N/A'} | 
                                ⚡ {sensor.deviceSensorAccelaration || 'N/A'} m/s² | 
                                🔋 {sensor.deviceSensorBatteryStatus || 'N/A'}%
                              </Text>
                            </View>
                          ))}
                          {selectedDevice.sensorData.length > 4 && (
                            <Text style={styles.moreDataText}>
                              +{selectedDevice.sensorData.length - 4} daha fazla kayıt...
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.infoSection}>
                      <Text style={styles.sectionTitle}>📊 ESP32 Sensor Verileri</Text>
                      <View style={styles.noDataContainer}>
                        <Ionicons name="hardware-chip-outline" size={48} color="#bdc3c7" />
                        <Text style={styles.noDataText}>Bu ESP32 cihazından henüz sensor verisi alınmamış.</Text>
                        <Text style={styles.noDataSubtext}>
                          Cihaz aktif olduğunda GPS, ivme ve batarya verileri burada görünecektir.
                        </Text>
                        <View style={styles.offlineStatus}>
                          <Text style={styles.offlineStatusText}>🔴 Cihaz Durumu: Çevrimdışı</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Polygon Kaydetme/Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={polygonModalVisible}
        onRequestClose={() => {
          setPolygonModalVisible(false);
          setIsEditMode(false);
          setEditingPolygon(null);
          // Edit polygon'u kaldır
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.editPolygon) {
                window.map.removeLayer(window.editPolygon);
                window.editPolygon = null;
              }
            `);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.polygonModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? '🔧 Güvenli Alan Düzenle' : '🔒 Güvenli Alan Oluştur'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setPolygonModalVisible(false);
                  setIsEditMode(false);
                  setEditingPolygon(null);
                  // Edit polygon'u kaldır
                  if (webViewRef.current) {
                    webViewRef.current.injectJavaScript(`
                      if (window.editPolygon) {
                        window.map.removeLayer(window.editPolygon);
                        window.editPolygon = null;
                      }
                    `);
                  }
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#7f8c8d" />
              </TouchableOpacity>
            </View>

            <View style={styles.polygonModalContent}>
              <Text style={styles.polygonInputLabel}>Alan Adı:</Text>
              <TextInput
                style={styles.polygonNameInput}
                value={newPolygonName}
                onChangeText={setNewPolygonName}
                placeholder="Örn: Güvenli Otlak Alanı"
                placeholderTextColor="#bdc3c7"
                maxLength={50}
              />
              
              <Text style={styles.polygonInfoText}>
                📍 {currentDrawingPoints?.length || 0} nokta işaretlendi
              </Text>
              
              {isEditMode && (
                <Text style={styles.editModeText}>
                  Düzenleme modunda - Haritada noktaları değiştirebilirsiniz
                </Text>
              )}
              
              <View style={styles.polygonModalButtons}>
                <TouchableOpacity 
                  style={styles.polygonCancelButton}
                  onPress={() => {
                    setPolygonModalVisible(false);
                    setIsEditMode(false);
                    setEditingPolygon(null);
                    // Edit polygon'u kaldır
                    if (webViewRef.current) {
                      webViewRef.current.injectJavaScript(`
                        if (window.editPolygon) {
                          window.map.removeLayer(window.editPolygon);
                          window.editPolygon = null;
                        }
                      `);
                    }
                  }}
                >
                  <Text style={styles.polygonCancelButtonText}>İptal</Text>
                </TouchableOpacity>
                
                {isEditMode && (
                  <TouchableOpacity 
                    style={styles.polygonDeleteButton}
                    onPress={handleDeletePolygon}
                  >
                    <Text style={styles.polygonDeleteButtonText}>Sil</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.polygonSaveButton}
                  onPress={handleSavePolygon}
                >
                  <Text style={styles.polygonSaveButtonText}>
                    {isEditMode ? 'Güncelle' : 'Kaydet'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#27ae60',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ecf0f1',
    marginTop: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  deviceCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
  },
  deviceCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 5,
  },
  chevronIcon: {
    marginLeft: 2,
  },
  deviceDropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 35,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    minWidth: 280,
    maxHeight: 300,
    zIndex: 1001,
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  animalName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#3498db',
    fontFamily: 'monospace',
  },
  lastUpdateText: {
    fontSize: 11,
    color: '#27ae60',
    fontStyle: 'italic',
    marginTop: 2,
  },
  lastUpdateOfflineText: {
    fontSize: 11,
    color: '#95a5a6',
    fontStyle: 'italic',
    marginTop: 2,
  },
  offlineText: {
    fontSize: 12,
    color: '#e74c3c',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#27ae60',
    marginTop: 10,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    margin: 10,
    marginBottom: 120,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  mapLoadingText: {
    fontSize: 16,
    color: '#27ae60',
    marginTop: 10,
    fontWeight: 'bold',
  },
  mainLoadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  mapLoadingLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  infoCardLogo: {
    width: 50,
    height: 50,
    marginBottom: 15,
  },
  alternativeContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  waitingText: {
    fontSize: 14,
    color: '#f39c12',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  controlsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  actionButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorContainer: {
    backgroundColor: '#e74c3c',
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  // Yeni stiller
  technicalInfo: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  technicalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 8,
  },
  historicalData: {
    marginTop: 15,
  },
  historicalItem: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 5,
  },
  historicalTime: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  historicalInfo: {
    fontSize: 11,
    color: '#2c3e50',
    marginTop: 2,
  },
  moreDataText: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 5,
  },
  offlineWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  offlineWarningText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  offlineStatus: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 5,
  },
  offlineStatusText: {
    fontSize: 13,
    color: '#c62828',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalTitleContainer: {
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27ae60',
    marginRight: 5,
  },
  liveText: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  sensorHeaderContainer: {
    marginBottom: 10,
  },
  lastUpdateTime: {
    fontSize: 12,
    color: '#27ae60',
    fontStyle: 'italic',
    marginTop: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  sensorDataCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  noDataText: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  // Polygon ve Alan İhlali Stilleri
  violationContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderLeftWidth: 5,
    borderLeftColor: '#e74c3c',
    maxHeight: 200,
  },
  violationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  violationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginLeft: 8,
    flex: 1,
  },
  violationCloseButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  violationList: {
    maxHeight: 120,
  },
  violationItem: {
    backgroundColor: '#fdf2f2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e74c3c',
  },
  violationDeviceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  violationAnimalName: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  violationTime: {
    fontSize: 11,
    color: '#95a5a6',
    marginTop: 2,
  },
  polygonModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginHorizontal: 20,
    marginVertical: '30%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  polygonModalContent: {
    padding: 20,
  },
  polygonInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  polygonNameInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  polygonInfoText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
  },
  polygonModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  polygonCancelButton: {
    flex: 1,
    backgroundColor: '#95a5a6',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  polygonCancelButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  polygonSaveButton: {
    flex: 1,
    backgroundColor: '#e67e22',
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  polygonSaveButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  polygonControlsContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  polygonButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 100,
  },
  drawButton: {
    backgroundColor: '#3498db',
  },
  drawButtonActive: {
    backgroundColor: '#2c3e50', // Daha koyu mavi-gri renk
  },
  clearButton: {
    backgroundColor: '#e74c3c',
  },
  polygonButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Polygon Listesi Stilleri - Açılır Kapanır Tasarım
  polygonToggleContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 500 : 0, // Biraz daha aşağıda konumlandır
    right: 10,
    zIndex: 1000,
  },
  polygonToggleButton: {
    backgroundColor: 'rgba(230, 126, 34, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minWidth: 80,
  },
  polygonToggleText: {
    fontSize: 16,
    marginRight: 5,
  },
  polygonToggleCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  polygonListContainer: {
    marginTop: 8,
    width: 180,
    maxHeight: 280,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  polygonListTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#e67e22',
    paddingBottom: 4,
  },
  polygonScrollView: {
    maxHeight: 220,
  },
  polygonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#e67e22',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  polygonIcon: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  polygonIconText: {
    fontSize: 16,
  },
  polygonInfo: {
    flex: 1,
  },
  polygonName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  polygonDate: {
    fontSize: 10,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  // Düzenleme Modu Stilleri
  editModeText: {
    fontSize: 13,
    color: '#e67e22',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 15,
    backgroundColor: '#fef9f3',
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  polygonDeleteButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  polygonDeleteButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default HomeScreen;
