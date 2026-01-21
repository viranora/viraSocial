import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, orderBy, getDocs, getCountFromServer, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

export default function OtherProfileScreen({ route, navigation }) {
  const { userId } = route.params; 
  const { user } = useContext(AuthContext); 
  
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  // YORUM STATE
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchProfile();
    checkFollowStatus();
    fetchUserPosts();
    fetchStats();
  }, [userId]);

  const fetchProfile = async () => {
    const docSnap = await getDoc(doc(db, "users", userId));
    if (docSnap.exists()) {
      setProfileData(docSnap.data());
    }
  };

  const checkFollowStatus = async () => {
    const myDoc = await getDoc(doc(db, "users", user.uid));
    if (myDoc.exists()) {
      const myData = myDoc.data();
      const followingList = myData.following || [];
      setIsFollowing(followingList.includes(userId));
    }
  };

  const fetchStats = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      const followingCount = userDoc.exists() ? (userDoc.data().following?.length || 0) : 0;

      const q = query(collection(db, "users"), where("following", "array-contains", userId));
      const snapshot = await getCountFromServer(q);
      const followersCount = snapshot.data().count;

      setStats({ following: followingCount, followers: followersCount });
    } catch (e) { console.log(e); }
  };

  const fetchUserPosts = async () => {
    try {
      const q = query(collection(db, "posts"), where("userId", "==", userId), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleLike = async (post) => {
    const isLiked = post.likes?.includes(user.uid);
    const postRef = doc(db, "posts", post.id);

    const updatedPosts = posts.map(p => {
        if (p.id === post.id) {
            const currentLikes = p.likes || [];
            return {
                ...p,
                likes: isLiked ? currentLikes.filter(id => id !== user.uid) : [...currentLikes, user.uid]
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
            // BEĞENİ BİLDİRİMİ
            if (userId !== user.uid) {
                await addDoc(collection(db, "notifications"), {
                    recipientId: userId,
                    senderId: user.uid,
                    type: 'like',
                    postId: post.id,
                    createdAt: serverTimestamp(),
                    read: false,
                });
            }
        }
    } catch (error) { fetchUserPosts(); }
  };

  const openCommentModal = (postId) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
    const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const ud = userDoc.data();
        await addDoc(collection(db, "posts", selectedPostId, "comments"), {
            text: newComment,
            userId: user.uid,
            username: ud.username || "Anonim",
            profilePic: ud.profilePic || null,
            createdAt: serverTimestamp(),
        });
        
        // YORUM BİLDİRİMİ
        if (userId !== user.uid) {
            await addDoc(collection(db, "notifications"), {
                recipientId: userId,
                senderId: user.uid,
                type: 'comment',
                content: newComment,
                postId: selectedPostId,
                createdAt: serverTimestamp(),
                read: false,
            });
        }
        setNewComment('');
    } catch (e) { Alert.alert("Hata", "Yorum atılamadı."); }
  };

  // --- GÜNCELLENEN TAKİP FONKSİYONU ---
  const handleFollowToggle = async () => {
    const myRef = doc(db, "users", user.uid);
    try {
      if (isFollowing) {
        await updateDoc(myRef, { following: arrayRemove(userId) });
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
      } else {
        await updateDoc(myRef, { following: arrayUnion(userId) });
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));

        // TAKİP BİLDİRİMİ
        await addDoc(collection(db, "notifications"), {
            recipientId: userId,
            senderId: user.uid,
            type: 'follow',
            createdAt: serverTimestamp(),
            read: false,
        });
      }
    } catch (e) { Alert.alert("Hata", "İşlem yapılamadı."); }
  };

  const goToProfile = (targetUserId) => {
    setCommentModalVisible(false);
    if(targetUserId === user.uid) {
        navigation.navigate('Profile');
    } else {
        if(targetUserId === userId) return;
        navigation.push('OtherProfile', { userId: targetUserId });
    }
  };

  const openUserList = (type) => {
    navigation.push('UserList', { type: type, userId: userId });
  };

  const renderHeader = () => {
    if (!profileData) return <ActivityIndicator color={COLORS.primary} />;
    
    return (
      <View style={styles.headerContainer}>
        <View style={styles.topSection}>
            <View style={styles.avatarContainer}>
            {profileData.profilePic ? (
                <Image source={{ uri: profileData.profilePic }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>?</Text>
                </View>
            )}
            </View>
            
            <View style={styles.statsContainer}>
                <TouchableOpacity style={styles.statItem} onPress={() => openUserList('followers')}>
                    <Text style={styles.statNumber}>{stats.followers}</Text>
                    <Text style={styles.statLabel}>Takipçi</Text>
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <TouchableOpacity style={styles.statItem} onPress={() => openUserList('following')}>
                    <Text style={styles.statNumber}>{stats.following}</Text>
                    <Text style={styles.statLabel}>Takip</Text>
                </TouchableOpacity>
            </View>
        </View>

        <Text style={styles.username}>@{profileData.username || 'kullanici'}</Text>
        <Text style={styles.role}>
           {profileData.role === 'seeker' ? '🔍 İş Arayan' : '💼 İş Veren'}
        </Text>

        {profileData.bio ? <Text style={styles.bio}>{profileData.bio}</Text> : null}

        {user.uid !== userId && (
          <TouchableOpacity 
            style={[styles.followBtn, isFollowing ? styles.followingBtn : styles.notFollowingBtn]} 
            onPress={handleFollowToggle}
          >
            <Text style={[styles.followText, isFollowing ? styles.followingText : styles.notFollowingText]}>
              {isFollowing ? "Takip Ediliyor" : "Takip Et"}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider}>
          <Text style={styles.dividerText}>Paylaşımlar</Text>
        </View>
      </View>
    );
  };

  const renderPost = ({ item }) => {
    const isLiked = item.likes?.includes(user.uid);
    const likeCount = item.likes?.length || 0;

    return (
        <View style={styles.postCard}>
        <Text style={styles.postDate}>
            {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''}
        </Text>
        <Text style={styles.postText}>{item.text}</Text>
        
        {item.type === 'job' && (
            <View style={{ backgroundColor: '#FFF8E1', alignSelf: 'flex-start', padding: 4, borderRadius: 4, marginTop: 5 }}>
                <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: 'bold' }}>İş İlanı</Text>
            </View>
        )}

        <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? COLORS.error : COLORS.textSoft} />
                <Text style={styles.actionText}>{likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => openCommentModal(item.id)}>
                <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSoft} />
                <Text style={styles.actionText}>Yorum</Text>
            </TouchableOpacity>
        </View>
        </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profil</Text>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>Henüz gönderisi yok.</Text>}
      />

      {/* YORUM MODALI */}
      <Modal visible={commentModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.commentModalOverlay}>
            <View style={styles.commentModalContent}>
                <View style={styles.commentHeader}>
                    <Text style={{fontWeight:'bold'}}>Yorumlar</Text>
                    <TouchableOpacity onPress={() => setCommentModalVisible(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
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
                <View style={styles.commentInputRow}>
                    <TextInput style={styles.commentInput} value={newComment} onChangeText={setNewComment} placeholder="Yorum..." />
                    <TouchableOpacity onPress={handleSendComment}><Ionicons name="send" size={24} color={COLORS.primary} /></TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderColor: '#E0D8D4', marginTop: 30 },
  topBarTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: SPACING.m, color: COLORS.textMain },
  
  headerContainer: { padding: SPACING.l },
  topSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.m },
  
  avatarContainer: {},
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#BCAAA4', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 30, color: COLORS.white },

  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginLeft: SPACING.l },
  statItem: { alignItems: 'center', padding: 5 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  statLabel: { fontSize: 12, color: COLORS.textSoft },
  statDivider: { width: 1, height: 30, backgroundColor: '#E0D8D4' },

  username: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
  role: { color: COLORS.textSoft, marginBottom: SPACING.s },
  bio: { marginVertical: SPACING.s, color: COLORS.textMain },
  
  followBtn: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20, marginTop: SPACING.m, borderWidth: 1, alignSelf: 'center', width: '100%', alignItems: 'center' },
  notFollowingBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  followingBtn: { backgroundColor: 'transparent', borderColor: COLORS.textSoft },
  followText: { fontWeight: 'bold' },
  notFollowingText: { color: COLORS.white },
  followingText: { color: COLORS.textSoft },

  divider: { width: '100%', borderBottomWidth: 1, borderColor: '#E0D8D4', marginTop: SPACING.xl, marginBottom: SPACING.s, paddingBottom: SPACING.s },
  dividerText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain },
  
  postCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.m, marginBottom: SPACING.m, padding: SPACING.m, borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9' },
  postDate: { fontSize: 12, color: COLORS.textSoft, marginBottom: 5 },
  postText: { fontSize: 15, color: COLORS.textMain },
  emptyText: { textAlign: 'center', color: COLORS.textSoft, marginTop: 20 },

  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  actionButton: { flexDirection: 'row', marginRight: 20 },
  actionText: { marginLeft: 5, color: COLORS.textSoft },
  commentModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  commentModalContent: { backgroundColor: 'white', height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth:1, borderColor:'#eee', paddingBottom:10 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  commentInput: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, height: 40, marginRight: 10 },
  commentItem: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  commentAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  commentTextContainer: { flex: 1, backgroundColor: '#FAFAFA', padding: 8, borderRadius: 12 },
  commentUser: { fontWeight: 'bold', fontSize: 12, color: COLORS.textMain },
  commentBody: { fontSize: 14, color: COLORS.textMain },
});