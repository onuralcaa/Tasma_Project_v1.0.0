# Tarım.NET Tasma - Smart Animal Tracking System

React Native-based intelligent animal tracking application. Real-time location tracking of animals using ESP32 devices, with secure geofencing capabilities to ensure animal safety.

## Features

- Real-time animal location tracking
- Sensor data acquisition from ESP32 devices
- Secure zone creation and management
- Device status monitoring (online/offline)
- Animal and device management
- Admin and regular user roles
- Map-based visualization
- Geofencing and violation alerts
- QR code device identification

## Requirements

### System Requirements
- Node.js (v16 or higher)
- npm or yarn
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)

### Dependencies
- React Native 0.79.5+
- Expo SDK 53+
- React Navigation 7.x
- AsyncStorage
- Expo Location
- Expo Camera
- React Native Maps

## Installation

1. Clone the project to your computer:
```bash
git clone [project-url]
cd Tasma
```

2. Install dependencies:
```bash
npm install
```

3. Install Expo CLI globally (if not already installed):
```bash
npm install -g @expo/cli
```

## Running the Application

### Starting the Development Server
```bash
npx expo start
```

### Platform Options
- Android emulator: Press `a`
- iOS simulator: Press `i` (macOS only)
- Physical device: Scan QR code with Expo Go app

### Clean Start (Clear Cache)
```bash
npx expo start --clear
```

## API Configuration

The application requires an active backend API for proper functionality. API endpoints are defined in the `api/` directory.

### Backend Base URL
- **Production:** `http://188.132.202.184:8080`

### Main API Functions
- User login and authentication
- Fetch animal data
- Retrieve device sensor data
- Manage secure zones (polygons)

## Project Structure

```
Tasma/
├── App.js                          # Entry point - Auth state management
├── index.js                        # Expo registration
├── package.json                    # Dependencies and scripts
├── app.json                        # Expo configuration
├── api/                            # Backend API integration
│   ├── auth.js                     # Authentication & JWT management
│   ├── animal.js                   # Animal CRUD operations
│   ├── device.js                   # Device CRUD operations
│   ├── deviceSensor.js             # Real-time sensor data
│   └── mockAuth.js                 # Mock authentication (unused)
├── screens/                        # Application screens
│   ├── SplashScreen.js             # Splash screen animation
│   ├── LoginScreen.js              # User login
│   ├── RegisterScreen.js           # User registration
│   ├── HomeScreen.js               # Map with real-time tracking
│   ├── AnimalsScreen.js            # Animal dashboard
│   ├── AnimalListScreen.js         # Detailed animal list
│   ├── AddAnimalScreen.js          # Add animal form
│   ├── DevicesScreen.js            # Device overview
│   ├── DeviceListScreen.js         # Device management
│   └── AccountScreen.js            # User profile & logout
├── navigation/                     # Navigation configuration
│   ├── TabNavigator.js             # Bottom tab navigation
│   └── AnimalStackNavigator.js     # Animal screen stack
├── services/                       # Business logic services
│   └── polygonService.js           # Geofence API calls
├── utils/                          # Utility functions
│   ├── storage.js                  # AsyncStorage & JWT utilities
│   ├── axiosInstance.js            # Axios with interceptors
│   └── debugHelper.js              # Debug utilities
└── assets/                         # Images and resources
```

## Usage

1. Launch the application and log in with your credentials
2. View device locations on the interactive map
3. Create secure zones using the drawing tools
4. Manage animals and devices from the side menu
5. Receive real-time location updates automatically

## Key Features Explained

### Authentication
- JWT token-based login and registration
- Automatic token renewal
- Role-based access control (admin/user)
- Secure token storage with AsyncStorage

### Real-Time Tracking (HomeScreen)
- Interactive map display
- GPS location updates from ESP32 devices
- 10-second refresh intervals for sensor data
- Live data indication with pulse animation
- Online/offline device status

### Geofencing System
- Draw custom safe zones on the map
- Create, update, and delete geofence areas
- Real-time violation detection
- Violation alerts and notifications
- User-scoped zone management

### Device Management
- Add devices with MAC address validation
- QR code scanner for device identification
- Edit and delete device operations
- Animal-device associations
- Device online/offline tracking

### Animal Management
- Create, read, update, and delete animals
- Associate animals with tracking devices
- Role-based filtering (admin sees all, users see their own)

## Important Notes

- Location permissions are required for proper functionality
- Active internet connection is necessary
- ESP32 devices must send data to the API
- Admin users can view all data
- Regular users can only view their own animals
- 60-second API request timeout is configured

## Troubleshooting

### Common Issues

1. **Metro bundler not working**: Clear cache with `npx expo start --clear`
2. **API connection error**: Ensure the backend service is running
3. **Location not available**: Check location permissions in your device settings
4. **Map not loading**: Verify your internet connection

### Viewing Logs
```bash
npx expo start
# Monitor console for error messages
```

## Building for Production

### Build Android APK
```bash
npx expo build:android
```

### Build iOS IPA (macOS only)
```bash
npx expo build:ios
```

## Technology Stack

- **Frontend Framework:** React Native with Expo
- **Navigation:** React Navigation v7+
- **State Management:** React Hooks (useState, useEffect)
- **HTTP Client:** Axios with JWT interceptors
- **Local Storage:** AsyncStorage
- **Location Services:** Expo Location
- **Camera:** Expo Camera
- **Backend:** .NET/C# REST API

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Support

For support, please contact the development team or open an issue in the project repository.

---

**License:** MIT
