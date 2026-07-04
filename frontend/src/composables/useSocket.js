import { io } from 'socket.io-client'

let socket = null

export function useSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`
    socket = io(url, {
      autoConnect: true,
      reconnectionAttempts: 5,
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
