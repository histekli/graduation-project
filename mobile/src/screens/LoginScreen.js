import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, loginAsGuest } = useAuth();

    const handleLogin = async () => {
        const result = await login(email, password);
        if (!result.success) {
            Alert.alert('Giriş Hatası', result.error);
        }
    };

    const handleGuestLogin = async () => {
        const result = await loginAsGuest(`Misafir_${Math.floor(Math.random() * 1000)}`);
        if (!result.success) {
            Alert.alert('Hata', result.error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>CarVoice Giriş</Text>
            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title="Giriş Yap" onPress={handleLogin} />

            <View style={{ marginTop: 20 }}>
                <Button title="Misafir Olarak Devam Et" onPress={handleGuestLogin} color="gray" />
            </View>

            <View style={{ marginTop: 20 }}>
                <Button title="Kayıt Ol" onPress={() => navigation.navigate('Register')} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 }
});

export default LoginScreen;
