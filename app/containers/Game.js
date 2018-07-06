import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import 'pixi';
import 'p2';
import Phaser from 'phaser';
import _ from 'lodash';
import { remote } from 'electron';
import styles from './Counter.css';
import {
  getService as getClientService,
  EVENT_JOINED,
  EVENT_OTHER_USER_JOINED,
  EVENT_OTHER_USER_LEFT,
  EVENT_MAP_CHANGED,
  EVENT_ZOMBIE_HIT,
  EVENT_GAME_OVER,
  EVENT_CONNECTION_ERROR,
  EVENT_CONNECTION_SUCCESS,
} from '../services/gameClientService';
import {
  serversDiscovered,
  mapChanged,
  gameOver,
} from '../actions/actions';


let game;
let background;
let zombies = {};
let archers = {};
let archer = undefined;

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

const cellToPixel = ({ mapx, mapy }) => ({
  x: Math.round(MAP_MARGIN_LEFT + mapx * CELL_WIDTH + ZOMBIE_WIDTH / 2 * ZOMBIE_SCALE),
  y: Math.round(MAP_MARGIN_TOP +  mapy * CELL_HEIGHT + ZOMBIE_HEIGHT / 2 * ZOMBIE_SCALE),
});

const random = (fromInclusive, toExclusive) => Math.floor(Math.random() * (toExclusive - fromInclusive)) + fromInclusive;

const addArcher = ({ clientId, username }) => {
  const x = -100;
  const y = -100;
  const sprite = game.add.sprite(x, y, 'archer', 0);
  sprite.anchor.setTo(0.5, 0.5);
  sprite.animations.add('aim', _.range(0, 13), 20, false);
  sprite.animations.add('shoot', [14, 15, 0], 20, false);
  const text = game.add.text(x - NAME_DISPLACEMENT_X, y - NAME_DISPLACEMENT_Y, username,
    { font: "15px", fill: 'white', align: 'center'});
  const ar = { clientId, username, sprite, text, joinTime: new Date().getTime() };
  archers[clientId] = ar;
  return ar;
};

const removeArcher = ({ clientId }) => {
  const ar = archers[clientId];
  if (!ar) return;
  ar.sprite.destroy();
  ar.text.destroy();
  delete archers[clientId];
};

const repositionArchers = () => {
  const archersArray = Object.values(archers);
  _.sortBy(archersArray, 'joinTime').forEach((ar, index) => {
    const x = 25;
    const y = SCREEN_HEIGHT / (archersArray.length + 1) * (index + 1);
    ar.sprite.x = x;
    ar.sprite.y = y;
    ar.text.x = x - NAME_DISPLACEMENT_X;
    ar.text.y = y - NAME_DISPLACEMENT_Y;
  })
};

const removeZombie = (id) => {
  const zombie = zombies[id];
  if (!zombie) return;
  zombie.sprite.destroy();
  delete zombies[id];
};

const addZombie = ({ x: mapx, y: mapy, vx: mapvx, vy: mapvy, id, health }) => {
  const { x, y } = cellToPixel({ mapx, mapy });
  const sprite = game.add.sprite(x, y, 'zombie', 0);
  sprite.anchor.setTo(ZOMBIE_ANCHOR_X, ZOMBIE_ANCHOR_Y);
  sprite.animations.add('walk', _.range(0, 13), 12, true);
  const dieAnimation = sprite.animations.add('die', _.range(13, 13 + 15), 12, false);
  dieAnimation.onComplete.add(() => removeZombie(id), this);
  const hitAnimation = sprite.animations.add('hit', _.range(13 + 15, 13 + 15 + 8), 12, false);
  hitAnimation.onComplete.add(() => sprite.animations.play('walk'), this);
  sprite.scale.set(ZOMBIE_SCALE);
  sprite.scale.x *= -1;
  sprite.smoothed = false;
  sprite.animations.play('walk');
  sprite.animations.currentAnim.setFrame(random(0, 13), true);
  game.physics.enable(sprite, Phaser.Physics.ARCADE);
  sprite.body.velocity.x = mapvx * CELL_WIDTH / 2;
  sprite.body.velocity.y = mapvy * CELL_HEIGHT / 2;
  const zombie = { id, mapx, mapy, mapvx, mapvy, health, sprite };
  zombies[id] = zombie;
  return zombie;
};

const updateZombie = ({ x: mapx, y: mapy, vx: mapvx, vy: mapvy, id, health }) => {
  const { x, y } = cellToPixel({ mapx, mapy });
  const { sprite } = zombies[id];
  sprite.x = x;
  sprite.y = y;
  sprite.body.velocity.x = mapvx * CELL_WIDTH / 2;
  sprite.body.velocity.y = mapvy * CELL_HEIGHT / 2;
  const zombie = { id, mapx, mapy, mapvx, mapvy, health, sprite };
  zombies[id] = zombie;
  return zombie;
};

