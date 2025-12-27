'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '~/utils/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: profile } = api.user.getProfile.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const updateMutation = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      alert('Profile updated successfully!');
    },
    onError: (error) => {
      setIsSaving(false);
      alert(`Failed to update profile: ${error.message}`);
    },
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin?callbackUrl=/account/profile');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    updateMutation.mutate({
      ...(name && { name }),
      ...(displayName && { displayName }),
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-6">
          <Link href="/account" className="text-blue-400 hover:text-blue-300">
            ← Back to Account
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8">Edit Profile</h1>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSubmit}>
            {/* Profile Picture */}
            <div className="mb-6 text-center">
              <img
                src={profile?.image ?? '/default-avatar.png'}
                alt={profile?.name ?? 'User'}
                className="w-32 h-32 rounded-full border-4 border-gray-700 mx-auto mb-4"
              />
              <p className="text-gray-400 text-sm">
                Profile picture is provided by Google and cannot be changed here
              </p>
            </div>

            {/* Full Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={profile?.name ?? 'Enter your name'}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={50}
              />
              <p className="text-gray-500 text-xs mt-1">
                Current: {profile?.name ?? 'Not set'}
              </p>
            </div>

            {/* Display Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Display Name (shown in game)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={profile?.displayName ?? 'Enter display name'}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={30}
              />
              <p className="text-gray-500 text-xs mt-1">
                Current: {profile?.displayName ?? profile?.name ?? 'Not set'}
              </p>
            </div>

            {/* Email (read-only) */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={session?.user?.email ?? ''}
                disabled
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-500
                           cursor-not-allowed"
              />
              <p className="text-gray-500 text-xs mt-1">
                Email is managed by Google and cannot be changed
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSaving || (!name && !displayName)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium
                         py-3 rounded-lg transition-colors duration-200
                         disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Account Info */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Account Created:</span>
              <span className="text-white">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Games Played:</span>
              <span className="text-white">
                {profile?._count?.gameParticipations ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Authentication Provider:</span>
              <span className="text-white">Google</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
