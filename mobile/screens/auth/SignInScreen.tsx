import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StackParamList } from '../../App';

type SignInScreenProps = NativeStackScreenProps<StackParamList, 'SignInScreen'>;

export function SignInScreen({ navigation }: SignInScreenProps) {
  const { setGuestMode, isLoading } = useAuth();

  const handleGuestMode = () => {
    setGuestMode();
    navigation.replace('HomeScreen' as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>🎭</Text>
        <Text style={styles.title}>Welcome to MERN Mafia</Text>
        <Text style={styles.subtitle}>
          Track your games, compete on leaderboards, and become the ultimate Mafia player
        </Text>

        <View style={styles.buttonContainer}>
          {/* Google Sign In - Coming Soon */}
          <TouchableOpacity
            style={[styles.googleButton, styles.disabledButton]}
            disabled={true}
          >
            <Text style={styles.googleButtonText}>
              🔜 Sign in with Google (Coming Soon)
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest Mode */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestMode}
            disabled={isLoading}
          >
            <Text style={styles.guestButtonText}>
              {isLoading ? 'Loading...' : 'Continue as Guest'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.guestInfo}>
            Guest mode allows you to play immediately but won't track your stats or history
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 48,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#444',
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#444',
  },
  dividerText: {
    color: '#888',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  guestButton: {
    backgroundColor: '#3333FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  guestInfo: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  disclaimer: {
    position: 'absolute',
    bottom: 24,
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
