import React, { useState, useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { doc, getDoc, documentId, query, collection, where, getDocs } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SavedScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchSavedPosts();
    }, [user])
  );

  const fetchSavedPosts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const savedIds = userDoc.data()?.savedPosts || [];

      if (savedIds.length === 0) {
        setSavedPosts([]);
        setLoading(false);
        return;
      }

      const q = query(collection(db, "posts"), where(documentId(), 'in', savedIds.slice(0, 10)));
      const querySnapshot = await getDocs(q);
      
      const postsData = [];
      for (const docSnap of querySnapshot.docs) {
        const post = docSnap.data();
        let authorData = { email: 'Anonim', username: 'Anonim' };
        if (post.userId) {
          const userSnap = await getDoc(doc(db, "users", post.userId));
          if (userSnap.exists()) authorData = userSnap.data();
        }
        postsData.push({ id: docSnap.id, ...post, author: authorData });
      }
      setSavedPosts(postsData);

    } catch (e) {
      console.error("Kaydedilenler çekilemedi:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (email) => {
    const url = `mailto:${email}?subject=viraSocial Başvuru`;
    Linking.openURL(url);
  };

  const renderItem = ({ item }) => {
    const displayName = item.author.username 
      ? `@${item.author.username}` 
      : item.author.email?.split('@')[0];

    return (
      <View style={[styles.card, item.type === 'job' && styles.jobCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            {item.author.profilePic ? (
              <Image source={{ uri: item.author.profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{displayName[1]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View>
              <Text style={styles.author}>{displayName}</Text>
              {item.type === 'job' && <Text style={styles.roleLabel}>İş İlanı</Text>}
            </View>
          </View>
        </View>
        
        <Text style={styles.postText}>{item.text}</Text>

        {/* Resim Alanı (YENİ) */}
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
        )}
        
        {item.type === 'job' && (
          <TouchableOpacity style={styles.applyBtn} onPress={() => handleApply(item.author.email)}>
            <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
            <Text style={styles.applyText}>Başvur</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kayıtlı İlanlarım</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={savedPosts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={60} color={COLORS.secondary} />
              <Text style={styles.emptyText}>Henüz bir şey kaydetmedin.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: '#E0D8D4', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  list: { padding: SPACING.m },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.m, marginBottom: SPACING.m, shadowColor: "#3E2723", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  jobCard: { backgroundColor: '#FFF8E1', borderColor: '#FFECB3', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.m, alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.s },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.s },
  avatarText: { color: COLORS.textMain, fontWeight: 'bold' },
  author: { fontWeight: 'bold', color: COLORS.textMain, fontSize: 14 },
  roleLabel: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold' },
  postText: { fontSize: 15, color: '#4E342E', lineHeight: 22, marginBottom: SPACING.s },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginTop: SPACING.s, marginBottom: SPACING.s }, // YENİ STİL
  applyBtn: { marginTop: SPACING.s, paddingTop: SPACING.s, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  applyText: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold', marginLeft: 6 },
  emptyContainer: { alignItems: 'center', marginTop: SPACING.xl * 2 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginTop: SPACING.m },
});