import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const HomeScreen = ({ navigation }) => {
    const { user, logout } = useAuth();
    const { joinRoom } = useSocket();
    const [roomId, setRoomId] = useState('test-room');

    const handleJoin = () => {
        // joinRoom(roomId); // SocketContext handles joining logic? 
        // Actually VoiceChatScreen calls joinRoom inside useEffect. 
        // So we just navigate.
        navigation.navigate('VoiceChat', { roomId });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Hoşgeldin, {user?.username}!</Text>

            <View style={styles.inputContainer}>
                <Text>Oda ID:</Text>
                <TextInput
                    style={styles.input}
                    value={roomId}
                    onChangeText={setRoomId}
                    autoCapitalize="none"
                />
                <Button title="Odaya Katıl" onPress={handleJoin} />
            </View>

            <View style={{ marginTop: 20 }}>
                <Button title="Çıkış Yap" onPress={logout} color="red" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, marginBottom: 20 },
    inputContainer: { width: '100%', marginBottom: 20 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10, borderRadius: 5 }
});

export default HomeScreen;
