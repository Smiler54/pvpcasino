import { io, Socket } from 'socket.io-client';
import { SOCKET_IO_URL } from './config';

// Singleton Socket.IO client for the app
let socket: Socket | null = null;

export const connectGameServer = () => {
  if (socket && socket.connected) return;
  try {
    socket = io(SOCKET_IO_URL, {
      autoConnect: true,
      withCredentials: false,
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });
  } catch (err) {
    console.error('Failed to connect Socket.IO:', err);
  }
};

export const getSocket = () => socket;

export const disconnectGameServer = () => {
  try {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  } catch (err) {
    console.error('Failed to disconnect Socket.IO:', err);
  }
};

export const getConnectionStatus = () => {
  return !!(socket && socket.connected);
};
