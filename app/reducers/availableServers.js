import {
  serversDiscovered,
  clearServers,
} from '../actions/actions';

const initialState = null;

export default (state = initialState, action) => {
  switch (action.type) {
    case serversDiscovered.type: {
      return action.servers;
    }

    case clearServers.type: {
      return initialState;
    }

    default:
      return state;
  }
}
