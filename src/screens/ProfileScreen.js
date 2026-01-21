import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, FlatList, Modal, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy, arrayUnion, arrayRemove, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

export default function ProfileScreen() {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]); 
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  
  const [postsLoading, setPostsLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentPost, setCurrentPost] = useState(null);
  const [editText, setEditText] = useState('');

  // YORUM STATE'LERİ
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchUserPosts();
      fetchStats();
    }, [user])
  );

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    } catch (e) { console.log(e); }
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      const myDoc = await getDoc(doc(db, "users", user.uid));
      let followingCount = 0;
      if (myDoc.exists() && myDoc.data().following) {
         followingCount = myDoc.data().following.length;
      }
      const q = query(collection(db, "users"), where("following", "array-contains", user.uid));
      const querySnapshot = await getDocs(q);
      setStats({ following: followingCount, followers: querySnapshot.size });
    } catch (e) { setStats({ following: 0, followers: 0 }); }
  };

  const fetchUserPosts = async () => {
    if (!user) return;
    setPostsLoading(true);
    try {
      const q = query(collection(db, "posts"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserPosts(posts);
    } catch (e) { setUserPosts([]); } finally { setPostsLoading(false); }
  };

  const handleLike = async (post) => {
    const isLiked = post.likes?.includes(user.uid);
    const postRef = doc(db, "posts", post.id);

    const updatedPosts = userPosts.map(p => {
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
    setUserPosts(updatedPosts);

    try {
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(user.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(user.uid) });
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
        setNewComment('');
    } catch (e) { Alert.alert("Hata", "Yorum atılamadı."); }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return Alert.alert("İzin Gerekli", "Galeri izni lazım.");
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await updateDoc(doc(db, "users", user.uid), { profilePic: base64Img });
      setUserData({ ...userData, profilePic: base64Img });
    }
  };

  const toggleRole = async () => {
    if (!userData) return;
    const newRole = userData.role === 'seeker' ? 'employer' : 'seeker';
    try {
        await updateDoc(doc(db, "users", user.uid), { role: newRole });
        setUserData({ ...userData, role: newRole });
    } catch(e) {}
  };

  const handleDeletePost = (postId) => {
    Alert.alert("Sil", "Emin misin?", [
      { text: "Vazgeç" },
      { text: "Sil", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "posts", postId));
          setUserPosts(prev => prev.filter(p => p.id !== postId));
      }}
    ]);
  };

  const savePostEdit = async () => {
    if (!currentPost) return;
    await updateDoc(doc(db, "posts", currentPost.id), { text: editText });
    setUserPosts(prev => prev.map(p => p.id === currentPost.id ? { ...p, text: editText } : p));
    setEditModalVisible(false);
  };

  const openUserList = (type) => navigation.navigate('UserList', { type, userId: user.uid });

  // YORUM YAPANIN PROFİLİNE GİTME
  const goToProfile = (targetUserId) => {
    setCommentModalVisible(false);
    if(targetUserId === user.uid) return; // Zaten kendi profilindesin
    navigation.navigate('OtherProfile', { userId: targetUserId });
  };

  const renderHeader = () => {
    if (!userData) return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 50 }} />;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Profilim</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>

        <View style={styles.topSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {userData.profilePic ? (
              <Image source={{ uri: userData.profilePic }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="camera" size={30} color={COLORS.white} />
              </View>
            )}
            <View style={styles.editIcon}><Ionicons name="pencil" size={12} color={COLORS.white} /></View>
          </TouchableOpacity>

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

        <View style={styles.infoSection}>
          <Text style={styles.usernameDisplay}>@{userData.username || 'kullanici'}</Text>
          <Text style={styles.email}>{userData.email}</Text>
          
          <TouchableOpacity style={styles.roleBadge} onPress={toggleRole}>
            <Text style={styles.roleText}>
              {userData.role === 'seeker' ? '🔍 İş Arayan' : '💼 İş Veren'}
            </Text>
          </TouchableOpacity>

          {userData.bio ? <Text style={styles.bioText}>{userData.bio}</Text> : null}
          
          {userData.role === 'seeker' && userData.cvLink ? (
             <TouchableOpacity onPress={() => Linking.openURL(userData.cvLink)} style={styles.cvLink}>
                <Ionicons name="link" size={16} color={COLORS.primary} />
                <Text style={styles.cvLinkText}>CV Görüntüle</Text>
             </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>Paylaşımlarım</Text>
        </View>
      </View>
    );
  };

  const renderPostItem = ({ item }) => {
    const isLiked = item.likes?.includes(user.uid);
    const likeCount = item.likes?.length || 0;

    return (
        <View style={styles.postCard}>
        <View style={styles.postHeader}>
            <Text style={styles.postDate}>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : ''}</Text>
            <View style={styles.postActions}>
            <TouchableOpacity onPress={() => { setCurrentPost(item); setEditText(item.text); setEditModalVisible(true); }} style={styles.actionBtn}>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeletePost(item.id)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
            </View>
        </View>
        <Text style={styles.postText}>{item.text}</Text>
        
        {item.type === 'job' && (
            <View style={styles.jobBadge}>
            <Text style={styles.jobBadgeText}>İş İlanı</Text>
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
    <SafeAreaView style={styles.container}>
      <FlatList
        data={userPosts}
        keyExtractor={item => item.id}
        renderItem={renderPostItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!postsLoading && <Text style={styles.emptyText}>Henüz gönderin yok.</Text>}
      />
      
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Düzenle</Text>
            <TextInput style={styles.modalInput} value={editText} onChangeText={setEditText} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><Text style={styles.cancelBtnText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={savePostEdit}><Text style={styles.saveModalBtnText}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { padding: SPACING.m },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
  screenTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
  topSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.m, paddingHorizontal: SPACING.s },
  avatarContainer: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#BCAAA4', justifyContent: 'center', alignItems: 'center' },
  editIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.primary, padding: 6, borderRadius: 12 },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginLeft: SPACING.l },
  statItem: { alignItems: 'center', padding: 5 },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  statLabel: { fontSize: 12, color: COLORS.textSoft },
  statDivider: { width: 1, height: 30, backgroundColor: '#E0D8D4' },
  infoSection: { marginBottom: SPACING.l, paddingHorizontal: SPACING.s },
  usernameDisplay: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
  email: { fontSize: 14, color: COLORS.textSoft, marginBottom: SPACING.s },
  roleBadge: { backgroundColor: COLORS.surface, padding: SPACING.s, borderRadius: 8, alignSelf: 'flex-start', marginBottom: SPACING.s },
  roleText: { color: COLORS.textMain, fontWeight: '600' },
  bioText: { fontSize: 15, color: COLORS.textMain, lineHeight: 22, marginBottom: SPACING.s },
  cvLink: { flexDirection: 'row', alignItems: 'center' },
  cvLinkText: { color: COLORS.primary, marginLeft: 5, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.m },
  dividerText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginLeft: SPACING.s },
  postCard: { backgroundColor: COLORS.white, marginHorizontal: SPACING.m, marginBottom: SPACING.m, padding: SPACING.m, borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.s },
  postDate: { color: COLORS.textSoft, fontSize: 12 },
  postActions: { flexDirection: 'row' },
  actionBtn: { marginLeft: SPACING.m },
  postText: { fontSize: 14, color: COLORS.textMain, marginBottom: SPACING.s },
  jobBadge: { backgroundColor: '#FFF8E1', alignSelf: 'flex-start', padding: 4, borderRadius: 4 },
  jobBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: COLORS.textSoft, marginTop: 20, fontStyle: 'italic' },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: SPACING.l },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.l },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: SPACING.m, textAlign: 'center' },
  modalInput: { backgroundColor: COLORS.background, padding: SPACING.m, borderRadius: 8, minHeight: 100, textAlignVertical: 'top', marginBottom: SPACING.l, color: COLORS.textMain },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtnText: { color: COLORS.textMain, fontWeight: 'bold' },
  saveModalBtnText: { color: COLORS.primary, fontWeight: 'bold' },
  
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