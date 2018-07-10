import EventEmitter from 'events';
import uuidv4 from 'uuid/v4';
import { onClientConnected } from './peerConnection';
import { getServerService as getServerSignallingService } from './signallingService';
import { getServerService as getServerRoomService } from './roomService';
import { getServerConnection } from './webSocketConnection';

// Server messages
export const TYPE_USER_JOINED = 'user-joined';
export const TYPE_USER_LEFT = 'user-left';
export const TYPE_REPORT_MAP = 'report-map';
export const TYPE_GAME_OVER = 'game-over';
export const TYPE_USER_SHOT = 'user-shot';

// Client messages
export const TYPE_LEAVE_ROOM = 'leave-room';
export const TYPE_JOIN_ROOM = 'join-room';
export const TYPE_START_GAME = 'start-game';
export const TYPE_SHOOT = 'shoot';

// Events
export const EVENT_USER_JOINED = 'join-room';
export const EVENT_USER_LEFT = 'user-left';
export const EVENT_USER_STARTED_GAME = 'join-room';
export const EVENT_USER_SHOT = 'shoot';

const connections = {};

const getRooms = () => {
  const rooms = _.groupBy(_.map(Object.values(connections).filter(connection => !!connection),
    ({ clientId, roomId }) => ({ clientId, roomId })), 'roomId');
  const roomIdWithNumPlayers = _.mapValues(rooms, value => value.length);
  return Object.keys(roomIdWithNumPlayers).map(roomId => ({ roomId, numPlayers: roomIdWithNumPlayers[roomId] }));
};

const getClientConnection = (clientId) => connections[clientId] && connections[clientId].connection;

const getAllRoomClients = (clientId) => {
  const { roomId } = connections[clientId] || {};
  if (!roomId) return [];
  return Object.values(connections).filter((connection) => connection.roomId === roomId);
};

const getOtherRoomClients = (clientId) => {
  return getAllRoomClients(clientId).filter((connection) => connection.clientId !== clientId);
};

class GameHostService extends EventEmitter {

  constructor(hostUsername) {
    super();
    this.hostUsername = hostUsername;
    this.serverId = uuidv4();
    this.wsConnection = getServerConnection(this.serverId);
    this.signallingService = getServerSignallingService(this.wsConnection, this.serverId);
    this.roomService = getServerRoomService(this.wsConnection);
    this.roomService.onDiscoveryRequest(this._discoverServer);
    onClientConnected(this.signallingService, this._onClientConnected);
    this.isConnected = false;
  }

  start = () => {
    return this.wsConnection.connect()
      .then(() => {
        this.isConnected = true;
      });
  };

  reportMap = (map, clientId) => {
    const connection = getClientConnection(clientId);
    if (!connection) return;
    connection.sendMessage({
      type: TYPE_REPORT_MAP,
      map,
    });
  };

  reportGameOver = (clientId) => {
    const connection = getClientConnection(clientId);
    if (!connection) return;
    connection.sendMessage({
      type: TYPE_GAME_OVER,
      reason: 'Zombies have managed to reach the wall!',
    });
    if (connections[clientId]) delete connections[clientId];
  };

  reportUserShot = (clientId, point, zombieId, isKilled) => {
    getAllRoomClients(clientId).forEach(({ connection }) => {
      connection.sendMessage({
        type: TYPE_USER_SHOT,
        shooterClientId: clientId,
        point,
        zombieId,
        isKilled,
      });
    });
  };

  _reportUserJoined = (joinedClientId, joinedUsername) => {
    getOtherRoomClients(joinedClientId).forEach(({ connection }) => {
      connection.sendMessage({
        type: TYPE_USER_JOINED,
        joinedClientId,
        joinedUsername,
      });
    });
  };

  _reportUserLeft = (leftClientId) => {
    getOtherRoomClients(leftClientId).forEach(({ connection }) => {
      connection.sendMessage({
        type: TYPE_USER_LEFT,
        leftClientId,
      });
    });
  };

  _discoverServer = () => {
    return {
      serverId: this.serverId,
      hostUsername: this.hostUsername,
      rooms: getRooms(),
    };
  };

  _onClientConnected = (connection, clientId) => {
    console.log(`Server received new client connection ${clientId}`);
    connection.on('error', (err) => {
      console.warn('Server RTC connection failed', err);
      this._onClientDisconnected(clientId);
    });
    connection.on('connect', () => {
      console.log(`Client connection ${clientId} established`);
    });
    connection.on('message', (message) => {
      this._onGameMessageReceived(message, connection);
    });
    connection.on('close', () => {
      console.log(`Client ${clientId} disconnected from server`);
      this._onClientDisconnected(clientId);
    });
    connection.clientId = clientId;
  };

  _onClientDisconnected = (clientId) => {
    const connection = connections[clientId];
    if (connection) {
      //connection.removeAllListeners('error');
      //connection.removeAllListeners('connect');
      //connection.removeAllListeners('message');
      //connection.removeAllListeners('close');
      delete connections[clientId];
      this.emit(EVENT_USER_LEFT, { clientId });
      this._reportUserLeft(clientId);
    }
  };

  _onClientJoinedRoom = ({ roomId, clientId, username, connection }) => {
    connections[clientId] = { clientId, roomId, connection };
    this.emit(EVENT_USER_JOINED, { clientId, username, roomId });
    this._reportUserJoined(clientId, username);
  };

  _onGameMessageReceived = (message, connection) => {
    console.log(`Server ${this.serverId} received message`, message);
    const { type, clientId } = message;
    switch (type) {
      case TYPE_JOIN_ROOM: {
        if (connections[clientId]) {
          console.warn(`Client ${clientId} must leave room before joining one`);
          break;
        }
        const { roomId = uuidv4(), username } = message;
        this._onClientJoinedRoom({ roomId, clientId, username, connection });
        break;
      }
      case TYPE_LEAVE_ROOM: {
        //connection.removeAllListeners('error');
        //connection.removeAllListeners('connect');
        //connection.removeAllListeners('message');
        //connection.removeAllListeners('close');
        this._onClientDisconnected(clientId);
        break;
      }
      case TYPE_START_GAME: {
        this.emit(EVENT_USER_STARTED_GAME, { clientId });
        break;
      }
      case TYPE_SHOOT: {
        if (!connections[clientId]) {
          const { roomId, username } = message;
          // Server decided that client has disconnected, but the client didn't notice
          this._onClientConnected(connection, clientId);
          this._onClientJoinedRoom({ roomId, clientId, username, connection });
        }
        const { damage } = message;
        const { x, y } = message.point;
        this.emit(EVENT_USER_SHOT, { clientId, damage, point: { x, y } });
        break;
      }
      default:
        console.warn('Unrecognized message type ' + message.type);
    }
  };

}

let service = null;

export const getService = hostUsername => {
  service = service || new GameHostService(hostUsername);
  return service;
};
