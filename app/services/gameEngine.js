import EventEmitter from 'events';
import _ from 'lodash';
import {
  EVENT_USER_JOINED,
  EVENT_USER_LEFT,
  EVENT_USER_STARTED_GAME,
  EVENT_USER_SHOT,
} from './gameHostService';

export const ROOMS_CHANGED = 'rooms-changed';

const TICK_INTERVAL_MS = 2000;
const NEW_ZOMBIES_PER_TICK = 0.5;
const ZOMBIE_MOVE_PER_TICK = 1;
const MAX_ZOMBIES_PER_MAP = 50;

const MAP_WIDTH = 32;
const MAP_HEIGHT = 10;

const ZOMBIE_HEALTH = 100;
const SHOT_DAMAGE = 50;

let lastZombieId = 0;

const rooms = {};

const getMap = (roomId) => rooms[roomId];

const getClientRoom = (clientId) => _.find(Object.values(rooms), (room) => !!room.clients[clientId]);

const random = (fromInclusive, toExclusive) => Math.floor(Math.random() * (toExclusive - fromInclusive)) + fromInclusive;
const withinMapHeight = (y) => Math.min(Math.max(y, 0), MAP_HEIGHT - 1);
const withinMapWidth = (x) => Math.max(x, -1);

const newZombie = () => ({
  id: lastZombieId++,
  x: MAP_WIDTH - 1,
  y: random(0, MAP_HEIGHT),
  vx: -ZOMBIE_MOVE_PER_TICK,
  vy: 0,
  health: ZOMBIE_HEALTH,
});

const moveZombie = (zombie) => {
  const r = random(-2, 3);
  zombie.x = withinMapWidth(zombie.x + zombie.vx);
  zombie.y = withinMapHeight(zombie.y + zombie.vy);
  if (r === 2 && zombie.y < MAP_HEIGHT - 1) {
    zombie.vy = ZOMBIE_MOVE_PER_TICK;
  } else if (r === -2 && zombie.y > 0) {
    zombie.vy = -ZOMBIE_MOVE_PER_TICK;
  } else {
    zombie.vy = 0;
  }
  return zombie;
};

class GameEngine extends EventEmitter {

  constructor(gameHostService) {
    super();
    this.gameHostService = gameHostService;
    gameHostService.on(EVENT_USER_JOINED, this._userJoined);
    gameHostService.on(EVENT_USER_LEFT, this._userLeft);
    gameHostService.on(EVENT_USER_STARTED_GAME, this._userStartedGame);
    gameHostService.on(EVENT_USER_SHOT, this._userShot);
    setInterval(this._tick, TICK_INTERVAL_MS);
  }

  start = () => {
    this.gameHostService.start();
  };

  _tick = () => {
    Object.values(rooms).forEach(room => {
      if (room && room.isStarted) {
        this._tickForRoom(room);
        this._reportMapForRoom(room);
      }
    });
  };

  _tickForRoom = (room) => {
    room.zombies.forEach(moveZombie);
    const newZombiesCount = Math.floor(NEW_ZOMBIES_PER_TICK) + (Math.random() > NEW_ZOMBIES_PER_TICK % 1) ? 1 : 0;
    _.times(newZombiesCount, () => {
      if (room.zombies.length < MAX_ZOMBIES_PER_MAP) {
        room.zombies.push(newZombie());
      }
    });
    if (_.find(room.zombies, zombie => zombie.x < 0)) {
      Object.keys(room.clients).forEach(clientId => this.gameHostService.reportGameOver(clientId));
      this._destroyRoom(room.roomId);
    }
  };

  _reportMapForRoom = (room) => {
    Object.keys(room.clients).forEach(clientId => this._reportMapToClient({ clientId, roomId: room.roomId }));
  };

  _userJoined = ({ clientId, username, roomId }) => {
    const client = { clientId, username };
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        isStarted: false,
        startedAt: undefined,
        zombies: [],
        clients: { [clientId]: client },
      };
    } else {
      rooms[roomId].clients[clientId] = client;
    }
    this._reportMapToClient({ clientId, roomId });
    this.emit(ROOMS_CHANGED, rooms);
  };

  _userLeft = ({ clientId }) => {
    const room = getClientRoom(clientId);
    if (room.clients[clientId]) delete room.clients[clientId];
    if (!Object.values(room.clients).length) {
      this._destroyRoom(room.roomId);
    }
    this.emit(ROOMS_CHANGED, rooms);
  };

  _reportMapToClient = ({ clientId, roomId }) => {
    this.gameHostService.reportMap(getMap(roomId), clientId);
  };

  _userStartedGame = ({ clientId }) => {
    const room = getClientRoom(clientId);
    if (room.isStarted) {
      return;
    }
    room.isStarted = true;
    room.startedAt = new Date();
    this.emit(ROOMS_CHANGED, rooms);
  };

  _userShot = ({ clientId, point: { x, y } }) => {
    const room = getClientRoom(clientId);
    const zombieHitIndex = _.findIndex(room.zombies, { x, y });
    if (zombieHitIndex >= 0) {
      const zombieHit = room.zombies[zombieHitIndex];
      zombieHit.health -= SHOT_DAMAGE;
      const isKilled = zombieHit.health <= 0;
      if (isKilled) {
        room.zombies.splice(zombieHitIndex, 1);
      }
      this.gameHostService.reportZombieHit(clientId, zombieHit.id, isKilled);
    }
  };

  _destroyRoom = (roomId) => {
    if (rooms[roomId]) delete rooms[roomId];
    this.emit(ROOMS_CHANGED, rooms);
  }
}

export const getEngine = gameHostService => new GameEngine(gameHostService);
