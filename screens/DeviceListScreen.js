import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { getAllDevices, addDevice, deleteDevice, updateDevice } from '../api/device';
import { getAllAnimals } from '../api/animal';
import { getUserIdFromToken, isTokenValid, getUserRoleFromToken } from '../utils/storage';

const DeviceListScreen = ({ navigation }) => {
  const [devices, setDevices] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  // Detay modal için state'ler
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Form state
  const [deviceName, setDeviceName] = useState('');
  const [deviceMacAddress, setDeviceMacAddress] = useState('');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [isMacValid, setIsMacValid] = useState(true);

  useEffect(() => {
    initializeScreen();
  }, []);

  // Sayfa focus olduğunda cihazları ve hayvanları yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
        loadDevices();
        loadAnimals(); // Hayvan listesini de yenile
      }
    });

    return unsubscribe;
  }, [navigation, userId]);

  const initializeScreen = async () => {
    try {
      // console.log('DeviceListScreen başlatılıyor...');
      
      // Önce token'ın geçerliliğini kontrol et
      const tokenValid = await isTokenValid();
      // console.log('Token geçerli mi?', tokenValid);
      
      if (!tokenValid) {
        Alert.alert(
          'Oturum Süresi Doldu', 
          'Lütfen tekrar giriş yapın.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Auth' }]
                });
              }
            }
          ]
        );
        return;
      }
      
      const currentUserId = await getUserIdFromToken();
      // console.log('Alınan userId:', currentUserId);
      setUserId(currentUserId);
      
      const currentUserRole = await getUserRoleFromToken();
      // console.log('Alınan userRole:', currentUserRole);
      setUserRole(currentUserRole);
      
      if (!currentUserId) {
        Alert.alert('Hata', 'Kullanıcı kimliği bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
      
      await Promise.all([loadDevices(), loadAnimals()]);
    } catch (error) {
      console.error('Ekran başlatılırken hata:', error);
      Alert.alert('Hata', 'Kullanıcı bilgileri alınamadı');
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      const currentUserId = await getUserIdFromToken();
      const currentUserRole = await getUserRoleFromToken();
      
      if (!currentUserId) {
        Alert.alert('Hata', 'Kullanıcı kimliği bulunamadı');
        return;
      }

      // console.log('Cihazlar API çağrısı yapılıyor...', { currentUserId, currentUserRole });
      const allDevices = await getAllDevices();
      // console.log('API\'den gelen tüm cihazlar:', allDevices);
      
      // Kullanıcıya özgü cihazları filtrele
      let userDevices = [];
      if (currentUserRole === 'admin') {
        // Admin tüm cihazları görebilir
        userDevices = allDevices || [];
        // console.log('DeviceListScreen - Admin: Tüm cihazlar gösteriliyor');
      } else {
        // Normal kullanıcı için önce kendi hayvanlarını al
        const allAnimals = await getAllAnimals();
        const userAnimals = (allAnimals || []).filter(animal => 
          animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString()
        );
        const userAnimalIds = userAnimals.map(animal => animal.animalId);
        
        // Sadece kendi hayvanlarına bağlı cihazları göster
        userDevices = (allDevices || []).filter(device => {
          const matches = userAnimalIds.includes(device.animalId);
          // console.log(`DeviceListScreen Cihaz ${device.deviceName}: animalId=${device.animalId}, userAnimalIds=${userAnimalIds}, matches=${matches}`);
          return matches;
        });
        // console.log('DeviceListScreen - Normal kullanıcı: Filtrelenmiş cihazlar:', userDevices.length);
      }
      
      setDevices(userDevices);
    } catch (error) {
      console.error('Cihazlar yüklenirken hata:', error);
      console.error('Hata detayları:', error.response?.data || error.message);
      
      // 401 hatası - token süresi dolmuş
      if (error.response?.status === 401) {
        Alert.alert(
          'Oturum Süresi Doldu',
          'Lütfen tekrar giriş yapın.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Auth' }]
                });
              }
            }
          ]
        );
        return;
      }
      
      Alert.alert('Hata', 'Cihazlar yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAnimals = async () => {
    try {
      // console.log('Hayvanlar API çağrısı yapılıyor...');
      const currentUserId = await getUserIdFromToken();
      const currentUserRole = await getUserRoleFromToken();
      
      const allAnimals = await getAllAnimals();
      // console.log('API\'den gelen tüm hayvanlar:', allAnimals);
      // console.log('Cihaz modülü - Mevcut kullanıcı ID:', currentUserId);
      
      // Cihaz eklerken sadece kullanıcının kendi hayvanlarını göster
      // Admin bile kendi hayvanlarını seçebilir, başkasının hayvanına cihaz bağlayamaz
      const userAnimals = allAnimals.filter(animal => {
        // console.log(`Cihaz için hayvan filtresi - ${animal.animalName}: userId=${animal.userId}, currentUserId=${currentUserId}`);
        return animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString();
      });
      
      // console.log('Kullanıcının hayvanları (cihaz seçimi için):', userAnimals);
      setAnimals(userAnimals);
    } catch (error) {
      console.error('Hayvanlar yüklenirken hata:', error);
      Alert.alert('Hata', 'Hayvanlar yüklenemedi.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadDevices(), loadAnimals()]);
    } catch (error) {
      console.error('Yenileme hatası:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getAnimalNameById = (animalId) => {
    const animal = animals.find(a => a.animalId === animalId || a.id === animalId);
    return animal ? animal.animalName : 'Bilinmeyen Hayvan';
  };

  const handleDevicePress = (device) => {
    setSelectedDevice(device);
    setDetailModalVisible(true);
  };

  const handleDeleteDeviceConfirm = (device) => {
    Alert.alert(
      'Cihazı Sil',
      `${device.deviceName} adlı cihazı silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive', 
          onPress: () => {
            setDetailModalVisible(false);
            handleDeleteDevice(device);
          }
        }
      ]
    );
  };

  const handleEditDevice = async (device) => {
    // Edit modal açılmadan önce hayvan listesini yenile
    await loadAnimals();
    
    setCurrentDevice(device);
    setDeviceName(device.deviceName);
    setDeviceMacAddress(device.deviceMacAdress);
    setSelectedAnimalId(device.animalId);
    setEditMode(true);
    setDetailModalVisible(false);
    setModalVisible(true);
  };

  const handleDeleteDevice = async (device) => {
    try {
      const deviceId = device.deviceId || device.id;
      // console.log('Cihaz silme işlemi başlatılıyor:', deviceId);
      
      if (!deviceId) {
        Alert.alert('Hata', 'Cihaz ID\'si bulunamadı');
        return;
      }

      await deleteDevice(deviceId);
      
      Alert.alert('Başarılı', 'Cihaz başarıyla silindi.');
      
      // Listeyi yenile
      await loadDevices();
      
    } catch (error) {
      console.error('Cihaz silinirken hata:', error);
      Alert.alert('Hata', 'Cihaz silinirken bir hata oluştu.');
    }
  };

  // MAC adresi format düzenleyici ve validasyon
  const formatMacAddress = (text) => {
    // Sadece hexadecimal karakterlere izin ver (0-9, A-F)
    const cleanText = text.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    
    // Her iki karakterde bir ':' ekle
    let formatted = '';
    for (let i = 0; i < cleanText.length; i += 2) {
      if (i > 0) {
        formatted += ':';
      }
      formatted += cleanText.substr(i, 2);
    }
    
    // Maksimum 17 karakter (12 hex + 5 iki nokta)
    if (formatted.length > 17) {
      formatted = formatted.substr(0, 17);
    }
    
    return formatted;
  };

  // MAC adresi validasyon
  const validateMacAddress = (mac) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  };

  // MAC adresi değişiklik handler'ı
  const handleMacAddressChange = (text) => {
    const formattedMac = formatMacAddress(text);
    setDeviceMacAddress(formattedMac);
    
    // Validasyon kontrolü
    if (formattedMac.length === 17) {
      setIsMacValid(validateMacAddress(formattedMac));
    } else if (formattedMac.length === 0) {
      setIsMacValid(true); // Boş iken hata gösterme
    } else {
      setIsMacValid(false); // Eksik karakter
    }
  };

  const handleSaveDevice = async () => {
    if (!deviceName.trim()) {
      Alert.alert('Hata', 'Lütfen cihaz adını girin.');
      return;
    }

    if (!deviceMacAddress.trim()) {
      Alert.alert('Hata', 'Lütfen MAC adresini girin.');
      return;
    }

    if (!validateMacAddress(deviceMacAddress)) {
      Alert.alert('Hata', 'Geçersiz MAC adresi formatı. Doğru format: FE:4E:11:00:00:01');
      return;
    }

    if (!selectedAnimalId) {
      Alert.alert('Hata', 'Lütfen bir hayvan seçin.');
      return;
    }

    // Seçilen hayvanın kullanıcıya ait olduğunu kontrol et
    const selectedAnimal = animals.find(animal => 
      (animal.animalId || animal.id) === selectedAnimalId
    );
    
    if (!selectedAnimal) {
      Alert.alert('Hata', 'Geçersiz hayvan seçimi.');
      return;
    }

    try {
      setAddLoading(true);

      const deviceData = {
        deviceName: deviceName.trim(),
        deviceMacAdress: deviceMacAddress.trim(),
        animalId: selectedAnimalId
      };

      if (editMode && currentDevice) {
        // Güncelleme işlemi
        deviceData.deviceId = currentDevice.deviceId || currentDevice.id;
        await updateDevice(deviceData);
        Alert.alert('Başarılı', 'Cihaz başarıyla güncellendi.');
      } else {
        // Yeni ekleme işlemi
        await addDevice(deviceData);
        Alert.alert('Başarılı', 'Cihaz başarıyla eklendi.');
      }
      
      resetForm();
      setModalVisible(false);
      
      // Listeyi yenile
      await loadDevices();
      
    } catch (error) {
      console.error('Cihaz kaydedilirken hata:', error);
      Alert.alert('Hata', 'Cihaz kaydedilirken bir hata oluştu.');
    } finally {
      setAddLoading(false);
    }
  };

  const resetForm = () => {
    setDeviceName('');
    setDeviceMacAddress('');
    setSelectedAnimalId('');
    setCurrentDevice(null);
    setIsMacValid(true); // Validasyon durumunu sıfırla
    setEditMode(false);
  };

  const openAddModal = async () => {
    // Modal açılmadan önce hayvan listesini yenile
    await loadAnimals();
    
    // Hayvan kontrolü yap
    if (animals.length === 0) {
      Alert.alert(
        'Hayvan Bulunamadı', 
        'Cihaz eklemek için önce hayvan eklemeniz gerekiyor. Hayvanlar sekmesine giderek hayvan ekleyebilirsiniz.',
        [
          { text: 'Tamam', style: 'default' },
          { 
            text: 'Hayvan Ekle', 
            onPress: () => {
              navigation.navigate('Animals');
            }
          }
        ]
      );
      return;
    }
    
    // console.log('Modal açılıyor - Mevcut hayvanlar:', animals.length);
    // console.log('Modal açılıyor - Hayvan listesi:', animals.map(a => `${a.animalName} (${a.animalId})`));
    
    resetForm();
    setModalVisible(true);
  };

  const renderDeviceItem = ({ item }) => {
    const animalName = getAnimalNameById(item.animalId);
    
    return (
      <TouchableOpacity 
        style={styles.deviceItem}
        onPress={() => handleDevicePress(item)}
      >
        <View style={styles.deviceInfo}>
          <Ionicons name="hardware-chip" size={24} color="#3498db" />
          <View style={styles.deviceDetails}>
            <Text style={styles.deviceName}>{item.deviceName}</Text>
            <Text style={styles.deviceMac}>MAC: {item.deviceMacAdress}</Text>
            <Text style={styles.animalName}>Hayvan: {animalName}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#95a5a6" />
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="hardware-chip-outline" size={80} color="#bdc3c7" />
      <Text style={styles.emptyTitle}>Henüz cihaz eklemediniz</Text>
      <Text style={styles.emptySubtitle}>
        Yeni cihaz eklemek için sağ üstteki + butonuna basın.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Cihazlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            Cihazlarım {userRole === 'admin' ? '(Admin)' : ''}
          </Text>
          <Text style={styles.headerSubtitle}>
            Toplam {devices.length} cihaz
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.headerAddButton}
          onPress={openAddModal}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.deviceId?.toString() || item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
      />

      {/* Device Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.detailModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cihaz Detayları</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedDevice && (
              <View style={styles.deviceInfoContainer}>
                <View style={styles.infoRow}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#2E7D32" />
                  <Text style={styles.infoLabel}>Cihaz Adı:</Text>
                  <Text style={styles.infoValue}>{selectedDevice.deviceName}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="wifi-outline" size={20} color="#2E7D32" />
                  <Text style={styles.infoLabel}>MAC Adresi:</Text>
                  <Text style={styles.infoValue}>{selectedDevice.deviceMacAdress}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="paw-outline" size={20} color="#2E7D32" />
                  <Text style={styles.infoLabel}>Bağlı Hayvan:</Text>
                  <Text style={styles.infoValue}>{getAnimalNameById(selectedDevice.animalId)}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Ionicons name="id-card-outline" size={20} color="#2E7D32" />
                  <Text style={styles.infoLabel}>Cihaz ID:</Text>
                  <Text style={styles.infoValue}>{selectedDevice.deviceId}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleEditDevice(selectedDevice)}
              >
                <Ionicons name="create-outline" size={20} color="white" />
                <Text style={styles.actionButtonText}>Düzenle</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeleteDeviceConfirm(selectedDevice)}
              >
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.actionButtonText}>Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Device Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editMode ? 'Cihaz Düzenle' : 'Yeni Cihaz Ekle'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#7f8c8d" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Cihaz Adı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Cihaz adını girin (örn: PeTag 1)"
                  value={deviceName}
                  onChangeText={setDeviceName}
                />

                <Text style={styles.inputLabel}>MAC Adresi</Text>
                <TextInput
                  style={[
                    styles.input, 
                    !isMacValid && { borderColor: '#e74c3c', borderWidth: 2 }
                  ]}
                  placeholder="MAC adresini girin (örn: FE:4E:11:00:00:01)"
                  value={deviceMacAddress}
                  onChangeText={handleMacAddressChange}
                  autoCapitalize="characters"
                  maxLength={17}
                  keyboardType="default"
                />
                {!isMacValid && deviceMacAddress.length > 0 && (
                  <Text style={styles.errorText}>
                    ⚠️ Geçersiz MAC adresi formatı (12 hexadecimal karakter gerekli)
                  </Text>
                )}

                <Text style={styles.inputLabel}>Bağlanacak Hayvan</Text>
                <Text style={styles.animalCountInfo}>
                  {animals.length} hayvan mevcut
                </Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedAnimalId}
                    onValueChange={(itemValue, itemIndex) => {
                      // console.log('Picker onValueChange çalıştı - Hayvan seçildi:', itemValue, 'Index:', itemIndex);
                      // console.log('Seçilen hayvan adı:', animals.find(a => (a.animalId || a.id) === itemValue)?.animalName);
                      setSelectedAnimalId(itemValue);
                    }}
                    style={styles.picker}
                    dropdownIconColor="#3498db"
                    mode="dropdown"
                    enabled={true}
                  >
                    <Picker.Item 
                      label="Hayvan seçin..." 
                      value="" 
                      color="#95a5a6"
                    />
                    {animals.map((animal) => (
                      <Picker.Item 
                        key={animal.animalId || animal.id} 
                        label={`${animal.animalName}`} 
                        value={animal.animalId || animal.id}
                        color="#2c3e50"
                      />
                    ))}
                  </Picker>
                </View>
                {selectedAnimalId ? (
                  <Text style={styles.selectedAnimalInfo}>
                    Seçilen: {animals.find(a => (a.animalId || a.id) === selectedAnimalId)?.animalName}
                  </Text>
                ) : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => {
                      setModalVisible(false);
                      resetForm();
                    }}
                  >
                    <Text style={styles.cancelButtonText}>İptal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.saveButton, addLoading && styles.disabledButton]}
                    onPress={handleSaveDevice}
                    disabled={addLoading}
                  >
                    {addLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {editMode ? 'Güncelle' : 'Kaydet'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#3498db',
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
    marginTop: 2,
  },
  headerAddButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 20,
    marginLeft: 15,
  },
  listContainer: {
    padding: 15,
  },
  deviceItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceDetails: {
    marginLeft: 15,
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  deviceMac: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  animalName: {
    fontSize: 14,
    color: '#27ae60',
    marginTop: 2,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#3498db',
    marginTop: 10,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 20,
  },
  animalCountInfo: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  selectedAnimalInfo: {
    fontSize: 14,
    color: '#27ae60',
    marginTop: -15,
    marginBottom: 10,
    fontWeight: '500',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        height: 150,
      },
      android: {
        minHeight: 50,
      },
    }),
  },
  picker: {
    ...Platform.select({
      ios: {
        height: 150,
        marginTop: -50,
      },
      android: {
        height: 50,
      },
    }),
    color: '#2c3e50',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#95a5a6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  // Device Detail Modal Styles
  detailModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deviceInfoContainer: {
    paddingVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 120,
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#3498db',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
    fontStyle: 'italic',
  },
});

export default DeviceListScreen;
