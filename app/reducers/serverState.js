import _ from 'lodash';
import {
  roomsChanged
} from '../actions/actions';

const initialState = {
  rooms: {},
};

export default (state = initialState, action) => {
  switch (action.type) {
    case roomsChanged.type: {
      const rooms = _.mapValues(action.rooms, ({ isStarted, clients }) => {
        return {
          isStarted,
          usernames: Object.values(clients).map(({ username }) => username),
        }
      });
      return { rooms };
    }

    default:
      return state;
  }
}
