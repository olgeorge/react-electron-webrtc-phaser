/* eslint flowtype-errors/show-errors: 0 */
import React from 'react';
import { Switch, Route } from 'react-router';
import App from './containers/App';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import PlayGamePage from './components/PlayGamePage';
import HostGamePage from './components/HostGamePage';

export default class Routes extends React.Component {

  constructor(...args) {
    super(...args);
  }

  render() {
    return (
      <App>
        <Switch>
          <Route path="/play-game" component={PlayGamePage} />
          <Route path="/host-game" component={HostGamePage} />
          <Route path="/home" component={HomePage} />
          <Route path="/" component={LoginPage} />
        </Switch>
      </App>
    );
  }
}
