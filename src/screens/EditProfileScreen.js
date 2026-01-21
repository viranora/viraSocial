import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

export default function EditProfileScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [cvLink, setCvLink] = useState('');
  const [role, setRole] = useState('seeker');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsername(data.username || '');
        setBio(data.bio || '');
        setCvLink(data.cvLink || '');
        setRole(data.role || 'seeker');
      }
    } catch (e) {
      console.log(e);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { 
        username: username, 
        bio: bio,
        cvLink: cvLink
      });
      Alert.alert("Başarılı", "Profilin güncellendi.", [
        { text: "Tamam", onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert("Hata", "Kaydedilemedi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <ActivityIndicator style={{marginTop: 50}} color={COLORS.primary} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profili Düzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.saveText}>Bitti</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Kullanıcı Adı</Text>
            <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Kullanıcı adı"
            />
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Hakkımda</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Kendinden bahset..."
                multiline
            />
        </View>

        {role === 'seeker' && (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>CV Bağlantısı</Text>
                <TextInput
                    style={styles.input}
                    value={cvLink}
                    onChangeText={setCvLink}
                    placeholder="Link yapıştır..."
                    autoCapitalize="none"
                />
            </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderColor: '#E0D8D4', marginTop: 30 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  saveText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  content: { padding: SPACING.m },
  inputGroup: { marginBottom: SPACING.l },
  label: { fontSize: 14, color: COLORS.textSoft, marginBottom: SPACING.s, fontWeight: '600' },
  input: { backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 12, borderWidth: 1, borderColor: '#E0D8D4', fontSize: 16, color: COLORS.textMain },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
});