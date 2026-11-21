export function createWebSocket(endpoint, onMessage, onError, onClose) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const url = `${protocol}//${host}${endpoint}`

  let socket = new WebSocket(url)

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (onMessage) onMessage(data)
    } catch (e) {
      if (onMessage) onMessage(event.data)
    }
  }

  socket.onerror = (err) => {
    if (onError) onError(err)
  }

  socket.onclose = () => {
    if (onClose) onClose()
  }

  return socket
}
