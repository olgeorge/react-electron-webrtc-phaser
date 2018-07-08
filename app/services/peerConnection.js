import EventEmitter from 'events';
import Peer from 'simple-peer';
import { EVENT_SIGNAL } from './signallingService'
import uuidv4 from 'uuid/v4';

export const EVENT_CONNECT = 'connect';
export const EVENT_MESSAGE = 'message';
export const EVENT_ERROR = 'error';
export const EVENT_CLOSE = 'close';

const RECONNECT_INTERVAL_MS = 15000;

class PeerConnection extends EventEmitter {

  constructor(signallingService, remoteId, isInitiator) {
    super();
    this.id = uuidv4();
    this.signallingService = signallingService;
    this.remoteId = remoteId;
    this.isInitiator = isInitiator;
    this.peer = this._buildPeer(remoteId, isInitiator);
    console.log(`Created new peer connection ${this.id}`);
    this.signallingService.on('signal', this._onSignallingOffer);
  }

  sendMessage = (message) => {
    this.peer.send(JSON.stringify(message));
  };

  close = () => {
    console.log(`Destroying peer connection ${this.id}`);
    if (this.peer) {
      this.peer.destroy();
    }
  };

  _reconnect = (remoteId, isInitiator) => {
    this.close();
    this.peer = this._buildPeer(remoteId, isInitiator);
    this.signallingService.on('signal', this._onSignallingOffer);
    console.log(`Attempting reconnect. Created new peer ${this.id}`);
  };

  _addReconnectInterval = (remoteId, isInitiator) => {
    // Only reconnect for an initiator. Acceptor will receive a new peer when initiator reconnects;
    if (this.isInitiator && !this.reconnectInterval) {
      console.log(`Starting reconnect sequence for peer ${this.id}`);
      this.reconnectInterval = setInterval(() => this._reconnect(remoteId, isInitiator), RECONNECT_INTERVAL_MS);
    }
  };

  _removeReconnectInterval = () => {
    if (this.reconnectInterval) {
      console.log(`Stopping reconnect sequence for peer ${this.id}`);
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
  };

  _buildPeer = (remoteId, isInitiator) => {
    const peer = new Peer({ initiator: isInitiator, trickle: false });
    peer._debug = console.log;

    peer.on('error', (err) => {
      console.error(`WebRTC error for peer ${this.id}`, err);
      this._addReconnectInterval(remoteId, isInitiator);
      this.emit(EVENT_ERROR, err);
    });

    peer.on('close', () => {
      console.log(`WebRTC closed for peer ${this.id}`);
      this.signallingService.removeListener('signal', this._onSignallingOffer);
      this.emit(EVENT_CLOSE);
    });

    peer.on('signal', (data) => {
      console.log(`WebRTC signalled for peer ${this.id}`);
      this.signallingService.signalOffer(data, remoteId);
    });

    peer.on('connect', () => {
      console.log(`WebRTC connected for peer ${this.id}`);
      this._removeReconnectInterval();
      this.emit(EVENT_CONNECT);
    });

    peer.on('data', (data) => {
      this.emit(EVENT_MESSAGE, JSON.parse(data.toString()));
    });

    return peer;
  };

  _onSignallingOffer = (offer, remoteId) => {
    if (this.remoteId === remoteId) {
      console.log(`Received signalling offer for peer ${this.id}`);
      this.peer.signal(offer);
    }
  };

  signalOffer = (offer) => {
    console.log(`Signalling peer with offer for peer ${this.id}`);
    this.peer.signal(offer);
  };

}

class PeerConnectionObserver extends EventEmitter {

  constructor(signallingService, clientConnectedCallback) {
    super();
    this.signallingService = signallingService;
    this.signallingService.on(EVENT_SIGNAL, this._onSignallingOffer);
    this.clientConnectedCallback = clientConnectedCallback;
  }

  _onSignallingOffer = (offer, clientId) => {
    const peer = new PeerConnection(this.signallingService, clientId, false);
    peer.signalOffer(offer);
    this.clientConnectedCallback(peer, clientId);
  };
}

export const connectToServer = (signallingService, serverId) => new PeerConnection(signallingService, serverId, true);
export const onClientConnected = (signallingService, clientConnectedCallback) =>
  new PeerConnectionObserver(signallingService, clientConnectedCallback);
