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
import Rooms from './Rooms'
import Servers from './Servers'

class PlayGame extends Component {

  constructor(...args) {
    super(...args);
    this.state = {
      serverId: undefined,
    }
  }

  componentDidMount() {
    const { user } = this.props;
    this.gameClientService = getClientService(user.username);
    this.gameClientService.on(EVENT_GAME_OVER, this.onGameOver);
    this.gameClientService.start()
      .then(() => {
        return this.gameClientService.discoverServers();
      })
      .then((servers) => {
        this.props.dispatchServersDiscovered(servers);
        //console.log('servers', servers);
        //
        ////this.props.dispatchServersDiscovered(servers);
        //const server = Object.values(servers)[0];
        //if (server) {
        //  this.setState({ serverId: server.serverId });
        //  this.gameClientService.joinNewRoom(server.serverId);
        //}
      })
  }

  componentWillUnmount() {
    this.gameClientService.stop();
    this.gameClientService.removeListener(EVENT_GAME_OVER, this.onGameOver);
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

  onGameOver = () => {
    this.props.dispatchGameOver();
  };

  render() {
    const {
      user,
      availableServers,
    } = this.props;

    //const rooms = _.flatten(Object.keys(availableServers).map(serverId => {
    //  const { rooms, hostUsername } = availableServers[serverId];
    //  return rooms.map(({ roomId, numPlayers }) => ({ serverId, hostUsername, roomId, numPlayers }));
    //}));
    //console.log(rooms);
    const servers = _.sortBy(Object.values(availableServers), 'serverId');
    console.log('==availableServers');
    console.log(servers);
    return (
      <div className={styles.outerContainer}>
        <div className={styles.backButton} data-tid="backButton">
          <Link to="/home">
            <i className="fa fa-arrow-left fa-3x"/>
          </Link>
        </div>
        {/*<pre>{JSON.stringify(rooms)}</pre>*/}
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
    dispatchServersDiscovered: serversDiscovered,
    dispatchMapChanged: mapChanged,
    dispatchGameOver: gameOver,
  }
)(PlayGame);
