import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity, SafeAreaView, FlatList } from 'react-native';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import useMediasoup from '../hooks/useMediasoup';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const VoiceChatScreen = ({ route, navigation }) => {
    const { roomId } = route.params;
    const { user } = useAuth();
    const { socket, joinRoom, leaveRoom, roomUsers } = useSocket();
    const {
        joinAsListener,
        enableMicrophone,
        startTalking,
        stopTalking,
        isConnected,
        isTalking,
        audioPermissionGranted
    } = useMediasoup(socket, roomId, user?._id);

    const [location, setLocation] = useState(null);

    // Join room logic
    useEffect(() => {
        joinRoom(roomId);
        return () => {
            leaveRoom(roomId);
        };
    }, [roomId]);

    // Initial listener join
    useEffect(() => {
        if (socket && isConnected === false) {
            // Note: isConnected here is from useMediasoup, confusing naming with socket.connected
            // We'll trust user manual interaction mostly but auto-join listener
            joinAsListener().catch(e => console.log('Auto-join listener failed', e));
        }
    }, [joinAsListener]);

    // Location logic
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location.coords);

            // Send location update to socket
            if (socket) {
                socket.emit('location_update', {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
            }
        })();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Oda: {roomId}</Text>
                <Text style={styles.status}>{isConnected ? 'Bağlı (Ses)' : 'Bağlanıyor...'}</Text>
            </View>

            {/* Map Section */}
            <View style={styles.mapContainer}>
                {location ? (
                    <MapView
                        style={styles.map}
                        initialRegion={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.0922,
                            longitudeDelta: 0.0421,
                        }}
                    >
                        {/* My Marker */}
                        <Marker
                            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                            title="Ben"
                            pinColor="blue"
                        />

                        {/* Other Users */}
                        {roomUsers.map((u) => {
                            if (u.location && u._id !== user._id) {
                                return (
                                    <Marker
                                        key={u._id}
                                        coordinate={{ latitude: u.location.latitude, longitude: u.location.longitude }}
                                        title={u.username}
                                    />
                                );
                            }
                            return null;
                        })}
                    </MapView>
                ) : (
                    <Text>Konum alınıyor...</Text>
                )}
            </View>

            {/* User List */}
            <View style={styles.userList}>
                <Text style={styles.sectionTitle}>Kullanıcılar ({roomUsers.length})</Text>
                <FlatList
                    data={roomUsers}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <View style={styles.userItem}>
                            <Text>{item.username} {item._id === user._id ? '(Ben)' : ''}</Text>
                        </View>
                    )}
                />
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {!audioPermissionGranted ? (
                    <Button title="Mikrofonu Aç" onPress={enableMicrophone} />
                ) : (
                    <TouchableOpacity
                        style={[styles.pttButton, isTalking && styles.pttButtonActive]}
                        onPressIn={startTalking}
                        onPressOut={stopTalking}
                    >
                        <Text style={styles.pttText}>{isTalking ? 'KONUŞUYOR...' : 'BAS KONUŞ'}</Text>
                    </TouchableOpacity>
                )}

                <View style={{ marginTop: 10 }}>
                    <Button title="Odadan Ayrıl" onPress={() => navigation.goBack()} color="red" />
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
    title: { fontSize: 18, fontWeight: 'bold' },
    status: { fontSize: 12, color: 'green' },
    mapContainer: { height: 300, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e1e1e1' },
    map: { width: '100%', height: '100%' },
    userList: { flex: 1, padding: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    userItem: { padding: 10, backgroundColor: 'white', marginBottom: 5, borderRadius: 5 },
    controls: { padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee' },
    pttButton: {
        backgroundColor: '#3b82f6',
        padding: 20,
        borderRadius: 100,
        alignItems: 'center',
        marginBottom: 10
    },
    pttButtonActive: {
        backgroundColor: '#ef4444'
    },
    pttText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});

export default VoiceChatScreen;
