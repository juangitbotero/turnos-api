/**
 * Socket.IO client singleton for the Turnos mobile app.
 *
 * Usage:
 *   import { connectSocket, disconnectSocket, getSocket } from './socket';
 *
 *   // On login (after you have a JWT):
 *   connectSocket(accessToken);
 *
 *   // In a component:
 *   const socket = getSocket();
 *   socket?.on('shift:status_changed', handler);
 *
 *   // On logout:
 *   disconnectSocket();
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace('/api', '') // strip /api suffix — WS connects to root
  : 'http://localhost:3001';

let socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

// ── Event types emitted by the server ────────────────────────────────────────

export interface ShiftStatusChangedPayload {
  shiftId: string;
  shiftTitle: string;
  applicationId: string;
  status: 'APPROVED' | 'REJECTED';
}

export interface ShiftCancelledPayload {
  shiftId: string;
  shiftTitle: string;
}
