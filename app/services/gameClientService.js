import EventEmitter from 'events';
import uuidv4 from 'uuid/v4';
import { connectToServer } from './peerConnection';
import { getClientConnection } from './webSocketConnection';
import { getClientService as getClientSignallingService } from './signallingService';
import { getClientService as getClientRoomService } from './roomService';
import {
  TYPE_USER_JOINED ,
  TYPE_USER_LEFT ,
  TYPE_REPORT_MAP,
  TYPE_GAME_OVER,
  TYPE_ZOMBIE_HIT,
  TYPE_JOIN_ROOM,
  TYPE_LEAVE_ROOM,
  TYPE_START_GAME,
  TYPE_SHOOT,
} from './gameHostService';

export const EVENT_JOINED = 'joined';
export const EVENT_OTHER_USER_JOINED = 'other-user-joined';
export const EVENT_OTHER_USER_LEFT = 'other-user-left';
export const EVENT_MAP_CHANGED = 'map-changed';
export const EVENT_ZOMBIE_HIT = 'zombie-hit';
export const EVENT_GAME_OVER = 'game-over';
export const EVENT_CONNECTION_SUCCESS = 'connection-success';
export const EVENT_CONNECTION_ERROR = 'connection-error';

const RECONNECT_INTERVAL_MS = 3000;

class GameClientService extends EventEmitter {

  constructor(clientUsername) {
    super();
    this.clientUsername = clientUsername;
    this.clientId = uuidv4();
    this.wsConnection = getClientConnection(this.clientId);
    this.signallingService = getClientSignallingService(this.wsConnection, this.clientId);
    this.roomService = getClientRoomService(this.wsConnection);
    this.isConnected = false;
  }

  start = () => {
    return this.wsConnection.connect()
      .then(() => {
        this.isConnected = true;
      });
  };

  stop = () => {
    this.leaveRoom();
  };

  discoverServers = () => {
    if (!this.isConnected) {
      throw new Error("Please wait for the client.start() promise to resolve before discovering servers");
    }
    return this.roomService.discoverRooms();
  };

  //_rejoinRoom = (serverId, roomId) => {
  //  this.leaveRoom();
  //  console.log('Reestablishing RTC connection');
  //  this.joinRoom(serverId, roomId);
  //};

  joinRoom = (serverId, roomId) => {
    if (this.serverConnection) {
      throw new Error("Already in a room. Please call client.leaveRoom() before joining again");
    }

    console.log('Client connecting');
    this.serverConnection = connectToServer(this.signallingService, serverId);
    this.serverConnection.on('error', (err) => {
      console.warn('Client RTC connection failed', err);
      this.emit(EVENT_CONNECTION_ERROR);
      //this.reconnectInterval = setInterval(this._rejoinRoom, RECONNECT_INTERVAL_MS);
    });
    this.serverConnection.on('connect', () => {
      console.log('Successfully connected to server');
      //if (this.reconnectInterval) clearInterval(this.reconnectInterval);
      this.serverConnection.sendMessage({
        type: TYPE_JOIN_ROOM,
        clientId: this.clientId,
        roomId,
        username: this.clientUsername,
      });
      this.emit(EVENT_CONNECTION_SUCCESS);
    });
    this.serverConnection.on('message', (message) => {
      this._onGameMessageReceived(message);
    });
    this.emit(EVENT_JOINED);
  };

  joinNewRoom = (serverId) => this.joinRoom(serverId, undefined);

  leaveRoom = () => {
    if (this.serverConnection) {
      //this.serverConnection.sendMessage({
      //  type: TYPE_LEAVE_ROOM,
      //  clientId: this.clientId,
      //});
      //
      //this.serverConnection.removeAllListeners('error');
      //this.serverConnection.removeAllListeners('connect');
      //this.serverConnection.removeAllListeners('message');
      //this.serverConnection.removeAllListeners('close');
      this.serverConnection.close();
      this.serverConnection = undefined;
    }
  };

  startGame = () => {
    if (!this.serverConnection) {
      throw new Error("Client is not connected. Please call client.joinRoom(serverId, roomId) first");
    }

    this.serverConnection.sendMessage({
      type: TYPE_START_GAME,
      clientId: this.clientId,
    })
  };

  shoot = ({ x, y }) => {
    if (!this.serverConnection) {
      throw new Error("Client is not connected. Please call client.joinRoom(serverId, roomId) first");
    }

    this.serverConnection.sendMessage({
      type: TYPE_SHOOT,
      point: { x, y },
      clientId: this.clientId,
    })
  };

  _onGameMessageReceived = (message) => {
    switch (message.type) {
      case TYPE_USER_JOINED: {
        const { joinedClientId } = message;
        this.emit(EVENT_OTHER_USER_JOINED, { clientId: joinedClientId });
        break;
      }
      case TYPE_USER_LEFT: {
        const { leftClientId } = message;
        this.emit(EVENT_OTHER_USER_LEFT, { clientId: leftClientId });
        break;
      }
      case TYPE_REPORT_MAP: {
        const { map } = message;
        this.emit(EVENT_MAP_CHANGED, { map });
        break;
      }
      case TYPE_GAME_OVER: {
        this.emit(EVENT_GAME_OVER);
        break;
      }
      case TYPE_ZOMBIE_HIT: {
        const { shooterClientId, zombieId, isKilled } = message;
        this.emit(EVENT_ZOMBIE_HIT, { clientId: shooterClientId, zombieId, isKilled });
        break;
      }
      default:
        console.warn('Unrecognized message type ' + message.type);
    }
  };
}

let service = null;

export const getService = clientUsername => {
  service = service || new GameClientService(clientUsername);
  return service;
};
