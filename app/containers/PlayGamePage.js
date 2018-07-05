import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import Game from './Game'
import styles from './Counter.css';
import {
  getService as getClientService,
  EVENT_MAP_CHANGED,
  EVENT_ZOMBIE_HIT,
  EVENT_GAME_OVER, EVENT_JOINED,
} from '../services/gameClientService';
import {
  serversDiscovered,
  mapChanged,
  gameOver,
} from '../actions/actions';

class PlayGame extends Component {

  constructor(...args) {
    super(...args);
    this.state = {
      serverId: undefined,
    }
  }

  componentDidMount() {
    this.gameClientService = getClientService();
    this.gameClientService.on(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.start()
      .then(() => {
        return this.gameClientService.discoverServers();
      })
      .then((servers) => {
        //this.props.dispatchServersDiscovered(servers);
        const server = Object.values(servers)[0];
        if (server) {
          this.setState({ serverId: server.serverId });
          this.gameClientService.joinNewRoom(server.serverId);
        }
      })
  }

  componentWillUnmount() {
    this.gameClientService.stop();
    this.gameClientService.removeListener(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService = undefined;
  }

  onGameOver = () => {
    this.props.dispatchGameOver();
  };

  render() {
    const {
      availableServers,
    } = this.props;
    return (
      <div className={styles.outerContainer}>
        {/*{*/}
          {/*!this.state.serverId &&*/}
          <div className={styles.backButton} data-tid="backButton">
            <Link to="/home">
              <i className="fa fa-arrow-left fa-3x"/>
            </Link>
          </div>
        {/*<div className={styles.container}>*/}
          {/*<pre>{JSON.stringify(availableServers, null, 2)}</pre>*/}
        {/*</div>*/}
        {
          this.state.serverId &&
          <Game username={this.props.user.username}/>
        }
      </div>
    );
  }
}

export default connect(
  (state) => ({
    availableServers: state.availableServers,
    user: state.user,
  }),
  {
    dispatchServersDiscovered: serversDiscovered,
    dispatchMapChanged: mapChanged,
    dispatchGameOver: gameOver,
  }
)(PlayGame);
