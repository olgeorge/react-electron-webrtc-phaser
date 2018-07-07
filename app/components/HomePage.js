// @flow
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import styles from './Common.css';
import { clearUsername } from '../actions/actions';

type Props = {};

class HomePage extends Component<Props> {
  props: Props;

  render() {
    return (
      <div className={styles.container} data-tid="container">
        <h2>Winter is Coming</h2>
        <Link to="/play-game">Play a game</Link>
        <Link to="/host-game">Host a game</Link>
        {/*<Link to="/" onClick={this.props.dispatchClearUsername}>Logout</Link>*/}
      </div>
    );
  }
}

export default connect(
  state => ({}),
  {
    dispatchClearUsername: clearUsername,
  }
)(HomePage);
