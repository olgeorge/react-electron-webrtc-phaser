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
  TYPE_USER_SHOT,
  TYPE_JOIN_ROOM,
  TYPE_LEAVE_ROOM,
  TYPE_START_GAME,
  TYPE_SHOOT,
} from './gameHostService';

export const EVENT_JOINED = 'joined';
export const EVENT_OTHER_USER_JOINED = 'other-user-joined';
export const EVENT_OTHER_USER_LEFT = 'other-user-left';
export const EVENT_MAP_CHANGED = 'map-changed';
export const EVENT_USER_SHOT = 'user-shot';
export const EVENT_GAME_OVER = 'game-over';
export const EVENT_CONNECTION_SUCCESS = 'connection-success';
export const EVENT_CONNECTION_ERROR = 'connection-error';

class GameClientService extends EventEmitter {

  constructor(clientUsername) {
    super();
    this.clientUsername = clientUsername;
    this.clientId = uuidv4();
    this.roomId = undefined;
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

  joinRoom = (serverId, roomId) => {
    if (this.serverConnection) {
      throw new Error("Already in a room. Please call client.leaveRoom() before joining again");
    }

    this.roomId = roomId;

    console.log('Establishing RTC connection to server');
    this.serverConnection = connectToServer(this.signallingService, serverId);
    this.serverConnection.on('error', (err) => {
      console.warn('Client RTC connection failed', err);
      this.emit(EVENT_CONNECTION_ERROR);
    });
    this.serverConnection.on('connect', () => {
      console.log('Successfully connected to server');
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

  joinNewRoom = (serverId) => this.joinRoom(serverId, uuidv4());

  leaveRoom = () => {
    if (this.serverConnection) {
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

  shoot = ({ damage, x, y }) => {
    if (!this.serverConnection) {
      throw new Error("Client is not connected. Please call client.joinRoom(serverId, roomId) first");
    }

    this.serverConnection.sendMessage({
      type: TYPE_SHOOT,
      point: { x, y },
      damage,
      clientId: this.clientId,
      roomId: this.roomId,
      username: this.clientUsername,
    })
  };

  _onGameMessageReceived = (message) => {
    switch (message.type) {
      case TYPE_USER_JOINED: {
        const { joinedClientId, joinedUsername } = message;
        this.emit(EVENT_OTHER_USER_JOINED, { clientId: joinedClientId, username: joinedUsername });
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
      case TYPE_USER_SHOT: {
        const { shooterClientId, point, zombieId, isKilled } = message;
        this.emit(EVENT_USER_SHOT, { shooterClientId, point, zombieId, isKilled });
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
  service.clientUsername = clientUsername;
  return service;
};
