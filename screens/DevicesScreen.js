import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DevicesScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cihaz Yönetimi</Text>
        <Text style={styles.headerSubtitle}>IoT cihazlarınızı kontrol edin</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="hardware-chip" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Yeni Cihaz Ekle</Text>
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="wifi" size={40} color="#27ae60" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Aktif Cihaz</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="battery-full" size={40} color="#f39c12" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Batarya Düşük</Text>
          </View>
        </View>

        <View style={styles.categoryContainer}>
          <Text style={styles.categoryTitle}>Cihaz Kategorileri</Text>
          
          <TouchableOpacity style={styles.categoryCard}>
            <Ionicons name="location" size={30} color="#3498db" />
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>GPS Takip Cihazları</Text>
              <Text style={styles.categoryDesc}>Hayvan konum takibi</Text>
            </View>
            <Text style={styles.categoryCount}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryCard}>
            <Ionicons name="thermometer" size={30} color="#e74c3c" />
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>Sıcaklık Sensörleri</Text>
              <Text style={styles.categoryDesc}>Ortam sıcaklığı ölçümü</Text>
            </View>
            <Text style={styles.categoryCount}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryCard}>
            <Ionicons name="water" size={30} color="#1abc9c" />
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>Nem Sensörleri</Text>
              <Text style={styles.categoryDesc}>Toprak nemi takibi</Text>
            </View>
            <Text style={styles.categoryCount}>0</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3498db" />
          <Text style={styles.infoText}>
            Henüz hiç cihaz eklemediniz. IoT cihazlarınızı ekleyerek çiftliğinizi akıllı hale getirin.
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
    backgroundColor: '#9b59b6',
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
  categoryContainer: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  categoryCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 15,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  categoryDesc: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  categoryCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7f8c8d',
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

export default DevicesScreen;
