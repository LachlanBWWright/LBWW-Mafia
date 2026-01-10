import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { type StackParamList } from '../../App';

type AccountScreenProps = NativeStackScreenProps<StackParamList, 'AccountScreen'>;

export function AccountScreen({ navigation }: AccountScreenProps) {
  const { user, isGuest, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigation.replace('SignInScreen');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.[0] ?? '👤'}
          </Text>
        </View>
        <Text style={styles.name}>
          {isGuest ? 'Guest Player' : user?.name ?? 'Player'}
        </Text>
        {user?.email && (
          <Text style={styles.email}>{user.email}</Text>
        )}
        {isGuest && (
          <Text style={styles.guestBadge}>Playing in Guest Mode</Text>
        )}
      </View>

      {isGuest && (
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeTitle}>📊 Track Your Progress</Text>
          <Text style={styles.upgradeText}>
            Sign in to save your match history, view detailed stats, and compete on leaderboards
          </Text>
          <TouchableOpacity style={styles.upgradeButton} disabled>
            <Text style={styles.upgradeButtonText}>
              Sign In (Coming Soon)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.menuItem} disabled={isGuest}>
          <Text style={styles.menuIcon}>📜</Text>
          <Text style={[styles.menuText, isGuest && styles.disabled]}>
            Match History
          </Text>
          {isGuest && <Text style={styles.guestLabel}>Requires Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} disabled={isGuest}>
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={[styles.menuText, isGuest && styles.disabled]}>
            Statistics
          </Text>
          {isGuest && <Text style={styles.guestLabel}>Requires Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => { navigation.navigate('SettingsScreen'); }}
        >
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Community</Text>
        
        <TouchableOpacity style={styles.menuItem} disabled={isGuest}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={[styles.menuText, isGuest && styles.disabled]}>
            Leaderboard
          </Text>
          {isGuest && <Text style={styles.guestLabel}>Requires Sign In</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={() => void handleSignOut()}>
        <Text style={styles.signOutText}>
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 2.0.0 - Account System Update</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 48,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3333FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 48,
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#888',
  },
  guestBadge: {
    marginTop: 8,
    fontSize: 12,
    color: '#FFB74D',
    backgroundColor: '#332200',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upgradeCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#252542',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3333FF',
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  upgradeText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252542',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  disabled: {
    color: '#666',
  },
  guestLabel: {
    fontSize: 11,
    color: '#FFB74D',
  },
  signOutButton: {
    margin: 16,
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FF3333',
    borderRadius: 12,
  },
  signOutText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    padding: 16,
  },
});
