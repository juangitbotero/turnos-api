/**
 * Socket.IO client singleton for the Turnos web-admin dashboard.
 *
 * Usage (client components only):
 *   import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
 *
 *   // After employer login:
 *   const token = localStorage.getItem('accessToken');
 *   if (token) connectSocket(token);
 *
 *   // In a component:
 *   useEffect(() => {
 *     const socket = getSocket();
 *     socket?.on('shift:new_application', handler);
 *     return () => { socket?.off('shift:new_application', handler); };
 *   }, []);
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api')
  .replace('/api', ''); // WebSocket connects to the root, not /api

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
    console.log('[Socket] Employer dashboard connected:', socket?.id);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err: Error) => {
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

export interface NewApplicationPayload {
  shiftId: string;
  shiftTitle: string;
  applicationId: string;
  workerName: string | null;
  workerScore: number;
}
