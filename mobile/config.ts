// Configuration for mobile app
// Update these values based on your deployment

export const config = {
  // API URL - Update this to your Next.js server URL
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  
  // Socket.IO URL - Update this to your Socket.IO server URL
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:8000',
};
