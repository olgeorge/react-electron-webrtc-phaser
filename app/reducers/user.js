import {
  setUsername,
  clearUsername,
} from '../actions/actions';

const initialState = {
  username: undefined,
};

export default (state = initialState, action) => {
  switch (action.type) {
    case setUsername.type:
      return { username: action.username };

    case clearUsername.type:
      return initialState;

    default:
      return state;
  }
}
