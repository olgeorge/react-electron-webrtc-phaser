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


let zombies = {};

var game;
var back;
var archer;
var anim;
var loopText;

var hitAnim;

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

const CELL_WIDTH = 20;
const CELL_HEIGHT = 60;
const ZOMBIE_WIDTH = 35;
const ZOMBIE_HEIGHT = 33;
const ZOMBIE_HIT_WIDTH = 15;
const ZOMBIE_HIT_HEIGHT = 25;
const ZOMBIE_ANCHOR_X = 17 / ZOMBIE_WIDTH;
const ZOMBIE_ANCHOR_Y = 21 / ZOMBIE_HEIGHT;
const ZOMBIE_SCALE = 2;
const WALL_WIDTH = 155;

const cellToPixel = ({ mapx, mapy }) => ({
  x: Math.round(WALL_WIDTH + mapx * CELL_WIDTH + ZOMBIE_WIDTH / 2),
  y: Math.round(mapy * CELL_HEIGHT + ZOMBIE_HEIGHT / 2),
});

const random = (fromInclusive, toExclusive) => Math.floor(Math.random() * (toExclusive - fromInclusive)) + fromInclusive;

const addArcherSprite = (name, { x, y }) => {
  const sprite = game.add.sprite(x, y, 'archer', 0);
  sprite.anchor.setTo(0.5, 0.5);
  sprite.animations.add('aim', _.range(0, 13), 20, false);
  sprite.animations.add('shoot', [14, 15, 0], 20, false);
  archer = { sprite };
  game.add.text(x - 30, y - 50, name, { font: "15px", fill: 'white', align: 'center'});
  //archer.scale.set(4);
  //archer.smoothed = false;

  //anim.onStart.add(animationStarted, this);
  //anim.onLoop.add(animationLooped, this);
  //anim.onComplete.add(animationStopped, this);

  //anim.play(10, true);
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
  //sprite.inputEnabled = true;
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
  //sprite.zombieId = id;
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
  back.inputEnabled = false;
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
  if (back) { back.inputEnabled = true; }
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
      connectionLost: false,
      gameOver: false,
      kills: 0,
    };
  }

  componentDidMount() {
    this.gameClientService = getClientService();
    this.gameClientService.on(EVENT_MAP_CHANGED, this.onMapChanged);
    this.gameClientService.on(EVENT_ZOMBIE_HIT, this.onZombieHit);
    this.gameClientService.on(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.on(EVENT_JOINED, this.startRendering);
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

  onMapChanged = ({ map }) => {
    if (this.state.gameOver) {
      unfreezeGame();
    }
    updateMap(map);
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
    console.log("You clicked down");
    archer.sprite.animations.play('aim');
  };

  onInputUp = (sprite, { x, y }) => {
    console.log("You clicked up");
    archer.sprite.animations.play('shoot');
    this.shootAtPoint({ x, y });
  };

  addBackground = () => {
    back = game.add.sprite(0, 0, 'bg');
    back.events.onInputDown.add(this.onInputDown, this);
    back.events.onInputUp.add(this.onInputUp, this);
    back.inputEnabled = true;
    //back.scale.set(0.5);
    back.smoothed = false;
  };

  preload = () => {
    game.load.image('bg', 'dist/assets/wall-full_2_pix.png');
    game.load.spritesheet('archer', 'dist/assets/archer_3.png', 64, 64, 16);
    game.load.spritesheet('zombie', 'dist/assets/zombie.png', 35, 33, 13 + 15 + 8);
  };

  create = () => {
    game.physics.startSystem(Phaser.Physics.ARCADE);
    this.addBackground();
    addArcherSprite(this.props.username, { x: 50, y: 300 });
  };

  startRendering = () => {
    game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.AUTO, 'game-canvas', {
      preload: this.preload,
      create: this.create,
      update: () => {
      },
    });
  };

  stopRendering = () => {
    game.destroy();
    game = undefined;
  };

  render() {
    const howMuch = this.state.kills > 50 ? 'plenty' : 'some';

    return (
      <div className={styles.outerContainer}>
        <div className={styles.killCount}>
          <p>kills: { this.state.kills }</p>
        </div>
        {
          this.state.gameOver &&
          <div className={styles.gameOverlay}>
            <h2>Score: { this.state.kills }</h2>
            <h4>You have killed { howMuch }, yet the bastards</h4>
            <h4>have managed to reach the wall!</h4>
          </div>
        }
        {
          !this.state.gameOver && this.state.connectionLost &&
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

export default connect(
  (state) => ({
    availableServers: state.availableServers,
  }),
  {
    dispatchServersDiscovered: serversDiscovered,
    dispatchMapChanged: mapChanged,
    dispatchGameOver: gameOver,
  }
)(Game);
