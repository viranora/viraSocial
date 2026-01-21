import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { COLORS, SPACING } from '../constants/theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if(!email || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>viraSocial</Text>
      <Text style={styles.subtitle}>Kariyerin, sadeleşmiş hali.</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor={COLORS.textSoft}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor={COLORS.textSoft}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: SPACING.l }}>
        <Text style={styles.linkText}>Hesabın yok mu? <Text style={{fontWeight: 'bold'}}>Katıl.</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: SPACING.l,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: SPACING.s,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSoft,
    textAlign: 'center',
    marginBottom: SPACING.xl * 2,
  },
  inputContainer: {
    marginBottom: SPACING.l,
  },
  input: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: 12,
    marginBottom: SPACING.m,
    color: COLORS.textMain,
    borderWidth: 1,
    borderColor: '#E0D8D4',
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.m,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkText: {
    color: COLORS.textMain,
    textAlign: 'center',
  },
});