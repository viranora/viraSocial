import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut, deleteUser } from 'firebase/auth';
import { deleteDoc, doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'; 
import { auth, db } from '../../firebaseConfig';
import { COLORS, SPACING } from '../constants/theme';

export default function SettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  // --- LİNKLER ---
  const ABOUT_URL = "https://treasure-pigeon-e11.notion.site/viraSocial-Hakk-nda-2a5c948b160a80e5b155d6c1ed43a70e";
  const PRIVACY_URL = "https://treasure-pigeon-e11.notion.site/Gizlilik-Politikas-2a1c948b160a806ca02ec140362134dd";

  const handleLogout = () => {
    Alert.alert(
      "Çıkış Yap",
      "Hesabından çıkış yapmak istediğine emin misin?",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Çıkış Yap", style: "destructive", onPress: () => signOut(auth) }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Hesabı Kapat",
      "Tüm gönderilerin ve profilin kalıcı olarak silinecek. Emin misin?",
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Hesabı Sil", 
          style: "destructive", 
          onPress: performDelete 
        }
      ]
    );
  };

  const performDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    setLoading(true);
    try {
      // 1. ÖNCE KULLANICININ GÖNDERİLERİNİ BUL VE SİL
      const q = query(collection(db, "posts"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit(); 

      // 2. Kullanıcı Profilini Sil
      await deleteDoc(doc(db, "users", user.uid));

      // 3. Auth Hesabını Sil
      await deleteUser(user);
      
    } catch (error) {
      console.log(error);
      setLoading(false);
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert("Güvenlik", "Hesap silmek için lütfen çıkış yapıp tekrar giriş yap.");
      } else {
        Alert.alert("Hata", "Silinemedi: " + error.message);
      }
    }
  };

  const openLink = (url) => {
    Linking.openURL(url).catch(() => Alert.alert("Hata", "Link açılamadı."));
  };

  const SettingItem = ({ icon, title, onPress, isDestructive = false, isWarning = false }) => (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={styles.itemLeft}>
        <View style={[
            styles.iconContainer, 
            isDestructive && styles.destructiveIcon,
            isWarning && styles.warningIcon 
        ]}>
          <Ionicons 
            name={icon} 
            size={20} 
            color={isDestructive ? COLORS.error : (isWarning ? '#E65100' : COLORS.primary)} 
          />
        </View>
        <Text style={[
            styles.itemText, 
            isDestructive && styles.destructiveText,
            isWarning && styles.warningText
        ]}>
            {title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSoft} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.error} />
            <Text style={{marginTop: 10, color: COLORS.error}}>Hesap ve veriler siliniyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Hesap</Text>
            
            <SettingItem 
                icon="person-outline" 
                title="Profil Bilgilerini Düzenle" 
                onPress={() => navigation.navigate('EditProfile')} 
            />
            
            <SettingItem 
                icon="lock-closed-outline" 
                title="Şifre ve Güvenlik" 
                onPress={() => navigation.navigate('ChangePassword')} 
            />
            
            <SettingItem 
                icon="notifications-outline" 
                title="Bildirimler" 
                onPress={() => Alert.alert("Yakında", "Bildirim ayarları yakında.")} 
            />

            <Text style={styles.sectionTitle}>Hakkında</Text>
            
            {/* LİNKLER BAĞLANDI */}
            <SettingItem 
                icon="information-circle-outline" 
                title="viraSocial Hakkında" 
                onPress={() => openLink(ABOUT_URL)} 
            />
            
            <SettingItem 
                icon="document-text-outline" 
                title="Gizlilik Politikası" 
                onPress={() => openLink(PRIVACY_URL)} 
            />

            <Text style={styles.sectionTitle}>İşlemler</Text>
            <SettingItem icon="log-out-outline" title="Çıkış Yap" onPress={handleLogout} isWarning />
            <SettingItem icon="trash-outline" title="Hesabı Kapat" onPress={handleDeleteAccount} isDestructive />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderColor: '#E0D8D4', marginTop: 30 },
  backBtn: { marginRight: SPACING.m },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  content: { padding: SPACING.m, paddingBottom: 50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textSoft, marginTop: SPACING.l, marginBottom: SPACING.s, marginLeft: SPACING.s },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 12, marginBottom: SPACING.s, borderWidth: 1, borderColor: '#EFEBE9' },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.m },
  destructiveIcon: { backgroundColor: '#FFEBEE' },
  warningIcon: { backgroundColor: '#FFF3E0' },
  itemText: { fontSize: 16, color: COLORS.textMain, fontWeight: '500' },
  destructiveText: { color: COLORS.error, fontWeight: 'bold' },
  warningText: { color: '#E65100', fontWeight: 'bold' },
});