// @flow
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { FormGroup, ControlLabel, FormControl, Button } from 'react-bootstrap';
import styles from './Home.css';
import { setUsername } from '../actions/actions';
import { history } from '../store/configureStore';

type Props = {};

class LoginPage extends Component<Props> {
  props: Props;

  constructor(...args) {
    super(...args);

    this.state = {
      username: '',
    };
  }

  onUsernameChange = (event) => {
    this.setState({ username: event.target.value });
  };

  onSubmit = () => {
    this.onLinkClick();
    history.push('/home');
  }

  onLinkClick = () => {
    this.props.dispatchSetUsername(this.state.username);
  }

  render() {
    const { username } = this.state
    const onSubmit = username ? this.onSubmit : undefined;
    return (
      <div className={styles.container} data-tid="container">
        <h2>Winter is Coming</h2>
        <form className={styles.formCentered} onSubmit={onSubmit}>
          <FormGroup>
            <ControlLabel>Pick a user name:</ControlLabel>
            <FormControl
              type="text"
              label="Text"
              placeholder="Your user name"
              value={this.state.username}
              onChange={this.onUsernameChange}
            />
          </FormGroup>
          {
            username &&
            <Link to='/home' onClick={this.onLinkClick}>Start</Link>
          }
        </form>
      </div>
    );
  }
}

export default connect(
  state => ({}),
  {
    dispatchSetUsername: setUsername,
  }
)(LoginPage);
