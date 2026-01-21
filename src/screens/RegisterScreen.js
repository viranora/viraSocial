import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { COLORS, SPACING } from '../constants/theme';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState(''); // Yeni alan
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if(!email || !password || !username) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldur.");
      return;
    }
    
    setLoading(true);
    try {
      // 1. Auth ile kullanıcıyı oluştur
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Firestore'a detayları kaydet (username dahil)
      await setDoc(doc(db, "users", userCredential.user.uid), {
        username: username, // <-- ARTIK BU VAR
        email: email,
        role: 'seeker', 
        bio: '',
        cvLink: '',
        profilePic: null,
        savedPosts: [],
        createdAt: new Date(),
      });
      
      // Otomatik giriş yapacağı için yönlendirmeye gerek yok, AuthContext halledecek.
    } catch (error) {
      Alert.alert("Hata", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Aramıza Katıl</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Kullanıcı Adı (Örn: sema_dev)"
        placeholderTextColor={COLORS.textSoft}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor={COLORS.textSoft}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Şifre"
        placeholderTextColor={COLORS.textSoft}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Hesap Oluştur</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: SPACING.l }}>
        <Text style={styles.linkText}>Zaten hesabın var mı? <Text style={{fontWeight: 'bold'}}>Giriş Yap.</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: SPACING.l,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textMain,
    marginBottom: SPACING.xl,
    textAlign: 'center'
  },
  input: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: 12,
    marginBottom: SPACING.m,
    color: COLORS.textMain,
    borderWidth: 1,
    borderColor: '#E0D8D4',
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.s
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkText: {
    color: COLORS.textSoft,
    textAlign: 'center',
  },
});