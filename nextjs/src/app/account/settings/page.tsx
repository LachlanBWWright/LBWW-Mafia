'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { api } from '~/utils/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const { data: preferences, isLoading } = api.user.getPreferences.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (preferences) {
      setSoundEnabled(preferences.soundEnabled);
      setNotificationsEnabled(preferences.notificationsEnabled);
      setTheme(preferences.theme as 'light' | 'dark' | 'system');
    }
  }, [preferences]);

  const updateMutation = api.user.updatePreferences.useMutation({
    onSuccess: () => {
      alert('Settings saved successfully!');
    },
    onError: (error) => {
      alert(`Failed to save settings: ${error.message}`);
    },
  });

  const deleteMutation = api.auth.deleteAccount.useMutation({
    onSuccess: async () => {
      alert('Account deleted successfully');
      await signOut({ callbackUrl: '/' });
    },
    onError: (error) => {
      alert(`Failed to delete account: ${error.message}`);
    },
  });

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/account/settings');
    return null;
  }

  const handleSave = () => {
    updateMutation.mutate({
      soundEnabled,
      notificationsEnabled,
      theme,
    });
  };

  const handleDelete = () => {
    if (confirm('Are you absolutely sure? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-6">
          <Link href="/account" className="text-blue-400 hover:text-blue-300">
            ← Back to Account
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">Settings</h1>

        {/* Preferences */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-6">Preferences</h2>

          {/* Sound */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-700">
            <div>
              <h3 className="font-medium mb-1">Sound Effects</h3>
              <p className="text-sm text-gray-400">
                Enable sound effects during gameplay
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 
                              peer-focus:ring-blue-500 rounded-full peer 
                              peer-checked:after:translate-x-full peer-checked:after:border-white 
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                              after:bg-white after:border-gray-300 after:border after:rounded-full 
                              after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
              </div>
            </label>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-700">
            <div>
              <h3 className="font-medium mb-1">Notifications</h3>
              <p className="text-sm text-gray-400">
                Receive notifications about game updates
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 
                              peer-focus:ring-blue-500 rounded-full peer 
                              peer-checked:after:translate-x-full peer-checked:after:border-white 
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                              after:bg-white after:border-gray-300 after:border after:rounded-full 
                              after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
              </div>
            </label>
          </div>

          {/* Theme */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Theme</h3>
            <div className="grid grid-cols-3 gap-4">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`py-3 px-4 rounded-lg font-medium capitalize transition-colors ${
                    theme === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium
                       py-3 rounded-lg transition-colors duration-200
                       disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-900 bg-opacity-20 border-2 border-red-900 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-red-400">Danger Zone</h2>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">Delete Account</h3>
            <p className="text-sm text-gray-400 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-medium
                           py-2 px-6 rounded-lg transition-colors duration-200"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-red-400 font-medium">
                  Are you absolutely sure? This will permanently delete:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                  <li>Your account and profile</li>
                  <li>All match history</li>
                  <li>Statistics and achievements</li>
                  <li>Preferences and settings</li>
                </ul>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium
                               py-2 px-6 rounded-lg transition-colors duration-200
                               disabled:bg-gray-700 disabled:cursor-not-allowed"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete Forever'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-medium
                               py-2 px-6 rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
