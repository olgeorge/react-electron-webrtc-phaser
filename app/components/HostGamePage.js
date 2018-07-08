import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import styles from './Common.css';
import { getService as getHostService } from '../services/gameHostService';
import {
  getEngine as getGameEngine,
  ROOMS_CHANGED,
} from '../services/gameEngine';
import {
  roomsChanged,
} from '../actions/actions';
import Rooms from './Rooms';

class HostGame extends Component {

  componentDidMount() {
    console.log(`Starting up server for host ${this.props.user.username}`);
    const gameHostService = getHostService(this.props.user.username);
    this.gameEngine = getGameEngine(gameHostService);
    this.gameEngine.on(ROOMS_CHANGED, this.props.dispatchRoomsChanged);
    this.gameEngine.start();
  }

  componentWillUnmount() {
    this.gameEngine.removeListener(ROOMS_CHANGED, this.props.dispatchRoomsChanged);
  }

  render() {
    const {
      user,
      rooms,
    } = this.props;
    const displayRooms = _.sortBy(Object.values(rooms), 'roomId')
      .map(({ roomId, usernames }) => ({ roomId, numPlayers: usernames.length }));
    return (
      <div className={styles.outerContainer}>
        <div className={styles.backButton} data-tid="backButton">
          <Link to="/home">
            <i className="fa fa-arrow-left fa-3x" />
          </Link>
        </div>
        <div className={styles.serverRoomsListContainer}>
          {
            !!displayRooms.length &&
            <h2>Opened Rooms for host { user.username }</h2>
          }
          {
            !displayRooms.length &&
            <div className={styles.container} data-tid="container">

              <h2>Host is ready</h2>
            </div>
          }
          <Rooms rooms={displayRooms}/>
        </div>
      </div>
    );
  }
}

export default connect(
  (state) => ({
    user: state.user,
    rooms: state.serverState.rooms,
  }),
  {
    dispatchRoomsChanged: roomsChanged,
  }
)(HostGame);