const createOrUpdateZombie = ({ x, y, vx, vy, id, health }) => {
  return zombies[id] ? updateZombie({ x, y, vx, vy, id, health }) : addZombie({ x, y, vx, vy, id, health });
};

const updateMap = (map) => {
  Object.values(map.zombies).forEach(zombie => {
    const updatedZombie = createOrUpdateZombie(zombie);
    updatedZombie.isVisited = true;
  });
  Object.values(zombies).forEach(zombie => {
    if (zombie && !zombie.isVisited && !zombie.isDead) {
      removeZombie(zombie.id);
    } else {
      zombie.isVisited = false;
    }
  });
};

const pointIsInZombie = ({ x, y }, sprite) => {
  return Math.abs(sprite.x - x) < ZOMBIE_SCALE * ZOMBIE_HIT_WIDTH / 2 &&
    Math.abs(sprite.y - y) < ZOMBIE_SCALE * ZOMBIE_HIT_HEIGHT / 2;
};

const freezeGame = () => {
  background.inputEnabled = false;
  archer.sprite.animations.stop();
  Object.values(zombies).forEach(zombie => {
    if (zombie) {
      zombie.sprite.body.velocity.x = 0;
      zombie.sprite.body.velocity.y = 0;
      zombie.sprite.animations.stop();
    }
  });
};

const unfreezeGame = () => {
  if (background) { background.inputEnabled = true; }
  Object.values(zombies).forEach(zombie => {
    if (zombie) {
      zombie.sprite.body.velocity.x = zombie.mapvx * CELL_WIDTH / 2;
      zombie.sprite.body.velocity.y = zombie.mapvy * CELL_HEIGHT / 2;
      zombie.sprite.animations.play('walk');
    }
  });
};

