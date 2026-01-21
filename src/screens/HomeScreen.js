import React, { useState, useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Image, TouchableOpacity, Linking, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator } from 'react-native';
import { collection, query, orderBy, getDocs, getDoc, doc, updateDoc, arrayUnion, arrayRemove, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  
  // FEED STATE
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [filterType, setFilterType] = useState('all');

  // ARAMA STATE (KULLANICI ARAMA İÇİN)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // YORUM STATE
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedPostOwnerId, setSelectedPostOwnerId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // --- 1. SADECE TAKİP ETTİKLERİMİ GETİR ---
  const fetchPosts = async () => {
    setRefreshing(true);
    try {
      // Önce kimi takip ettiğimi öğrenmeliyim
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let followingList = [];
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        followingList = data.following || [];
        setSavedPostIds(data.savedPosts || []);
      }
      
      // Kendimi de listeye ekleyeyim ki kendi gönderilerimi de görebileyim
      if (!followingList.includes(user.uid)) {
        followingList.push(user.uid);
      }

      // Tüm postları çekip JS tarafında filtreleyeceğiz 
      // (Firestore 'in' sorgusu 10 kişi limiti olduğu için bu yöntem şimdilik daha güvenli)
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const postsData = [];
      
      for (const docSnap of querySnapshot.docs) {
        const post = docSnap.data();
        
        // KRİTİK FİLTRE: Sadece takip ettiklerim ve ben
        if (post.userId && followingList.includes(post.userId)) {
            
            // Yazar bilgilerini çek
            let authorData = null;
            const authorSnap = await getDoc(doc(db, "users", post.userId));
            if (authorSnap.exists()) authorData = authorSnap.data();

            if (authorData) {
                postsData.push({ id: docSnap.id, ...post, author: authorData });
            }
        }
      }
      setPosts(postsData);
    } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      if(searchQuery === '') {
          fetchPosts();
      }
    }, [user, searchQuery]) // Arama bitince feed'i yenile
  );

  // --- 2. KULLANICI ARAMA FONKSİYONU ---
  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.length === 0) {
        setSearchResults([]);
        return;
    }

    setSearchLoading(true);
    try {
        // Tüm kullanıcıları çekip isme göre filtrele (Küçük/Büyük harf duyarsız)
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        
        const results = [];
        const lowerText = text.toLowerCase();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const username = data.username ? data.username.toLowerCase() : '';
            // Kendimizi aramada göstermeyelim
            if (doc.id !== user.uid && username.includes(lowerText)) {
                results.push({ id: doc.id, ...data });
            }
        });
        setSearchResults(results);
    } catch (e) {
        console.log(e);
    } finally {
        setSearchLoading(false);
    }
  };

  // --- LIKE ---
  const handleLike = async (post) => {
    const isLiked = post.likes?.includes(user.uid);
    const postRef = doc(db, "posts", post.id);

    const updatedPosts = posts.map(p => {
        if (p.id === post.id) {
            const currentLikes = p.likes || [];
            return {
                ...p,
                likes: isLiked 
                    ? currentLikes.filter(id => id !== user.uid) 
                    : [...currentLikes, user.uid]
            };
        }
        return p;
    });
    setPosts(updatedPosts);

    try {
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(user.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(user.uid) });
            if (post.userId !== user.uid) {
                await addDoc(collection(db, "notifications"), {
                    recipientId: post.userId,
                    senderId: user.uid,
                    type: 'like',
                    postId: post.id,
                    createdAt: serverTimestamp(),
                    read: false,
                });
            }
        }
    } catch (error) { fetchPosts(); }
  };

  // --- YORUM ---
  const openCommentModal = (post) => {
    setSelectedPostId(post.id);
    setSelectedPostOwnerId(post.userId);
    setCommentModalVisible(true);
    const q = query(collection(db, "posts", post.id, "comments"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        await addDoc(collection(db, "posts", selectedPostId, "comments"), {
            text: newComment,
            userId: user.uid,
            username: userData.username || "Anonim",
            profilePic: userData.profilePic || null,
            createdAt: serverTimestamp(),
        });

        if (selectedPostOwnerId && selectedPostOwnerId !== user.uid) {
            await addDoc(collection(db, "notifications"), {
                recipientId: selectedPostOwnerId,
                senderId: user.uid,
                type: 'comment',
                content: newComment,
                postId: selectedPostId,
                createdAt: serverTimestamp(),
                read: false,
            });
        }
        setNewComment('');
        Keyboard.dismiss();
    } catch (error) { Alert.alert("Hata", "Yorum gönderilemedi."); }
    finally { setCommentLoading(false); }
  };

  const handleSaveToggle = async (postId) => {
    const isSaved = savedPostIds.includes(postId);
    const userRef = doc(db, "users", user.uid);
    let newSavedList = isSaved ? savedPostIds.filter(id => id !== postId) : [...savedPostIds, postId];
    setSavedPostIds(newSavedList);
    try { await updateDoc(userRef, { savedPosts: isSaved ? arrayRemove(postId) : arrayUnion(postId) }); } catch (e) {}
  };

  const handleApply = (email) => {
    Linking.openURL(`mailto:${email}?subject=viraSocial Başvuru`).catch(err => alert("Mail uygulaması bulunamadı."));
  };

  const goToProfile = (targetUserId) => {
    setCommentModalVisible(false); 
    if (!targetUserId) return;
    if (targetUserId === user.uid) {
      navigation.navigate('Profile'); 
    } else {
      navigation.navigate('OtherProfile', { userId: targetUserId }); 
    }
  };

  // --- FİLTRELEME (FEED İÇİN) ---
  const getFilteredPosts = () => {
    let result = posts;
    if (filterType !== 'all') {
      result = result.filter(post => post.type === filterType);
    }
    return result;
  };

  // --- RENDER: GÖNDERİ KARTI ---
  const renderPostItem = ({ item }) => {
    const isSaved = savedPostIds.includes(item.id);
    const isLiked = item.likes?.includes(user.uid);
    const likeCount = item.likes?.length || 0;
    const displayName = item.author.username ? `@${item.author.username}` : item.author.email?.split('@')[0];

    return (
      <View style={[styles.card, item.type === 'job' && styles.jobCard]}>
        <View style={styles.cardHeader}>
          <TouchableOpacity style={styles.userInfo} onPress={() => goToProfile(item.userId)} activeOpacity={0.7}>
            {item.author.profilePic ? (
              <Image source={{ uri: item.author.profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{displayName[1]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View>
              <Text style={styles.author}>{displayName}</Text>
              {item.author.role === 'employer' && <Text style={styles.roleLabel}>İş Veren</Text>}
            </View>
          </TouchableOpacity>

          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {item.type === 'job' && <View style={styles.badge}><Text style={styles.badgeText}>İŞ İLANI</Text></View>}
            <TouchableOpacity onPress={() => handleSaveToggle(item.id)} style={{marginLeft: 10}}>
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={24} color={isSaved ? COLORS.primary : COLORS.textSoft} />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.postText}>{item.text}</Text>
        
        <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? COLORS.error : COLORS.textSoft} />
                <Text style={styles.actionText}>{likeCount > 0 ? likeCount : ''}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => openCommentModal(item)}>
                <Ionicons name="chatbubble-outline" size={22} color={COLORS.textSoft} />
                <Text style={styles.actionText}>Yorum</Text>
            </TouchableOpacity>

            {item.type === 'job' && (
                <TouchableOpacity style={[styles.applyBtn]} onPress={() => handleApply(item.author.email)}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.applyText}>Başvur</Text>
                </TouchableOpacity>
            )}
        </View>
      </View>
    );
  };

  // --- RENDER: KULLANICI ARAMA KARTI ---
  const renderUserItem = ({ item }) => (
    <TouchableOpacity style={styles.userSearchCard} onPress={() => goToProfile(item.id)}>
        {item.profilePic ? (
            <Image source={{ uri: item.profilePic }} style={styles.searchAvatar} />
        ) : (
            <View style={styles.searchAvatarPlaceholder}>
                <Text style={styles.searchAvatarText}>{item.username?.[0]?.toUpperCase() || "?"}</Text>
            </View>
        )}
        <View style={{flex: 1}}>
            <Text style={styles.searchUsername}>@{item.username}</Text>
            <Text style={styles.searchRole}>{item.role === 'employer' ? 'İş Veren' : 'Üye'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSoft} />
    </TouchableOpacity>
  );

  const FilterTab = ({ title, type }) => (
    <TouchableOpacity 
      style={[styles.filterTab, filterType === type && styles.activeFilterTab]} 
      onPress={() => setFilterType(type)}
    >
      <Text style={[styles.filterText, filterType === type && styles.activeFilterText]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.logo}>viraSocial</Text></View>

      {/* ARAMA ÇUBUĞU */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSoft} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Kullanıcı ara..."
          placeholderTextColor={COLORS.textSoft}
          value={searchQuery}
          onChangeText={handleSearch} // Metin değiştikçe ara
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSoft} />
          </TouchableOpacity>
        )}
      </View>

      {/* İÇERİK ALANI: EĞER ARAMA VARSA LİSTEYİ DEĞİŞTİR */}
      {searchQuery.length > 0 ? (
          // --- ARAMA SONUÇLARI ---
          <FlatList 
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
                !searchLoading && <Text style={styles.emptyText}>Kullanıcı bulunamadı.</Text>
            }
          />
      ) : (
          // --- NORMAL FEED ---
          <>
            <View style={styles.filterContainer}>
                <FilterTab title="Tümü" type="all" />
                <FilterTab title="İş İlanları" type="job" />
                <FilterTab title="Sosyal" type="social" />
            </View>

            <FlatList
                data={getFilteredPosts()}
                renderItem={renderPostItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchPosts} tintColor={COLORS.primary} />}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Akışın boş. İnsanları takip etmeye başla!</Text></View>}
            />
          </>
      )}

      {/* YORUM MODALI */}
      <Modal visible={commentModalVisible} animationType="slide" transparent onRequestClose={() => setCommentModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Yorumlar</Text>
                    <TouchableOpacity onPress={() => setCommentModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.textMain} /></TouchableOpacity>
                </View>
                <FlatList 
                    data={comments}
                    keyExtractor={item => item.id}
                    renderItem={({item}) => (
                        <TouchableOpacity style={styles.commentItem} onPress={() => goToProfile(item.userId)}>
                            {item.profilePic ? (
                                <Image source={{uri: item.profilePic}} style={styles.commentAvatar} />
                            ) : (
                                <View style={styles.commentAvatarPlaceholder}><Text>{item.username?.[0]}</Text></View>
                            )}
                            <View style={styles.commentTextContainer}>
                                <Text style={styles.commentUser}>@{item.username}</Text>
                                <Text style={styles.commentBody}>{item.text}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 20, color: COLORS.textSoft}}>Henüz yorum yok.</Text>}
                />
                <View style={styles.commentInputContainer}>
                    <TextInput style={styles.commentInput} placeholder="Yorum yap..." value={newComment} onChangeText={setNewComment} />
                    <TouchableOpacity onPress={handleSendComment} disabled={commentLoading}><Ionicons name="send" size={24} color={COLORS.primary} /></TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.m, backgroundColor: COLORS.background },
  logo: { fontSize: 28, fontWeight: 'bold', color: COLORS.textMain, fontStyle: 'italic', textAlign: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: SPACING.m, marginBottom: SPACING.s, borderRadius: 12, paddingHorizontal: SPACING.s, height: 45, borderWidth: 1, borderColor: '#EFEBE9' },
  searchIcon: { marginRight: SPACING.s },
  searchInput: { flex: 1, color: COLORS.textMain, fontSize: 15 },
  filterContainer: { flexDirection: 'row', paddingBottom: SPACING.s, justifyContent: 'center', backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: '#E0D8D4' },
  filterTab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginHorizontal: 4, borderWidth: 1, borderColor: 'transparent' },
  activeFilterTab: { backgroundColor: COLORS.white, borderColor: '#D7CCC8', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 2 },
  filterText: { color: COLORS.textSoft, fontWeight: '600', fontSize: 13 },
  activeFilterText: { color: COLORS.primary, fontWeight: 'bold' },
  list: { padding: SPACING.m },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.m, marginBottom: SPACING.m, shadowColor: "#3E2723", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  jobCard: { backgroundColor: '#FFF8E1', borderColor: '#FFECB3', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.s, alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', zIndex: 10 }, 
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.s, borderWidth: 1, borderColor: COLORS.surface },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.s },
  avatarText: { color: COLORS.textMain, fontWeight: 'bold' },
  author: { fontWeight: 'bold', color: COLORS.textMain, fontSize: 14 },
  roleLabel: { fontSize: 10, color: COLORS.textSoft },
  badge: { backgroundColor: COLORS.textMain, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  postText: { fontSize: 15, color: '#4E342E', lineHeight: 22, marginBottom: SPACING.s },
  emptyContainer: { padding: SPACING.xl, alignItems: 'center', marginTop: SPACING.xl },
  emptyText: { color: COLORS.textSoft, fontStyle: 'italic', marginTop: SPACING.s, textAlign: 'center' },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.s, paddingTop: SPACING.s, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING.l },
  actionText: { marginLeft: 5, color: COLORS.textSoft, fontWeight: '600' },
  applyBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  applyText: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold', marginLeft: 4 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: SPACING.m },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  commentItem: { flexDirection: 'row', marginBottom: SPACING.m },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  commentAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  commentTextContainer: { flex: 1, backgroundColor: '#FAFAFA', padding: 8, borderRadius: 12 },
  commentUser: { fontWeight: 'bold', fontSize: 12, color: COLORS.textMain },
  commentBody: { fontSize: 14, color: COLORS.textMain },
  commentInputContainer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 10, marginTop: 10 },
  commentInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 15, height: 40, marginRight: 10 },

  // --- YENİ EKLENEN STILLER (KULLANICI ARAMA İÇİN) ---
  userSearchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: SPACING.m, borderRadius: 12, marginBottom: SPACING.s, borderBottomWidth: 1, borderBottomColor: '#EFEBE9' },
  searchAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: SPACING.m },
  searchAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary, marginRight: SPACING.m, justifyContent: 'center', alignItems: 'center' },
  searchAvatarText: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  searchUsername: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain },
  searchRole: { fontSize: 12, color: COLORS.textSoft },
});