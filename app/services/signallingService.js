import EventEmitter from 'events';

export const EVENT_SIGNAL = 'signal';

const TYPE_SIGNAL = 'signal-offer';

class SignallingService extends EventEmitter {

  constructor(webSocketConnection, localId, isServer, ...args) {
    super(...args);
    this.socketOpened = false;
    this.webSocketConnection = webSocketConnection;
    this.webSocketConnection.on('message', this._onMessageReceived);
    this.localId = localId;
    this.isServer = isServer;
  }

  signalOffer = (offer, remoteId) => {
    const localIdName = this.isServer ? 'serverId' : 'clientId';
    const message = {
      type: TYPE_SIGNAL,
      offer,
      [localIdName]: this.localId,
    };
    this.webSocketConnection.sendMessage(message, remoteId);
  };

  _onMessageReceived = (message) => {
    const remoteIdName = !this.isServer ? 'serverId' : 'clientId';
    if (message.type === TYPE_SIGNAL) {
      this.emit(EVENT_SIGNAL, message.offer, message[remoteIdName]);
    }
  };
}

export const getServerService = (webSocketConnection, serverId) =>
  new SignallingService(webSocketConnection, serverId, true);
export const getClientService = (webSocketConnection, clientId) =>
  new SignallingService(webSocketConnection, clientId, false);
