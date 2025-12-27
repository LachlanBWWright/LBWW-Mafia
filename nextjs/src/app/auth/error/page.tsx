'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-6 p-8 bg-gray-800 rounded-lg shadow-xl">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-3xl font-bold text-white mb-2">Authentication Error</h2>
          <p className="text-gray-400">
            {error === 'Configuration' && 'There is a problem with the server configuration'}
            {error === 'AccessDenied' && 'Access denied. You do not have permission to sign in'}
            {error === 'Verification' && 'The verification token has expired or has already been used'}
            {error === 'Default' && 'An unexpected error occurred'}
            {!error && 'An unexpected error occurred'}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 
                       text-white font-medium rounded-lg px-6 py-3
                       transition-colors duration-200"
          >
            Try Again
          </Link>
          
          <Link
            href="/"
            className="block w-full text-center bg-gray-700 hover:bg-gray-600 
                       text-white font-medium rounded-lg px-6 py-3
                       transition-colors duration-200"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-white">Loading...</div></div>}>
      <ErrorContent />
    </Suspense>
  );
}