class Game extends Component {

  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      connectionLost: false,
      gameOver: false,
      kills: 0,
    };
  }

  componentDidMount() {
    this.gameClientService = getClientService(this.props.username);
    this.gameClientService.on(EVENT_MAP_CHANGED, this.onMapChanged);
    this.gameClientService.on(EVENT_ZOMBIE_HIT, this.onZombieHit);
    this.gameClientService.on(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.on(EVENT_JOINED, this.startRendering);
    this.gameClientService.on(EVENT_OTHER_USER_JOINED, this.otherUserJoined);
    this.gameClientService.on(EVENT_OTHER_USER_LEFT, this.otherUserLeft);
    this.gameClientService.on(EVENT_CONNECTION_ERROR, this.onConnectionError);
    this.gameClientService.on(EVENT_CONNECTION_SUCCESS, this.onConnectionSuccess);
  }

  componentWillUnmount() {
    this.stopRendering();
    this.gameClientService.stop();
    this.gameClientService.removeListener(EVENT_MAP_CHANGED, this.onMapChanged);
    this.gameClientService.removeListener(EVENT_ZOMBIE_HIT, this.onZombieHit);
    this.gameClientService.removeListener(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.removeListener(EVENT_JOINED, this.startRendering);
    this.gameClientService.removeListener(EVENT_OTHER_USER_JOINED, this.otherUserJoined);
    this.gameClientService.removeListener(EVENT_OTHER_USER_LEFT, this.otherUserLeft);
    this.gameClientService.removeListener(EVENT_CONNECTION_ERROR, this.onConnectionError);
    this.gameClientService.removeListener(EVENT_CONNECTION_SUCCESS, this.onConnectionSuccess);
    this.gameClientService = undefined;
  }

  onConnectionError = () => {
    freezeGame();
    this.setState({ connectionLost: true });
  };

  onConnectionSuccess = () => {
    if (this.state.connectionLost) {
      this.setState({ connectionLost: false });
      unfreezeGame();
    }
  };

  onLoadStart = () => {
    this.setState({ loading: true });
  };

  onLoadComplete = () => {
    this.setState({ loading: false });
  };

  onMapChanged = ({ map }) => {
    console.log('Received map', map);
    if (this.state.gameOver) {
      unfreezeGame();
    }
    updateMap(map);
  };

  otherUserJoined = ({ clientId, username }) => {
    addArcher({ clientId, username });
    repositionArchers();
  };

  otherUserLeft = ({ clientId }) => {
    removeArcher({ clientId });
    repositionArchers();
  };

  onZombieHit = ({ clientId, zombieId, isKilled }) => {
    const zombie = zombies[zombieId];
    if (isKilled) {
      zombie.isDead = true;
      zombie.sprite.body.velocity.x = 0;
      zombie.sprite.body.velocity.y = 0;
      zombie.sprite.animations.play('die');
      if (clientId === this.gameClientService.clientId) {
        this.setState({ kills: this.state.kills + 1});
      }
    } else {
      zombie.sprite.animations.play('hit');
    }
  };

  shootAtPoint = ({ x, y }) => {
    const zombieHit = _.find(Object.values(zombies), ({ sprite }) => pointIsInZombie({ x, y }, sprite));
    if (zombieHit) {
      this.gameClientService.shoot({ x: zombieHit.mapx, y: zombieHit.mapy });
    }
  };

  onGameOver = () => {
    this.setState({ gameOver: true });
    this.gameClientService.removeListener(EVENT_MAP_CHANGED, this.onMapChanged);
    this.gameClientService.removeListener(EVENT_ZOMBIE_HIT, this.onZombieHit);
    this.gameClientService.removeListener(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.removeListener(EVENT_JOINED, this.startRendering);
    freezeGame();
  };

  onInputDown = () => {
    archer.sprite.animations.play('aim');
  };

  onInputUp = (sprite, { x, y }) => {
    archer.sprite.animations.play('shoot');
    this.shootAtPoint({ x, y });
  };

  addBackground = () => {
    background = game.add.sprite(0, 0, 'bg');
    background.events.onInputDown.add(this.onInputDown, this);
    background.events.onInputUp.add(this.onInputUp, this);
    background.inputEnabled = true;
    background.smoothed = false;
  };

  //https://opengameart.org/content/archer-static-64x64
  //https://jesse-m.itch.io/skeleton-pack

  preload = () => {
    game.load.image('bg', 'dist/assets/wall-full_6.png');
    game.load.spritesheet('archer', 'dist/assets/archer_3.png', 64, 64, 16);
    game.load.spritesheet('zombie', 'dist/assets/zombie.png', 35, 33, 13 + 15 + 8);
  };

  create = () => {
    game.physics.startSystem(Phaser.Physics.ARCADE);
    game.load.onLoadStart.add(this.onLoadStart, this);
    game.load.onLoadComplete.add(this.onLoadComplete, this);
    this.addBackground();
    archer = addArcher({
      username: this.props.username,
      clientId: this.gameClientService.clientId,
    });
    repositionArchers();
    //addZombie({ x: 0, y: 0, vx: 0, vy: 0, id: 1, health: 100 })
    //addZombie({ x: 10, y: 0, vx: 0, vy: 0, id: 23, health: 100 })
    //addZombie({ x: 20, y: 0, vx: 0, vy: 0, id: 2343, health: 100 })
    //addZombie({ x: 27, y: 0, vx: 0, vy: 0, id: 4, health: 100 })
    //addZombie({ x: 28, y: 0, vx: 0, vy: 0, id: 2234, health: 100 })
    //addZombie({ x: 29, y: 0, vx: 0, vy: 0, id: 3, health: 100 })
    //addZombie({ x: 0, y: 9, vx: 0, vy: 0, id: 1, health: 100 })
    //addZombie({ x: 10, y: 9, vx: 0, vy: 0, id: 435, health: 100 })
    //addZombie({ x: 20, y: 9, vx: 0, vy: 0, id: 76, health: 100 })
    //addZombie({ x: 29, y: 9, vx: 0, vy: 0, id: 45325, health: 100 })
    //addZombie({ x: 30, y: 9, vx: 0, vy: 0, id: 2, health: 100 })
    //addZombie({ x: 31, y: 9, vx: 0, vy: 0, id: 3, health: 100 })
  };

  startRendering = () => {
    game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.AUTO, 'game-canvas', {
      preload: this.preload,
      create: this.create,
    });
  };

  stopRendering = () => {
    game.destroy();
    game = undefined;
  };

  render() {
    const { kills, gameOver, connectionLost, loading } = this.state;
    const howMuch = kills > 50 ? 'plenty' : 'some';
    return (
      <div className={styles.outerContainer}>
        <div className={styles.killCount}>
          <p>kills: { kills }</p>
        </div>
        {
          loading &&
          <div className={styles.gameOverlay}>
            <h2>Loading...</h2>
          </div>
        }
        {
          !loading && gameOver &&
          <div className={styles.gameOverlay}>
            <h2>Score: { kills }</h2>
            <h4>You have killed { howMuch }, yet the bastards</h4>
            <h4>have managed to reach the wall!</h4>
          </div>
        }
        {
          !loading && !gameOver && connectionLost &&
          <div className={styles.gameOverlay}>
            <h2>Connection Lost</h2>
            <h4>reconnecting to the server...</h4>
          </div>
        }
        <div id="game-canvas" />
      </div>
    );
  }
}

export default Game;
