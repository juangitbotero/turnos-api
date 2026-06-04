'use client';

/**
 * Dashboard layout — connects the Socket.IO client once when the employer
 * enters any /dashboard/* page and disconnects on unmount.
 *
 * All child pages share the same persistent socket connection, so navigating
 * between Turnos / Trabalhadores / Conformidade does NOT tear down and
 * re-establish the WebSocket on every route change.
 */

import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '../../lib/socket';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      connectSocket(token);
    }

    return () => {
      disconnectSocket();
    };
  }, []);

  return <>{children}</>;
}
