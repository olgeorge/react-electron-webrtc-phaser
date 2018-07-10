import React, { Component } from 'react';
import styles from './Common.css';
import Rooms from './Rooms';
import { Link } from 'react-router-dom';

const Server = (onJoin, { serverId, hostUsername, rooms }) => {
  return (
    <div key={serverId} className={styles.serverPanel}>
      <div>
        <h4>Host: { hostUsername }</h4>
        <a onClick={() => onJoin(serverId)}>New room</a>
      </div>
      <div className={styles.roomsListContainer}>
        <h4>Opened Rooms</h4>
        <Rooms rooms={rooms} onJoin={(roomId) => onJoin(serverId, roomId)}/>
      </div>
    </div>
  )
};

class Servers extends Component {

  render() {
    const {
      servers,
      onJoin,
    } = this.props;
    return (
      <div className={styles.serversListContainer}>
        {
          !servers &&
          <div className={styles.container}>
            <h2>Looking for servers...</h2>
          </div>
        }
        {
          !!servers && !servers.length &&
          <div className={styles.container}>
            <h2>No servers found</h2>
            <h4>however, you can { <Link to="/host-game" className={styles.inlineLink}>host your own!</Link> }</h4>
          </div>
        }
        {
          !!servers && !!servers.length &&
          <h2>Available servers</h2>
        }
        <div className={styles.serversList}>
          { (servers || []).map(server => Server(onJoin, server)) }
        </div>
      </div>
    );
  }
}

export default Servers;
