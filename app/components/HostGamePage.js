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
    console.log('starting up server');
    const gameHostService = getHostService(this.props.user.username);
    const gameEngine = getGameEngine(gameHostService);
    gameEngine.on(ROOMS_CHANGED, this.props.dispatchRoomsChanged);
    gameEngine.start();
  }

  render() {
    const {
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
          <h2>Opened Rooms</h2>
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
