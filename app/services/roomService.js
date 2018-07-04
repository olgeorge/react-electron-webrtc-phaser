import EventEmitter from 'events';
import _ from 'lodash';

export const EVENT_SERVER_DISCOVERED = 'server-discovered';
export const EVENT_ALL_SERVER_DISCOVERED = 'all-server-discovered';

const SERVER_DISCOVERY_TIMEOUT_MS = 1000;

const TYPE_DISCOVERY_REQUEST = 'discovery-request';
const TYPE_DISCOVERY_RESPONSE = 'discovery-response';

class ServerRoomService extends EventEmitter {

  constructor(webSocketConnection) {
    super();
    this.webSocketConnection = webSocketConnection;
    this.webSocketConnection.on('message', this._onMessageReceived);
  }

  onDiscoveryRequest = discoveryRequestCallback => {
    this.discoveryRequestCallback = discoveryRequestCallback;
  };

  _onMessageReceived = (message) => {
    if (message.type === TYPE_DISCOVERY_REQUEST && this.discoveryRequestCallback) {
      const { serverId, hostUsername, rooms } = this.discoveryRequestCallback();
      this.webSocketConnection.sendMessage({
        type: TYPE_DISCOVERY_RESPONSE,
        serverId,
        hostUsername,
        rooms,
      });
    }
  };
}


class ClientRoomService extends EventEmitter {

  constructor(webSocketConnection) {
    super();
    this.webSocketConnection = webSocketConnection;
    this.webSocketConnection.on('message', this._onMessageReceived);
    this.gameServers = {};
  }

  discoverRooms = () => {
    return new Promise((resolve, reject) => {
      this.gameServers = {};
      this.webSocketConnection.sendMessage({
        type: TYPE_DISCOVERY_REQUEST,
      });
      setTimeout(() => {
        this.emit(EVENT_ALL_SERVER_DISCOVERED, this.gameServers);
        resolve(this.gameServers);
      }, SERVER_DISCOVERY_TIMEOUT_MS);
    });
  };

  _onMessageReceived = (message) => {
    if (message.type === TYPE_DISCOVERY_RESPONSE) {
      const { serverId, hostUsername, rooms } = message;
      this.gameServers[serverId] = { serverId, hostUsername, rooms };
      this.emit(EVENT_SERVER_DISCOVERED, { serverId, hostUsername, rooms });
    }
  };
}

export const getServerService = (webSocketConnection) => new ServerRoomService(webSocketConnection);
export const getClientService = (webSocketConnection) => new ClientRoomService(webSocketConnection);
