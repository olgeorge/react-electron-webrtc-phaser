import EventEmitter from 'events';
import _ from 'lodash';
import {
  EVENT_USER_JOINED,
  EVENT_USER_LEFT,
  EVENT_USER_STARTED_GAME,
  EVENT_USER_SHOT,
} from './gameHostService';

export const ROOMS_CHANGED = 'rooms-changed';

const REJOIN_GRACE_PERIOD_MS = 30 * 1000;

const TICK_INTERVAL_MS = 2000;
const NEW_ZOMBIES_PER_TICK = 0.5;
const NEW_ZOMBIES_PER_TICK_INCREMENT = 0.1;
const WAVE_TICK_LENGTH = 10;
const ZOMBIE_MOVE_PER_TICK = 1;
const MAX_ZOMBIES_PER_MAP = 100;

const MAP_WIDTH = 32;
const MAP_HEIGHT = 10;

const ZOMBIE_HEALTH = 100;

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
  if (zombie.isDead) { return; }

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

ageAndRemoveZombiesIfDead = room => {
  room.zombies.forEach((zombie, index) => {
    if (zombie.isDead) {
      zombie.isDead += 1;
    }
  });
  room.zombies = room.zombies.filter(zombie => {
    return !zombie.isDead || zombie.isDead <= 2;
  });
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

  _getNewZombiesCount = (room) => {
    // Let them come in increasing waves
    const rate = room.zombiesPerTick * (Math.sin(room.totalTicks * 3.14 / WAVE_TICK_LENGTH) + 1) / 2;
    return Math.floor(rate) + ((Math.random() > rate % 1) ? 1 : 0);
  };

  _tickForRoom = (room) => {
    if (room.isFreezed) { return; }

    room.tickEpochMs = new Date().getTime();
    ageAndRemoveZombiesIfDead(room);
    room.zombies.forEach(moveZombie);
    const newZombiesCount = this._getNewZombiesCount(room);
    _.times(newZombiesCount, () => {
      if (room.zombies.length < MAX_ZOMBIES_PER_MAP) {
        room.zombies.push(newZombie());
      }
    });
    room.zombiesPerTick += NEW_ZOMBIES_PER_TICK_INCREMENT;
    room.totalTicks += 1;
    if (_.find(room.zombies, zombie => zombie.x < 0)) {
      Object.keys(room.clients).forEach(clientId => this.gameHostService.reportGameOver(clientId));
      this._destroyRoom(room.roomId);
    }
  };

  _reportMapForRoom = (room) => {
    Object.keys(room.clients).forEach(clientId => this._reportMapToClient({ clientId, roomId: room.roomId }));
  };

  _userJoined = ({ clientId, username, roomId }) => {
    console.log(`Client ${clientId} joined the room ${roomId}`);
    const client = { clientId, username };
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        isStarted: false,
        isFreezed: false,
        startedAt: undefined,
        zombies: [],
        zombiesPerTick: NEW_ZOMBIES_PER_TICK,
        totalTicks: 0,
        clients: { [clientId]: client },
      };
    } else {
      rooms[roomId].clients[clientId] = client;
      rooms[roomId].isFreezed = false;
      console.log(`Unfreezing the room ${roomId}`);
    }
    this._reportMapToClient({ clientId, roomId });
    this.emit(ROOMS_CHANGED, rooms);
  };

  _userLeft = ({ clientId }) => {
    const room = getClientRoom(clientId);
    console.log(`Client ${clientId} left the room ${room.roomId}`);
    if (room.clients[clientId]) delete room.clients[clientId];
    if (!Object.values(room.clients).length) {
      // Let's give the user a chance to rejoin in case of connection problems etc
      room.isFreezed = true;
      console.log(`The last client has left, freezing the room ${room.roomId} for the time being`);
      setTimeout(() => {
        if (!Object.values(room.clients).length) {
          this._destroyRoom(room.roomId);
        }
      }, REJOIN_GRACE_PERIOD_MS);
    }
    this.emit(ROOMS_CHANGED, rooms);
  };

  _reportMapToClient = ({ clientId, roomId }) => {
    this.gameHostService.reportMap(getMap(roomId), clientId);
  };

  _userStartedGame = ({ clientId }) => {
    const room = getClientRoom(clientId);
    console.log(`Starting game for room ${room.roomId}`);
    if (room.isStarted) {
      return;
    }
    room.isStarted = true;
    room.startedAt = new Date();
    this.emit(ROOMS_CHANGED, rooms);
  };

  _userShot = ({ clientId, damage, point: { x, y } }) => {
    const point = { x, y };
    const room = getClientRoom(clientId);
    const zombieHitIndex = _.findIndex(room.zombies, (zombie) => !zombie.isDead && zombie.x === x && zombie.y === y);
    let zombieId = undefined;
    let isKilled = undefined;
    if (zombieHitIndex >= 0) {
      const zombieHit = room.zombies[zombieHitIndex];
      zombieHit.health -= damage;
      zombieId = zombieHit.id;
      isKilled = zombieHit.health <= 0;
      if (isKilled) {
        zombieHit.isDead = 1;
      }
    }
    this.gameHostService.reportUserShot(clientId, point, zombieId, isKilled);
  };

  _destroyRoom = (roomId) => {
    console.log(`Destroying the room ${roomId}`);
    if (rooms[roomId]) delete rooms[roomId];
    this.emit(ROOMS_CHANGED, rooms);
  };
}

let engine = null;

export const getEngine = gameHostService => {
  engine = engine || new GameEngine(gameHostService);
  return engine;
};
