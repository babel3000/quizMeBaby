import { io } from 'socket.io-client'

let socket = null

export function useSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
    socket = io(url, {
      autoConnect: true,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
