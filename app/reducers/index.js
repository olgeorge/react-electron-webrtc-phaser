// @flow
import { combineReducers } from 'redux';
import { routerReducer as router } from 'react-router-redux';
import availableServers from './availableServers';
import serverState from './serverState';
import user from './user';

const rootReducer = combineReducers({
  user,
  serverState,
  availableServers,
  router,
});

export default rootReducer;
