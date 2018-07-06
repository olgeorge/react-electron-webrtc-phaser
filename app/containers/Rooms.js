import React, { Component } from 'react';
import styles from './Counter.css';

const Room = (onJoin, { roomId, hostUsername, numPlayers }) => {
  return (
    <div key={roomId} className={styles.roomPanel}>
      <h5>Players: { numPlayers }</h5>
      <a onClick={() => onJoin(roomId)}>Join room</a>
    </div>
  )
};

class Rooms extends Component {

  render() {
    const {
      rooms,
      onJoin,
    } = this.props;
    return (
      <div className={styles.roomsList}>
        { rooms.map(room => Room(onJoin, room)) }
      </div>
    );
  }
}

export default Rooms;
