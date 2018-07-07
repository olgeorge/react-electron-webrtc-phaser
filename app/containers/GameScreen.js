import EventEmitter from 'events';
import 'pixi';
import 'p2';
import Phaser from 'phaser';
import _ from 'lodash';

export const LOAD_COMPLETE = 'load-complete';
export const SHOOT = 'shoot';

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

const CELL_WIDTH = 24;
const CELL_HEIGHT = 58;
const ZOMBIE_WIDTH = 35;
const ZOMBIE_HEIGHT = 33;
const ZOMBIE_HIT_WIDTH = 15;
const ZOMBIE_HIT_HEIGHT = 25;
const ZOMBIE_ANCHOR_X = 17 / ZOMBIE_WIDTH;
const ZOMBIE_ANCHOR_Y = 21 / ZOMBIE_HEIGHT;
const ZOMBIE_SCALE = 2;
const MAP_MARGIN_LEFT = 55;
const MAP_MARGIN_TOP = 20;

const NAME_DISPLACEMENT_X = 22;
const NAME_DISPLACEMENT_Y = 53;

const random = (fromInclusive, toExclusive) => Math.floor(Math.random() * (toExclusive - fromInclusive)) + fromInclusive;

const cellToPixel = ({ mapx, mapy }) => ({
  x: Math.round(MAP_MARGIN_LEFT + mapx * CELL_WIDTH + ZOMBIE_WIDTH / 2 * ZOMBIE_SCALE),
  y: Math.round(MAP_MARGIN_TOP + mapy * CELL_HEIGHT + ZOMBIE_HEIGHT / 2 * ZOMBIE_SCALE),
});

const pointIsInZombie = ({ x, y }, sprite) => {
  return Math.abs(sprite.x - x) < ZOMBIE_SCALE * ZOMBIE_HIT_WIDTH / 2 &&
    Math.abs(sprite.y - y) < ZOMBIE_SCALE * ZOMBIE_HIT_HEIGHT / 2;
};

class GameScreen extends EventEmitter {

  constructor(canvasId, clientId, username) {
    super();
    this.canvasId = canvasId;
    this.clientId = clientId;
    this.username = username;
    this.game = undefined;
    this.background = undefined;
    this.archer = undefined;
    this.archers = {};
    this.zombies = {};
  }

