import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { login } from '../api/auth';
import { mockAuth } from '../api/mockAuth';

const LoginScreen = ({ navigation }) => {
  const [userName, setUserName] = useState('');
  const [passWord, setPassWord] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!userName.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı boş olamaz');
      return;
    }

    if (!passWord.trim()) {
      Alert.alert('Hata', 'Şifre boş olamaz');
      return;
    }

    setLoading(true);
    
    try {
      // Önce gerçek API'yi dene
      console.log('Gerçek API ile giriş deneniyor...');
      let result;
      
      try {
        result = await login(userName.trim(), passWord);
        console.log('Gerçek API başarılı:', result);
      } catch (apiError) {
        console.log('Gerçek API hatası:', apiError.message);
        console.log('API erişilemiyor, kullanıcıya bilgi veriliyor...');
        
        Alert.alert(
          'Bağlantı Hatası', 
          'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
        return;
      }
      
      if (result.success) {
        // Global auth state'ini güncelle
        if (global.updateAuthState) {
          global.updateAuthState();
        }
        
        Alert.alert('Başarılı', 'Giriş başarılı! Hoş geldiniz.', [
          {
            text: 'Tamam',
          },
        ]);
      } else {
        Alert.alert('Hata', result.error || 'Kullanıcı adı veya şifre hatalı');
      }
    } catch (error) {
      console.error('Login hatası:', error);
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    navigation.navigate('Register');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>PeTag</Text>
          <Text style={styles.subtitle}>Giriş Yap</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Kullanıcı Adı</Text>
            <TextInput
              style={styles.input}
              value={userName}
              onChangeText={setUserName}
              placeholder="Kullanıcı adınızı girin"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              value={passWord}
              onChangeText={setPassWord}
              placeholder="Şifrenizi girin"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton} 
            onPress={goToRegister}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Hesabınız yok mu? <Text style={styles.linkTextBold}>Kayıt Ol</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
  },
  linkText: {
    color: '#7f8c8d',
    fontSize: 16,
  },
  linkTextBold: {
    color: '#3498db',
    fontWeight: '600',
  },
});

export default LoginScreen;
