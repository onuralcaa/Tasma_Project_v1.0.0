# Tarım.NET Tasma - Akıllı Hayvan Takip Sistemi

React Native tabanlı akıllı hayvan takip uygulaması. ESP32 cihazları ile hayvanların konumlarını gerçek zamanlı olarak takip eder ve güvenli alanlar oluşturarak hayvan güvenliğini sağlar.

## Özellikler

- Gerçek zamanlı hayvan konumu takibi
- ESP32 cihazları ile sensör verisi alma
- Güvenli alan çizimi ve yönetimi
- Cihaz durumu izleme (çevrimiçi/çevrimdışı)
- Hayvan ve cihaz yönetimi
- Admin ve normal kullanıcı rolleri
- Harita tabanlı görselleştirme

## Gereksinimler

### Sistem Gereksinimleri
- Node.js (v16 veya üzeri)
- npm veya yarn
- Android Studio (Android geliştirme için)
- Xcode (iOS geliştirme için - sadece macOS)

### Bağımlılıklar
- React Native
- Expo SDK
- React Navigation
- AsyncStorage
- Expo Location
- React Native WebView

## Kurulum

1. Projeyi bilgisayarınıza indirin:
```bash
git clone [proje-url]
cd Tasma
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Expo CLI'yi global olarak yükleyin (eğer yoksa):
```bash
npm install -g @expo/cli
```

## Çalıştırma

### Geliştirme Sunucusunu Başlatma
```bash
npx expo start
```

### Platform Seçenekleri
- Android emülatör: `a` tuşuna basın
- iOS simülatör: `i` tuşuna basın (sadece macOS)
- Fiziksel cihaz: Expo Go uygulaması ile QR kod okutun//BUNU KULLAN...

### Temiz Başlatma (Cache temizleme)
```bash
npx expo start --clear
```

## API Yapılandırması

Uygulamanın düzgün çalışması için backend API'nin aktif olması gerekir. API endpoints'leri `services/` klasöründe tanımlanmıştır.

### Ana API Fonksiyonları
- Kullanıcı girişi ve kimlik doğrulama
- Hayvan verilerini getirme
- Cihaz sensör verilerini alma
- Güvenli alan (polygon) yönetimi

## Kullanım

1. Uygulamayı başlattıktan sonra giriş yapın
2. Ana haritada cihazların konumlarını görün
3. "Alan Çiz" butonu ile güvenli alanlar oluşturun
4. Yan menüden hayvanları ve cihazları yönetin
5. Gerçek zamanlı güncellemeler otomatik olarak alınır

## Proje Yapısı

```
Tasma/
├── screens/          # Ekran bileşenleri
├── services/         # API servisleri
├── components/       # Yeniden kullanılabilir bileşenler
├── assets/          # Görsel dosyalar
└── App.js           # Ana uygulama dosyası
```

## Önemli Notlar

- Uygulamanın konum izinleri vermesi gerekir
- Internet bağlantısı gereklidir
- ESP32 cihazlarının API'ye veri göndermesi gerekir
- Admin kullanıcıları tüm verileri görebilir
- Normal kullanıcılar sadece kendi hayvanlarını görebilir

## Sorun Giderme

### Sık Karşılaşılan Sorunlar

1. **Metro bundler çalışmıyor**: Cache temizleyin (`npx expo start --clear`)
2. **API bağlantı hatası**: Backend servisinin çalıştığından emin olun
3. **Konum alınamıyor**: Konum izinlerini kontrol edin
4. **Harita yüklenmiyor**: Internet bağlantısını kontrol edin

### Log Takibi
```bash
npx expo start
# Ardından konsolda hata mesajlarını takip edin
```

## Derleme

### Android APK Oluşturma
```bash
npx expo build:android
```

### iOS IPA Oluşturma (sadece macOS)
```bash
npx expo build:ios
```

## Lisans

Bu proje özel mülkiyettir. İzinsiz kullanım yasaktır.
