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
      const rooms = _.mapValues(action.rooms, ({ isStarted, isFreezed, clients, roomId }) => {
        return {
          roomId,
          isStarted,
          isFreezed,
          usernames: Object.values(clients).map(({ username }) => username),
        }
      });
      return { rooms };
    }

    default:
      return state;
  }
}
