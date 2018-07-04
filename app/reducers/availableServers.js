import _ from 'lodash';
import {
  serversDiscovered,
} from '../actions/actions';

const initialState = {
};

export default (state = initialState, action) => {
  switch (action.type) {
    case serversDiscovered.type: {
      return action.servers;
    }

    default:
      return state;
  }
}
