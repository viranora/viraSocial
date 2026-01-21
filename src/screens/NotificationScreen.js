import React, { useState, useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Bana gelen bildirimleri çek (recipientId == benim ID'm)
      const q = query(
        collection(db, "notifications"), 
        where("recipientId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const notifs = [];

      for (const docSnap of querySnapshot.docs) {
        const notifData = docSnap.data();
        
        // Gönderen kişinin güncel bilgilerini (PP, Username) çek
        // (Veritabanı şişmesin diye sadece ID tutuyoruz, anlık çekiyoruz)
        let senderData = { username: 'Biri', profilePic: null };
        if (notifData.senderId) {
            const senderSnap = await getDoc(doc(db, "users", notifData.senderId));
            if (senderSnap.exists()) {
                senderData = senderSnap.data();
            }
        }

        notifs.push({
            id: docSnap.id,
            ...notifData,
            sender: senderData
        });
      }
      setNotifications(notifs);
    } catch (e) {
      console.log("Bildirim hatası:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const handlePress = (item) => {
    // Bildirime tıklayınca o kişinin profiline gitsin
    if (item.senderId !== user.uid) {
        navigation.navigate('OtherProfile', { userId: item.senderId });
    }
  };

  const renderItem = ({ item }) => {
    let iconName = "notifications";
    let iconColor = COLORS.textSoft;
    let message = "";

    switch(item.type) {
        case 'like':
            iconName = "heart";
            iconColor = COLORS.error;
            message = "gönderini beğendi.";
            break;
        case 'comment':
            iconName = "chatbubble";
            iconColor = COLORS.primary;
            message = `yorum yaptı: "${item.content}"`;
            break;
        case 'follow':
            iconName = "person-add";
            iconColor = "#29B6F6"; // Açık mavi
            message = "seni takip etmeye başladı.";
            break;
    }

    return (
      <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
        <View style={styles.avatarContainer}>
            {item.sender.profilePic ? (
                <Image source={{ uri: item.sender.profilePic }} style={styles.avatar} />
            ) : (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{item.sender.username?.[0]}</Text>
                </View>
            )}
            <View style={styles.iconBadge}>
                <Ionicons name={iconName} size={12} color={iconColor} />
            </View>
        </View>
        
        <View style={styles.textContainer}>
            <Text style={styles.contentText}>
                <Text style={styles.username}>@{item.sender.username} </Text>
                {message}
            </Text>
            <Text style={styles.dateText}>
                {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''}
            </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bildirimler</Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
            !loading && (
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSoft} />
                    <Text style={styles.emptyText}>Henüz bildirim yok.</Text>
                </View>
            )
        }
      />
      {loading && <ActivityIndicator style={{position:'absolute', alignSelf:'center', top: 100}} color={COLORS.primary} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: '#E0D8D4', backgroundColor: COLORS.background },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
  list: { padding: SPACING.m },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 12, marginBottom: SPACING.s, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatarContainer: { position: 'relative', marginRight: SPACING.m },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', color: COLORS.textMain },
  iconBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: COLORS.white, borderRadius: 10, padding: 2, elevation: 2 },
  textContainer: { flex: 1 },
  contentText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  username: { fontWeight: 'bold' },
  dateText: { fontSize: 12, color: COLORS.textSoft, marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { marginTop: 10, color: COLORS.textSoft },
});