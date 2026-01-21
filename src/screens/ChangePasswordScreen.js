import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';
import { COLORS, SPACING } from '../constants/theme';

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    // 1. Basit Kontroller
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Hata", "Lütfen tüm alanları doldur.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Hata", "Yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Güvenlik Zayıf", "Yeni şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);
    const user = auth.currentUser;

    try {
      // 2. KULLANICIYI YENİDEN DOĞRULA (RE-AUTH)
      // Bu adım olmadan Firebase şifre değiştirmeye izin vermez (Güvenlik Önlemi)
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 3. ŞİFREYİ GÜNCELLE
      await updatePassword(user, newPassword);

      Alert.alert("Başarılı", "Şifren başarıyla güncellendi.", [
        { text: "Tamam", onPress: () => navigation.goBack() }
      ]);
      
    } catch (error) {
      console.log(error.code);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert("Hata", "Mevcut şifreni yanlış girdin.");
      } else if (error.code === 'auth/weak-password') {
        Alert.alert("Hata", "Şifre çok zayıf.");
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert("Hata", "Çok fazla deneme yaptın. Biraz bekle.");
      } else {
        Alert.alert("Hata", "Bir sorun oluştu: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Şifre Değiştir</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.infoText}>
            Güvenliğin için önce mevcut şifreni, ardından yeni şifreni girmelisin.
        </Text>

        <View style={styles.inputContainer}>
            <Text style={styles.label}>Mevcut Şifre</Text>
            <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Şu anki şifren"
                secureTextEntry
                autoCapitalize="none"
            />
        </View>

        <View style={styles.divider} />

        <View style={styles.inputContainer}>
            <Text style={styles.label}>Yeni Şifre</Text>
            <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="En az 6 karakter"
                secureTextEntry
                autoCapitalize="none"
            />
        </View>

        <View style={styles.inputContainer}>
            <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
            <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Şifreni onayla"
                secureTextEntry
                autoCapitalize="none"
            />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword} disabled={loading}>
            {loading ? (
                <ActivityIndicator color={COLORS.white} />
            ) : (
                <Text style={styles.saveBtnText}>Şifreyi Güncelle</Text>
            )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderColor: '#E0D8D4', marginTop: 30 },
  backBtn: { marginRight: SPACING.m },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  content: { padding: SPACING.m },
  infoText: { color: COLORS.textSoft, marginBottom: SPACING.l, lineHeight: 20 },
  inputContainer: { marginBottom: SPACING.m },
  label: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 },
  input: { backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 12, borderWidth: 1, borderColor: '#E0D8D4', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#E0D8D4', marginVertical: SPACING.m },
  saveBtn: { backgroundColor: COLORS.primary, padding: SPACING.m, borderRadius: 12, alignItems: 'center', marginTop: SPACING.m },
  saveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
});