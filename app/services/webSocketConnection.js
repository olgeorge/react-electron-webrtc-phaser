import EventEmitter from 'events';
import ReconnectingWebSocket from 'reconnecting-websocket';

const WEB_SOCKET_ENDPOINT = 'wss://node2.wsninja.io';
const CLIENT_GUID = '51c1a7fa-c862-4b74-a886-86d782c4dd82';
const SERVER_GUID = '71c497e0-50f5-4c7c-a8c9-9f26061413eb';

export const EVENT_CONNECT = 'connect';
export const EVENT_MESSAGE = 'message';

const RECONNECT_INTERVAL_MS = 10000;

class WebSocketConnection extends EventEmitter {

  constructor(localId, isServer, ...args) {
    super(...args);
    this.localId = localId;
    this.isServer = isServer;
    this.isReady = false;
    this.messagesToResend = [];
  }

  connect = () => {
    if (this.socket && this.isReady) {
      return Promise.resolve();
    }

    if (!this.socket) {
      this.connectPromise = this._connectWebSocket();
    }
    return this.connectPromise;
  };

  sendMessage = (message, remoteId) => {
    const localIdName = this.isServer ? 'serverId' : 'clientId';
    const remoteIdName = !this.isServer ? 'serverId' : 'clientId';
    const rawMessage = JSON.stringify({
      [localIdName]: this.localId,
      [remoteIdName]: remoteId,
      ...message,
    });
    if (this.isReady) {
      this.socket.send(rawMessage);
    } else {
      // We will only resend the last message
      // Reconnections, heartbeats, queues are implemented by socket.io but you need a socket.io server
      this.messagesToResend = [rawMessage];
    }
  };

  _onMessageReceived = (message) => {
    const localIdName = this.isServer ? 'serverId' : 'clientId';
    // Filter out messages for other nodes, unless it's a broadcast
    // Normally routing is done on websocket server, but at least its free
    if (message[localIdName] === this.localId || !message[localIdName]) {
      this.emit(EVENT_MESSAGE, message);
    }
  };

  _connectWebSocket = () => {
    this.socket = new ReconnectingWebSocket(WEB_SOCKET_ENDPOINT);
    this.socket.addEventListener('open', (event) => {
      console.log('WebSocket opened');
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = undefined;
      }
      // Connection opened, send client GUID to autenticate with wsninja server.
      const guid = this.isServer ? SERVER_GUID : CLIENT_GUID;
      this.socket.send(JSON.stringify({ guid }));
    });

    this.socket.addEventListener('close', (event) => {
      this.isReady = false;
      this.reconnectInterval = this.reconnectInterval || setInterval(() => {
        console.log('WebSocket reconnecting');
        this.socket.reconnect();
      }, RECONNECT_INTERVAL_MS);
      console.log('WebSocket closed');
    });
    this.socket.addEventListener('error', (event) => {
      console.log('WebSocket error', event);
    });

    return new Promise((resolve, reject) => {
      this.socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.accepted === true) {
          this.isReady = true;
          this.messagesToResend.forEach(message => this.socket.send(message));
          this.messagesToResend = [];
          this.emit(EVENT_CONNECT);
          resolve();
        } else {
          this._onMessageReceived(message);
        }
      });
    });
  };
}

export const getClientConnection = clientId => new WebSocketConnection(clientId, false);
export const getServerConnection = serverId => new WebSocketConnection(serverId, true);
