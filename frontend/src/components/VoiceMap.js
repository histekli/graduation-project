import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet ikonları düzeltme
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Özel kullanıcı ikonu
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Mevcut kullanıcı ikonu (yeşil)
const currentUserIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Konuşan kullanıcı ikonu (kırmızı)
const talkingUserIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Harita merkezini güncelleme komponenti
const MapUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return null;
};

const VoiceMap = ({
  currentPosition,
  nearbyUsers = [],
  talkingUsers = [],
  onUserClick,
  className = ""
}) => {
  const mapRef = useRef(null);

  // Varsayılan konum (Türkiye - Ankara)
  const defaultCenter = [39.9334, 32.8597];

  // Harita merkezi belirleme
  const mapCenter = currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : defaultCenter;

  // Kullanıcının konuşup konuşmadığını kontrol et
  const isUserTalking = (userId) => {
    return talkingUsers.includes(userId);
  };

  // Kullanıcı ikonu seçimi
  const getUserIcon = (userId, isCurrentUser = false) => {
    if (isCurrentUser) return currentUserIcon;
    if (isUserTalking(userId)) return talkingUserIcon;
    return userIcon;
  };

  // Debug: Kaç kullanıcı render ediliyor?
  useEffect(() => {
    console.log(`🗺️ VoiceMap: ${nearbyUsers.length} kullanıcı render ediliyor:`, nearbyUsers.map(u => u.username));
  }, [nearbyUsers]);

  // Mesafe hesaplama ve formatı
  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        {/* Harita katmanı */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Harita merkezi güncelleme */}
        <MapUpdater center={mapCenter} />

        {/* Mevcut kullanıcı konumu */}
        {currentPosition && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={currentUserIcon}
          >
            <Popup>
              <div className="text-center">
                <div className="font-bold text-green-600">Siz</div>
                <div className="text-sm text-gray-600">
                  Doğruluk: {Math.round(currentPosition.accuracy)}m
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(currentPosition.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Yakındaki kullanıcılar */}
        {nearbyUsers.map((user) => (
          user.location && (
            <Marker
              key={user.userId}
              position={[user.location.latitude, user.location.longitude]}
              icon={getUserIcon(user.userId)}
              eventHandlers={{
                click: () => onUserClick && onUserClick(user)
              }}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-bold text-blue-600">
                    {user.username || 'Bilinmeyen Kullanıcı'}
                  </div>
                  {isUserTalking(user.userId) && (
                    <div className="text-red-500 text-sm font-medium">
                      🎤 Konuşuyor
                    </div>
                  )}
                  {user.distance && (
                    <div className="text-sm text-gray-600">
                      Mesafe: {formatDistance(user.distance)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Son güncelleme: {user.location.timestamp ?
                      new Date(user.location.timestamp).toLocaleTimeString() :
                      'Bilinmiyor'
                    }
                  </div>

                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>

      {/* Harita kontrolleri */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 z-[1000]">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Siz</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Diğer kullanıcılar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Konuşuyor</span>
          </div>
        </div>
      </div>

      {/* Konum durumu */}
      {!currentPosition && (
        <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 z-[1000]">
          <div className="text-yellow-800 text-sm">
            📍 Konum alınıyor...
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceMap;
