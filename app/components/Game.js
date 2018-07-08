import React, { Component } from 'react';
import styles from './Common.css';
import {
  getService as getClientService,
  EVENT_JOINED,
  EVENT_OTHER_USER_JOINED,
  EVENT_OTHER_USER_LEFT,
  EVENT_MAP_CHANGED,
  EVENT_USER_SHOT,
  EVENT_GAME_OVER,
  EVENT_CONNECTION_ERROR,
  EVENT_CONNECTION_SUCCESS,
} from '../services/gameClientService';
import GameScreen, {
  LOAD_COMPLETE,
  SHOOT,
} from './GameScreen';

class Game extends Component {

  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      connectionLost: false,
      gameOver: false,
      kills: 0,
    };
  }

  componentDidMount() {
    const { username } = this.props;

    this.gameClientService = getClientService(username);

    this.screen = new GameScreen('game-canvas', this.gameClientService.clientId, username);
    this.screen.on(LOAD_COMPLETE, this.onLoadComplete);
    this.screen.on(SHOOT, this.shootAtPoint);

    this.startRendering();

    this.gameClientService.on(EVENT_MAP_CHANGED, this.onMapChanged);
    this.gameClientService.on(EVENT_USER_SHOT, this.onUserShot);
    this.gameClientService.on(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.on(EVENT_OTHER_USER_JOINED, this.otherUserJoined);
    this.gameClientService.on(EVENT_OTHER_USER_LEFT, this.otherUserLeft);
    this.gameClientService.on(EVENT_CONNECTION_ERROR, this.onConnectionError);
    this.gameClientService.on(EVENT_CONNECTION_SUCCESS, this.onConnectionSuccess);
  }

  componentWillUnmount() {
    this.stopRendering();

    this.screen.removeListener(LOAD_COMPLETE, this.onLoadComplete);
    this.screen.removeListener(SHOOT, this.shootAtPoint);

    this.destroyClient();
  }

  destroyClient = () => {
    if (!this.gameClientService) return;
    this.gameClientService.stop();
    this.gameClientService.removeListener(EVENT_MAP_CHANGED, this.onMapChanged);
    this.gameClientService.removeListener(EVENT_USER_SHOT, this.onUserShot);
    this.gameClientService.removeListener(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.removeListener(EVENT_OTHER_USER_JOINED, this.otherUserJoined);
    this.gameClientService.removeListener(EVENT_OTHER_USER_LEFT, this.otherUserLeft);
    this.gameClientService.removeListener(EVENT_CONNECTION_ERROR, this.onConnectionError);
    this.gameClientService.removeListener(EVENT_CONNECTION_SUCCESS, this.onConnectionSuccess);
    this.gameClientService = undefined;
  };

  onConnectionError = () => {
    this.screen.freezeGame();
    this.setState({ connectionLost: true });
  };

  onConnectionSuccess = () => {
    if (this.state.connectionLost) {
      this.setState({ connectionLost: false });
      this.screen.unfreezeGame();
    }
  };

  onLoadComplete = () => {
    this.setState({ loading: false });
  };

  onMapChanged = ({ map }) => {
    if (this.state.gameOver) {
      this.screen.unfreezeGame();
    }
    this.screen.updateMap(map);
  };

  otherUserJoined = ({ clientId, username }) => {
    this.screen.addArcher({ clientId, username });
    this.screen.repositionArchers();
  };

  otherUserLeft = ({ clientId }) => {
    this.screen.removeArcher({ clientId });
    this.screen.repositionArchers();
  };

  onUserShot = ({ shooterClientId, point, zombieId, isKilled }) => {
    this.screen.onUserShot({ shooterClientId, point, zombieId, isKilled });
    if (isKilled && shooterClientId === this.clientId) {
      this.setState({ kills: this.state.kills + 1 });
    }
  };

  shootAtPoint = ({ x, y }) => {
    this.gameClientService.shoot({ x, y });
  };

  onGameOver = () => {
    this.setState({ gameOver: true });
    this.destroyClient();
    this.screen.freezeGame();
  };

  startRendering = () => {
    this.screen.start();
  };

  stopRendering = () => {
    this.screen.destroy();
  };

  render() {
    const { kills, gameOver, connectionLost, loading } = this.state;
    const howMuch = kills > 50 ? 'plenty' : 'some';
    return (
      <div className={styles.outerContainer}>
        <div className={styles.killCount}>
          <p>kills: {kills}</p>
        </div>
        {
          loading &&
          <div className={[styles.gameOverlay, styles.solidOverlay].join(' ')}>
            <h2>Loading...</h2>
          </div>
        }
        {
          !loading && gameOver &&
          <div className={styles.gameOverlay}>
            <h2>Score: {kills}</h2>
            <h4>You have killed {howMuch}, yet the bastards</h4>
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
        <div id="game-canvas"/>
      </div>
    );
  }
}

export default Game;
