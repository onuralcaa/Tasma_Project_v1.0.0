import math
import time
import requests
import json
import threading
import random

# Başlangıç koordinatları (desimal)
LAT_CENTER = 38.493639
LON_CENTER = 27.706444

# --- API URL'leri ---
LOGIN_URL = "http://188.132.202.184:8080/api/User/Login"
DEVICE_URL = "http://188.132.202.184:8080/api/Device"
SENSOR_URL = "http://188.132.202.184:8080/api/DeviceSensor"

# --- Yön (yaw) hesaplama fonksiyonu ---
def calculate_bearing(lat1, lon1, lat2, lon2):
    """İki GPS noktası arasındaki yön açısını (yaw) hesaplar"""
    dlon = math.radians(lon2 - lon1)
    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)

    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - \
        math.sin(lat1) * math.cos(lat2) * math.cos(dlon)

    bearing = math.atan2(x, y)
    bearing = math.degrees(bearing)
    return (bearing + 360) % 360

# 1 derece enlem ≈ 111320 m
def meters_to_degrees(lat, meters_north, meters_east):
    delta_lat = meters_north / 111320
    delta_lon = meters_east / (40075000 * math.cos(math.radians(lat)) / 360)
    return delta_lat, delta_lon

# 8 (∞) şekli üret
# 8 (∞) şekli üret
def generate_figure_eight_path(lat, lon, radius_m=50, steps=60, reverse=False):
    # kalan kod aynı
    path = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        if reverse:
            t = -t
        x = radius_m * math.sin(t)
        y = radius_m * math.sin(t) * math.cos(t)
        dlat, dlon = meters_to_degrees(lat, y, x)
        path.append((lat + dlat, lon + dlon))
    return path

# Cihaz sınıfı
class SimulatedDevice:
    def __init__(self, mac, reverse_path=False,start_index=0):
        self.mac = mac
        self.token = ""
        self.device_id = ""
        self.device_sensor_id = ""
        self.sensor_exists = False
        self.reverse_path = reverse_path
        self.path = generate_figure_eight_path(LAT_CENTER, LON_CENTER, reverse=reverse_path)
        self.headers = {}
        self.start_index = start_index  # Yeni parametre
    def send_login(self):
        payload = {
            "userName": "polat",
            "passWord": "123456",
            "macAddress": self.mac
        }
        r = requests.post(LOGIN_URL, json=payload)
        if r.ok:
            self.token = r.json().get("token", "")
            self.headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
            print(f"[{self.mac}] Token alındı.")
        else:
            print(f"[{self.mac}] Login failed: {r.status_code}")

    def get_device(self):
        r = requests.get(DEVICE_URL, headers=self.headers)
        if r.ok:
            devices = r.json()
            for d in devices:
                if d.get("deviceMacAdress", "").lower() == self.mac.lower():
                    self.device_id = d.get("deviceId")
                    print(f"[{self.mac}] Device ID bulundu: {self.device_id}")
                    return
        print(f"[{self.mac}] Device alınamadı.")

    def get_device_sensor_id(self):
        if self.sensor_exists:
            return
        r = requests.get(SENSOR_URL, headers=self.headers)
        if r.ok:
            for s in r.json():
                if str(s.get("deviceId")) == str(self.device_id):
                    self.device_sensor_id = s.get("deviceSensorId")
                    self.sensor_exists = True
                    print(f"[{self.mac}] Sensor ID bulundu: {self.device_sensor_id}")
                    return

    def create_device_sensor(self, lat, lon, yaw, pitch, roll):
        body = {
            "deviceSensorLatitude": lat,
            "deviceSensorLongitude": lon,
            "deviceSensorYaw": yaw,
            "deviceSensorPitch": pitch,
            "deviceSensorRoll": roll,
            "deviceSensorAccelaration": 0,
            "deviceSensorBatteryStatus": 0,
            "deviceId": self.device_id
        }
        r = requests.post(SENSOR_URL, headers=self.headers, json=body)
        if r.status_code in [200, 201]:
            try:
                if r.text.strip():
                    data = r.json()
                    self.device_sensor_id = data.get("deviceSensorId")
                    self.sensor_exists = True
                    print(f"[{self.mac}] Sensor oluşturuldu: {self.device_sensor_id}")
                else:
                    print(f"[{self.mac}] Sunucu boş yanıt döndü. Kod: {r.status_code}")
            except json.JSONDecodeError:
                print(f"[{self.mac}] JSON parse hatası. Yanıt: {r.text}")
        else:
            print(f"[{self.mac}] Sensor oluşturulamadı. Kod: {r.status_code} - Yanıt: {r.text}")

    def update_device_sensor(self, lat, lon, yaw, pitch, roll):
        body = {
            "deviceSensorId": self.device_sensor_id,
            "deviceSensorLatitude": lat,
            "deviceSensorLongitude": lon,
            "deviceSensorYaw": yaw,
            "deviceSensorPitch": pitch,
            "deviceSensorRoll": roll,
            "deviceSensorAccelaration": 0,
            "deviceSensorBatteryStatus": 0,
            "deviceId": self.device_id
        }
        r = requests.put(SENSOR_URL, headers=self.headers, json=body)
        if r.status_code == 401:
            print(f"[{self.mac}] Yetkisiz! Tekrar giriş yapılıyor...")
            self.send_login()
        elif r.status_code in [200, 204]:
            print(f"[{self.mac}] Sensor güncellendi.")
        else:
            print(f"[{self.mac}] Sensor güncellenemedi: {r.status_code}")

    def run(self):
        self.send_login()
        if not self.token:
            return
        self.get_device()
        if not self.device_id:
            return

        index = self.start_index  # Başlangıç index'i artık değişken
        total_steps = len(self.path)

        while True:
            lat, lon = self.path[index % total_steps]
            prev_lat, prev_lon = self.path[(index - 1) % total_steps]
            yaw = calculate_bearing(prev_lat, prev_lon, lat, lon)
            pitch = random.uniform(-10, 10)
            roll = random.uniform(-10, 10)

            self.get_device_sensor_id()
            if not self.sensor_exists:
                self.create_device_sensor(lat, lon, yaw, pitch, roll)
            else:
                self.update_device_sensor(lat, lon, yaw, pitch, roll)

            index += 1
            time.sleep(3)

# --- Simülasyonu Başlat ---
device1 = SimulatedDevice("1A:2B:3C:4D:5E:6F", reverse_path=False, start_index=0)
device2 = SimulatedDevice("00:1C:42:7A:89:BC", reverse_path=True, start_index=15)
device3 = SimulatedDevice("AA:BB:CC:DD:EE:01", reverse_path=False, start_index=30)
device4 = SimulatedDevice("AA:BB:CC:DD:EE:02", reverse_path=True, start_index=45)
device5 = SimulatedDevice("AA:BB:CC:DD:EE:03", reverse_path=False, start_index=60)


threading.Thread(target=device1.run).start()
threading.Thread(target=device2.run).start()
threading.Thread(target=device3.run).start()
threading.Thread(target=device4.run).start()
threading.Thread(target=device5.run).start()
