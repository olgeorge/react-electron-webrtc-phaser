import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import Game from './Game'
import styles from './Common.css';
import { getService as getClientService } from '../services/gameClientService';
import {
  clearServers,
  serversDiscovered,
  mapChanged,
  gameOver,
} from '../actions/actions';
import Servers from './Servers'

class PlayGame extends Component {

  constructor(...args) {
    super(...args);
    this.state = {
      serverId: undefined,
    }
  }

  componentWillMount() {
    this.props.dispatchClearServers();
  }

  componentDidMount() {
    const { user } = this.props;
    this.gameClientService = getClientService(user.username);
    this.gameClientService.start()
      .then(() => {
        return this.gameClientService.discoverServers();
      })
      .then((servers) => {
        this.props.dispatchServersDiscovered(servers);
      })
  }

  componentWillUnmount() {
    this.props.dispatchClearServers();
    this.gameClientService.stop();
    this.gameClientService = undefined;
  }

  onJoin = (serverId, roomId) => {
    this.setState({ serverId });
    if (roomId) {
      this.gameClientService.joinRoom(serverId, roomId);
    } else {
      this.gameClientService.joinNewRoom(serverId);
    }
  };

  render() {
    const {
      user,
      availableServers,
    } = this.props;
    const servers = availableServers ? _.sortBy(Object.values(availableServers), 'serverId') : undefined;
    return (
      <div className={styles.outerContainer}>
        <div className={styles.backButton} data-tid="backButton">
          <Link to="/home">
            <i className="fa fa-arrow-left fa-3x"/>
          </Link>
        </div>
        {
          !this.state.serverId &&
          <Servers servers={servers} onJoin={this.onJoin}/>
        }
        {
          this.state.serverId &&
          <Game username={user.username}/>
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
    dispatchClearServers: clearServers,
    dispatchServersDiscovered: serversDiscovered,
    dispatchMapChanged: mapChanged,
    dispatchGameOver: gameOver,
  }
)(PlayGame);
