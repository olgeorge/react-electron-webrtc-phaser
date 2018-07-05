import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import styles from './Counter.css';
import { getService as getHostService } from '../services/gameHostService';
import {
  getEngine as getGameEngine,
  ROOMS_CHANGED,
} from '../services/gameEngine';
import {
  roomsChanged,
} from '../actions/actions';

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
    return (
      <div className={styles.outerContainer}>
        <div className={styles.backButton} data-tid="backButton">
          <Link to="/home">
            <i className="fa fa-arrow-left fa-3x" />
          </Link>
        </div>
        <div className={styles.container}>
          <pre>{JSON.stringify(rooms, null, 2)}</pre>
        </div>
      </div>
    );
  }
}

export default connect(
  (state) => ({
    user: state.user,
    rooms: state.rooms,
  }),
  {
    dispatchRoomsChanged: roomsChanged,
  }
)(HostGame);