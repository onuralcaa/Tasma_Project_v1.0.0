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
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllAnimals, addAnimal, deleteAnimal } from '../api/animal';
import { getUserIdFromToken, isTokenValid, getUserRoleFromToken } from '../utils/storage';

const AnimalListScreen = ({ navigation }) => {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [animalName, setAnimalName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  
  // Detay modal için state'ler
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  // Sayfa focus olduğunda hayvanları yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
        loadAnimals();
      }
    });

    return unsubscribe;
  }, [navigation, userId]);

  const initializeScreen = async () => {
    try {
      // console.log('AnimalListScreen başlatılıyor...');
      
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
                // Auth stack'e yönlendir
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
      
      await loadAnimals();
    } catch (error) {
      console.error('Ekran başlatılırken hata:', error);
      Alert.alert('Hata', 'Kullanıcı bilgileri alınamadı');
    }
  };

  const loadAnimals = async () => {
    try {
      setLoading(true);
      const currentUserId = await getUserIdFromToken();
      
      if (!currentUserId) {
        Alert.alert('Hata', 'Kullanıcı kimliği bulunamadı');
        return;
      }

      // console.log('API çağrısı yapılıyor...');
      const allAnimals = await getAllAnimals();
      // console.log('API\'den gelen tüm hayvanlar:', allAnimals);
      // console.log('Mevcut kullanıcı ID:', currentUserId);
      // console.log('Mevcut kullanıcı rolü:', userRole);
      
      // Admin kullanıcılar tüm hayvanları görebilir, normal kullanıcılar sadece kendilerininkini
      let userAnimals;
      if (userRole === 'admin') {
        // console.log('Admin kullanıcısı - tüm hayvanlar gösteriliyor');
        userAnimals = allAnimals;
      } else {
        // Sadece oturum açmış kullanıcıya ait hayvanları filtrele
        userAnimals = allAnimals.filter(animal => {
          // console.log(`Hayvan ${animal.animalName} - userId: ${animal.userId}, currentUserId: ${currentUserId}`);
          return animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString();
        });
      }
      
      // console.log('Filtrelenmiş kullanıcı hayvanları:', userAnimals);
      setAnimals(userAnimals);
    } catch (error) {
      console.error('Hayvanlar yüklenirken hata:', error);
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
      
      Alert.alert('Hata', 'Hayvanlar yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnimals();
  };

  const handleAnimalPress = (animal) => {
    setSelectedAnimal(animal);
    setDetailModalVisible(true);
  };

  const handleDeleteAnimalConfirm = (animal) => {
    Alert.alert(
      'Hayvanı Sil',
      `${animal.animalName} adlı hayvanı silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive', 
          onPress: () => {
            setDetailModalVisible(false);
            handleDeleteAnimal(animal);
          }
        }
      ]
    );
  };

  const handleDeleteAnimal = async (animal) => {
    try {
      const animalId = animal.animalId || animal.id;
      // console.log('Silme işlemi başlatılıyor:', animalId);
      
      if (!animalId) {
        Alert.alert('Hata', 'Hayvan ID\'si bulunamadı');
        return;
      }

      await deleteAnimal(animalId);
      
      Alert.alert('Başarılı', 'Hayvan başarıyla silindi.');
      
      // Listeyi yenile
      await loadAnimals();
      
    } catch (error) {
      console.error('Hayvan silinirken hata:', error);
      Alert.alert('Hata', 'Hayvan silinirken bir hata oluştu.');
    }
  };

  const handleAddAnimal = async () => {
    if (!animalName.trim()) {
      Alert.alert('Hata', 'Lütfen hayvan adını girin.');
      return;
    }

    try {
      setAddLoading(true);
      const currentUserId = await getUserIdFromToken();
      
      if (!currentUserId) {
        Alert.alert('Hata', 'Kullanıcı kimliği bulunamadı');
        return;
      }

      const animalData = {
        animalName: animalName.trim(),
        userId: currentUserId
      };

      await addAnimal(animalData);
      
      setAnimalName('');
      setModalVisible(false);
      
      Alert.alert('Başarılı', 'Hayvan başarıyla eklendi.');
      
      // Listeyi yenile
      await loadAnimals();
      
    } catch (error) {
      console.error('Hayvan eklenirken hata:', error);
      Alert.alert('Hata', 'Hayvan eklenirken bir hata oluştu.');
    } finally {
      setAddLoading(false);
    }
  };

  const renderAnimalItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.animalItem}
      onPress={() => handleAnimalPress(item)}
    >
      <View style={styles.animalInfo}>
        <Ionicons name="paw" size={24} color="#27ae60" />
        <View style={styles.animalDetails}>
          <Text style={styles.animalName}>{item.animalName}</Text>
          <Text style={styles.animalId}>ID: {item.animalId || item.id}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#95a5a6" />
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="paw-outline" size={80} color="#bdc3c7" />
      <Text style={styles.emptyTitle}>Henüz hayvan eklemediniz</Text>
      <Text style={styles.emptySubtitle}>
        Yeni hayvan eklemek için sağ üstteki + butonuna basın.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={styles.loadingText}>Hayvanlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            Hayvanlarım {userRole === 'admin' ? '(Admin)' : ''}
          </Text>
          <Text style={styles.headerSubtitle}>
            Toplam {animals.length} hayvan
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.headerAddButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={animals}
        renderItem={renderAnimalItem}
        keyExtractor={(item) => item.animalId?.toString() || item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#27ae60']}
            tintColor="#27ae60"
          />
        }
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Animal Modal */}
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
                <Text style={styles.modalTitle}>Yeni Hayvan Ekle</Text>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#7f8c8d" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Hayvan Adı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Hayvan adını girin"
                  value={animalName}
                  onChangeText={setAnimalName}
                  autoFocus={true}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => {
                      setModalVisible(false);
                      setAnimalName('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>İptal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.saveButton, addLoading && styles.disabledButton]}
                    onPress={handleAddAnimal}
                    disabled={addLoading}
                  >
                    {addLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Kaydet</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Hayvan Detay Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🐄 Hayvan Detayları</Text>
                <TouchableOpacity 
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#7f8c8d" />
                </TouchableOpacity>
              </View>

              {selectedAnimal && (
                <View style={styles.modalBody}>
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>📋 Genel Bilgiler</Text>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Hayvan Adı:</Text>
                      <Text style={styles.infoValue}>{selectedAnimal.animalName}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Hayvan ID:</Text>
                      <Text style={styles.infoValue}>{selectedAnimal.animalId || selectedAnimal.id}</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Kullanıcı ID:</Text>
                      <Text style={styles.infoValue}>{selectedAnimal.userId}</Text>
                    </View>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => {
                        setDetailModalVisible(false);
                        // console.log('Düzenle:', selectedAnimal.animalId || selectedAnimal.id);
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Düzenle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => handleDeleteAnimalConfirm(selectedAnimal)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
    backgroundColor: '#f8f9fa',
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
  animalItem: {
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
  animalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  animalDetails: {
    marginLeft: 15,
    flex: 1,
  },
  animalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  animalId: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
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
    color: '#27ae60',
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
    maxHeight: '50%',
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
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
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
    backgroundColor: '#27ae60',
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
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  infoLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginRight: 10,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default AnimalListScreen;