  start = () => {
    this.game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.AUTO, this.canvasId, {
      preload: this.preload,
      create: this.create,
    });
  };

  preload = () => {
    //https://opengameart.org/content/archer-static-64x64
    //https://jesse-m.itch.io/skeleton-pack
    const loader = this.game.load.image('bg', 'dist/assets/background.png');
    loader.spritesheet('archer', 'dist/assets/archer.png', 64, 64, 16);
    loader.spritesheet('zombie', 'dist/assets/zombie.png', 35, 33, 13 + 15 + 8);
    loader.onLoadComplete.addOnce(this.onLoadComplete, this);
  };

  create = () => {
    this.game.physics.startSystem(Phaser.Physics.ARCADE);
    this.addBackground();
    this.archer = this.addArcher({
      username: this.username,
      clientId: this.clientId,
    });
    this.repositionArchers();
  };

  addBackground = () => {
    this.background = this.game.add.sprite(0, 0, 'bg');
    this.background.events.onInputDown.add(this.onInputDown, this);
    this.background.events.onInputUp.add(this.onInputUp, this);
    this.background.inputEnabled = true;
    this.background.smoothed = false;
  };

  onInputDown = () => {
    this.archer.sprite.animations.play('aim');
  };

  onInputUp = (sprite, { x, y }) => {
    this.archer.sprite.animations.play('shoot');
    const zombieHit = _.find(Object.values(this.zombies), (zombie) => pointIsInZombie({ x, y }, zombie.sprite));
    if (zombieHit) {
      this.emit(SHOOT, { x: zombieHit.mapx, y: zombieHit.mapy });
    }
  };

  onLoadComplete = () => {
    this.emit(LOAD_COMPLETE);
  };

  addArcher = ({ clientId, username }) => {
    const x = -100;
    const y = -100;
    const sprite = this.game.add.sprite(x, y, 'archer', 0);
    const text = this.game.add.text(x - NAME_DISPLACEMENT_X, y - NAME_DISPLACEMENT_Y, username,
      { font: "15px", fill: 'white', align: 'center' });
    const ar = { clientId, username, sprite, text, joinTime: new Date().getTime() };
    sprite.anchor.setTo(0.5, 0.5);
    const aimAnim = sprite.animations.add('aim', _.range(0, 13), 20, false);
    const shootAnim = sprite.animations.add('shoot', [14, 15, 0], 20, false);
    if (this.clientId !== clientId) {
      // Archers for other players can imitate shooting
      aimAnim.onComplete.add(() => sprite.animations.play('shoot'), this);
      shootAnim.onComplete.add(() => {
        if (!ar.zombieHit) { return; }
        this.hitZombie(ar.zombieHit);
        ar.zombieHit = undefined;
      }, this);
    }
    this.archers[clientId] = ar;
    return ar;
  };

  removeArcher = ({ clientId }) => {
    const ar = this.archers[clientId];
    if (!ar) return;
    ar.sprite.destroy();
    ar.text.destroy();
    delete this.archers[clientId];
  };

  updateArchers = (newClients) => {
    const archersToDelete = _.omit(this.archers, Object.keys(newClients));
    const clientsToAdd = _.omit(newClients, Object.keys(this.archers));
    Object.values(archersToDelete).forEach(({ clientId }) => this.removeArcher({ clientId }));
    Object.values(clientsToAdd).forEach(({ clientId, username }) => this.addArcher({ clientId, username }));
    this.repositionArchers();
  };

  repositionArchers = () => {
    const archersArray = Object.values(this.archers);
    _.sortBy(archersArray, 'joinTime').forEach((ar, index) => {
      const x = 25;
      const y = SCREEN_HEIGHT / (archersArray.length + 1) * (index + 1);
      ar.sprite.x = x;
      ar.sprite.y = y;
      ar.text.x = x - NAME_DISPLACEMENT_X;
      ar.text.y = y - NAME_DISPLACEMENT_Y;
    });
  };

  removeZombie = (id) => {
    const zombie = this.zombies[id];
    if (!zombie) return;
    zombie.sprite.destroy();
    delete this.zombies[id];
  };

  addZombie = ({ x: mapx, y: mapy, vx: mapvx, vy: mapvy, id, health }) => {
    const { x, y } = cellToPixel({ mapx, mapy });
    const sprite = this.game.add.sprite(x, y, 'zombie', 0);
    sprite.anchor.setTo(ZOMBIE_ANCHOR_X, ZOMBIE_ANCHOR_Y);
    sprite.animations.add('walk', _.range(0, 13), 12, true);
    const dieAnimation = sprite.animations.add('die', _.range(13, 13 + 15), 12, false);
    dieAnimation.onComplete.add(() => this.removeZombie(id), this);
    const hitAnimation = sprite.animations.add('hit', _.range(13 + 15, 13 + 15 + 8), 12, false);
    hitAnimation.onComplete.add(() => sprite.animations.play('walk'), this);
    sprite.scale.set(ZOMBIE_SCALE);
    sprite.scale.x *= -1;
    sprite.smoothed = false;
    sprite.animations.play('walk');
    sprite.animations.currentAnim.setFrame(random(0, 13), true);
    this.game.physics.enable(sprite, Phaser.Physics.ARCADE);
    sprite.body.velocity.x = mapvx * CELL_WIDTH / 2;
    sprite.body.velocity.y = mapvy * CELL_HEIGHT / 2;
    const zombie = { id, mapx, mapy, mapvx, mapvy, health, sprite };
    this.zombies[id] = zombie;
    return zombie;
  };

  updateZombie = ({ x: mapx, y: mapy, vx: mapvx, vy: mapvy, id, health }) => {
    const { x, y } = cellToPixel({ mapx, mapy });
    const { sprite } = this.zombies[id];
    sprite.x = x;
    sprite.y = y;
    sprite.body.velocity.x = mapvx * CELL_WIDTH / 2;
    sprite.body.velocity.y = mapvy * CELL_HEIGHT / 2;
    const zombie = { id, mapx, mapy, mapvx, mapvy, health, sprite };
    this.zombies[id] = zombie;
    return zombie;
  };

  createOrUpdateZombie = ({ x, y, vx, vy, id, health }) => {
    return this.zombies[id] ? this.updateZombie({ x, y, vx, vy, id, health }) : this.addZombie({ x, y, vx, vy, id, health });
  };

  updateMap = (map) => {
    Object.values(map.zombies).forEach(zombie => {
      const updatedZombie = this.createOrUpdateZombie(zombie);
      updatedZombie.isVisited = true;
    });
    Object.values(this.zombies).forEach(zombie => {
      if (zombie && !zombie.isVisited && !zombie.isDead) {
        this.removeZombie(zombie.id);
      } else {
        zombie.isVisited = false;
      }
    });
    this.updateArchers(map.clients);
  };

  freezeGame = () => {
    this.background.inputEnabled = false;
    this.archer.sprite.animations.stop();
    Object.values(this.zombies).forEach(zombie => {
      if (zombie) {
        zombie.sprite.body.velocity.x = 0;
        zombie.sprite.body.velocity.y = 0;
        zombie.sprite.animations.stop();
      }
    });
  };

  unfreezeGame = () => {
    if (this.background) {
      this.background.inputEnabled = true;
    }
    Object.values(this.zombies).forEach(zombie => {
      if (zombie) {
        zombie.sprite.body.velocity.x = zombie.mapvx * CELL_WIDTH / 2;
        zombie.sprite.body.velocity.y = zombie.mapvy * CELL_HEIGHT / 2;
        zombie.sprite.animations.play('walk');
      }
    });
  };

  hitZombie = ({ zombieId, isKilled }) => {
    const zombie = this.zombies[zombieId];
    if (!zombie) { return; }
    if (isKilled) {
      zombie.isDead = true;
      zombie.sprite.body.velocity.x = 0;
      zombie.sprite.body.velocity.y = 0;
      zombie.sprite.animations.play('die');
    } else {
      zombie.sprite.animations.play('hit');
    }
  };

  onZombieHit = ({ shooterClientId, zombieId, isKilled }) => {
    if (shooterClientId === this.clientId) {
      this.hitZombie({ zombieId, isKilled });
    } else {
      console.log('shooterClientId', shooterClientId);
      console.log('archers', this.archers);
      const ar = this.archers[shooterClientId];
      if (!ar) { return; }
      ar.zombieHit = { zombieId, isKilled };
      ar.sprite.animations.play('shoot');
    }
  };

  destroy = () => {
    if (this.game) {
      this.game.destroy();
      this.game = undefined;
    }
  }
};

export default GameScreen;
