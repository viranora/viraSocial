import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { COLORS, SPACING } from '../constants/theme';
import { AuthContext } from '../context/AuthContext';

export default function UserListScreen({ route, navigation }) {
  const { type, userId } = route.params; // type: 'followers' veya 'following'
  const { user } = useContext(AuthContext); // Giriş yapmış kullanıcı
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      let usersList = [];

      if (type === 'followers') {
        // --- TAKİPÇİLERİ GETİR ---
        // 'following' listesinde userId olan kullanıcıları bul
        const q = query(collection(db, "users"), where("following", "array-contains", userId));
        const querySnapshot = await getDocs(q);
        usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      } else if (type === 'following') {
        // --- TAKİP EDİLENLERİ GETİR ---
        // 1. Önce hedef kullanıcının 'following' listesini (ID'leri) al
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const followingIds = userDoc.data().following || [];
          
          if (followingIds.length > 0) {
            // 2. Bu ID'lere sahip kullanıcıları çek
            // Not: Firestore 'in' sorgusu en fazla 10 eleman alır. 
            // Basitlik için burada döngüyle çekiyoruz (Listesi çok uzunsa pagination gerekir)
            // Daha sağlam yöntem için 'in' sorgusunu 10'arlı gruplara bölmek gerekir.
            // Şimdilik 10 tanesini çekelim veya döngü kullanalım:
            
            // Yöntem A: ID'leri tek tek çek (Basit ve garantili)
            const promises = followingIds.map(id => getDoc(doc(db, "users", id)));
            const docs = await Promise.all(promises);
            usersList = docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.username); // Var olanları al
          }
        }
      }

      setUsers(usersList);
    } catch (e) {
      console.log("Liste çekme hatası:", e);
    } finally {
      setLoading(false);
    }
  };

  const goToProfile = (targetUserId) => {
    if (targetUserId === user.uid) {
      navigation.navigate('Profile');
    } else {
      navigation.push('OtherProfile', { userId: targetUserId }); // push kullanarak üst üste açılmasını sağla
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => goToProfile(item.id)}>
      <View style={styles.avatarContainer}>
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.username ? item.username[0].toUpperCase() : '?'}</Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.username}>@{item.username}</Text>
        <Text style={styles.role}>{item.role === 'employer' ? 'İş Veren' : 'İş Arayan'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSoft} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {type === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Kimse bulunamadı.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderColor: '#E0D8D4', marginTop: 30 },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginLeft: SPACING.m },
  list: { padding: SPACING.m },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 12, marginBottom: SPACING.s, borderWidth: 1, borderColor: '#EFEBE9' },
  avatarContainer: { marginRight: SPACING.m },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  userInfo: { flex: 1 },
  username: { fontWeight: 'bold', color: COLORS.textMain, fontSize: 16 },
  role: { color: COLORS.textSoft, fontSize: 12 },
  emptyText: { textAlign: 'center', color: COLORS.textSoft, marginTop: 20 },
});