import _ from 'lodash';
import {
  mapChanged,
} from '../actions/actions';

const initialState = {
  map: {}
};

export default (state = initialState, action) => {
  switch (action.type) {
    case mapChanged.type: {
      const { map } = action;
      return { map };
    }

    default:
      return state;
  }
}
