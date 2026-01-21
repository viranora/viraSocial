import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Keyboard } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

export default function PostScreen({ navigation }) {
  const [text, setText] = useState('');
  const [isJobPost, setIsJobPost] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);

  const handlePost = async () => {
    if (!text.trim()) {
      Alert.alert("Boş Gönderi", "Lütfen bir şeyler yaz.");
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, "posts"), {
        text: text,
        image: null, // Resim artık yok
        userId: user.uid,
        createdAt: serverTimestamp(),
        type: isJobPost ? 'job' : 'social',
      });
      
      setText('');
      setIsJobPost(false);
      Keyboard.dismiss();
      navigation.navigate('Home');
    } catch (e) {
      Alert.alert("Hata", "Gönderi paylaşılamadı: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerText}>Yeni Gönderi</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Aklında ne var? Veya yeni bir iş fırsatı mı?"
        placeholderTextColor={COLORS.textSoft}
        multiline
        value={text}
        onChangeText={setText}
        autoFocus
      />

      {/* Resim Ekleme Butonları Kaldırıldı */}

      <View style={styles.options}>
        <TouchableOpacity 
          style={[styles.optionBtn, isJobPost && styles.optionBtnActive]} 
          onPress={() => setIsJobPost(!isJobPost)}
        >
          <Ionicons 
            name={isJobPost ? "briefcase" : "briefcase-outline"} 
            size={20} 
            color={isJobPost ? COLORS.textMain : COLORS.textSoft} 
            style={{marginRight: 8}}
          />
          <Text style={[styles.optionText, isJobPost && styles.optionTextActive]}>
            {isJobPost ? "İş İlanı Olarak Paylaş" : "Normal Gönderi"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={loading}>
        {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.postBtnText}>Paylaş</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.m,
  },
  header: {
    marginBottom: SPACING.m,
    marginTop: SPACING.l,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textMain,
  },
  input: {
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: 16,
    height: 150,
    textAlignVertical: 'top',
    fontSize: 16,
    color: COLORS.textMain,
    marginBottom: SPACING.m,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  options: {
    flexDirection: 'row',
    marginBottom: SPACING.l,
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: SPACING.m,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    alignItems: 'center',
  },
  optionBtnActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  optionText: {
    color: COLORS.textSoft,
  },
  optionTextActive: {
    color: COLORS.textMain,
    fontWeight: 'bold',
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  postBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});