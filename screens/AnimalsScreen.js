import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllAnimals, getUserAnimals } from '../api/animal';
import { getAllDevices, getUserDevices } from '../api/device';
import { getUserIdFromToken, getUserRoleFromToken } from '../utils/storage';

const AnimalsScreen = ({ navigation }) => {
  const [animals, setAnimals] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      // Kullanıcı bilgilerini al
      const currentUserId = await getUserIdFromToken();
      const currentUserRole = await getUserRoleFromToken();
      
      console.log('AnimalsScreen - Current user ID:', currentUserId);
      console.log('AnimalsScreen - Current user role:', currentUserRole);
      
      setUserId(currentUserId);
      setUserRole(currentUserRole);
      
      if (currentUserId) {
        await loadData(currentUserId, currentUserRole);
      }
    } catch (error) {
      console.error('Ekran başlatılırken hata:', error);
    }
  };

  const loadData = async (currentUserId, currentUserRole) => {
    try {
      setLoading(true);
      
      let animalsData, devicesData;
      
      if (currentUserRole === 'admin') {
        // Admin tüm verileri görebilir
        console.log('AnimalsScreen - Admin kullanıcısı: Tüm veriler getiriliyor');
        [animalsData, devicesData] = await Promise.all([
          getAllAnimals(),
          getAllDevices()
        ]);
        console.log('AnimalsScreen - Admin: Tüm hayvanlar ve cihazlar gösteriliyor');
      } else {
        // Normal kullanıcı: Önce kullanıcıya özgü API'leri dene, sonra filtreleme yap
        console.log('AnimalsScreen - Normal kullanıcı: Kullanıcıya özgü veriler getiriliyor');
        try {
          // Yeni API fonksiyonlarını dene
          [animalsData, devicesData] = await Promise.all([
            getUserAnimals(currentUserId),
            getUserDevices(currentUserId)
          ]);
          console.log('AnimalsScreen - Kullanıcıya özgü API başarılı');
        } catch (error) {
          console.log('AnimalsScreen - Kullanıcıya özgü API desteklenmiyor, manuel filtreleme yapılıyor');
          // Fallback: Tüm verileri getir ve frontend'de filtrele
          [animalsData, devicesData] = await Promise.all([
            getAllAnimals(),
            getAllDevices()
          ]);
          
          // Kullanıcıya özgü hayvanları filtrele
          animalsData = (animalsData || []).filter(animal => {
            const matches = animal.userId === currentUserId || animal.userId?.toString() === currentUserId?.toString();
            console.log(`AnimalsScreen Hayvan ${animal.animalName}: userId=${animal.userId}, currentUserId=${currentUserId}, matches=${matches}`);
            return matches;
          });

          // Kullanıcının hayvanlarına bağlı cihazları filtrele
          const userAnimalIds = animalsData.map(animal => animal.animalId);
          devicesData = (devicesData || []).filter(device => {
            const matches = userAnimalIds.includes(device.animalId);
            console.log(`AnimalsScreen Cihaz ${device.deviceName}: animalId=${device.animalId}, userAnimalIds=${userAnimalIds}, matches=${matches}`);
            return matches;
          });
        }
      }
      
      console.log('AnimalsScreen - Final veriler:', {
        hayvanSayisi: animalsData?.length || 0,
        cihazSayisi: devicesData?.length || 0,
        userRole: currentUserRole
      });
      
      setAnimals(animalsData || []);
      setDevices(devicesData || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hayvanlarla ilişkili cihaz sayısı
  const connectedDevices = devices.filter(device => 
    animals.some(animal => animal.animalId === device.animalId)
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hayvan Yönetimi</Text>
        <Text style={styles.headerSubtitle}>Hayvanlarınızı takip edin</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('AnimalList')}
        >
          <Ionicons name="list" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Hayvanlarımı Görüntüle</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickAddButton}
          onPress={() => navigation.navigate('AnimalList')}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Yeni Hayvan Ekle</Text>
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="paw" size={40} color="#3498db" />
            <Text style={styles.statNumber}>{animals.length}</Text>
            <Text style={styles.statLabel}>Toplam Hayvan</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="radio" size={40} color="#e67e22" />
            <Text style={styles.statNumber}>{connectedDevices}</Text>
            <Text style={styles.statLabel}>Aktif Cihaz</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3498db" />
          <Text style={styles.infoText}>
            {animals.length === 0 
              ? "Henüz hiç hayvan eklemediniz. Yeni hayvan eklemek için yukarıdaki butona tıklayın."
              : `${animals.length} hayvanınız kayıtlı. ${connectedDevices} tanesi ESP32 cihazıyla takip ediliyor.`
            }
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#e67e22',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
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
  content: {
    flex: 1,
    padding: 15,
  },
  addButton: {
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  quickAddButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    flex: 1,
    margin: 5,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 15,
    lineHeight: 20,
  },
});

export default AnimalsScreen;
