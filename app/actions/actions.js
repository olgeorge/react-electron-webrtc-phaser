import uuidv4 from 'uuid/v4';

/**
 * Builds a wrapper action creator from the given action creator with the following properties:
 * - The output of the wrapper equals to the output of the action creator, with property `type` added to it
 * - The wrapper itself has a property `type` which equals to the type of actions produced by the creator
 */
const buildActionCreator = (type, actionCreator, { isRequest, isResponse, isError } = {}) => {
  let wrapper = null;
  const action = {
    type,
    actionId: uuidv4(),
  };
  if (isRequest) action.isRequest = isRequest;
  if (isResponse) action.isResponse = isResponse;
  if (isError) action.isError = isError;
  if (actionCreator) {
    wrapper = (...args) => Object.assign(action, actionCreator(...args));
  } else {
    wrapper = () => (action);
  }
  wrapper.type = type;
  return wrapper;
};

export const setUsername = buildActionCreator('setUsername', username => ({ username }));

export const clearUsername = buildActionCreator('clearUsername');

export const roomsChanged = buildActionCreator('roomsChanged', (rooms) => ({ rooms }));

export const serversDiscovered = buildActionCreator('serversDiscovered', (servers) => ({ servers }));

export const clearServers = buildActionCreator('clearServers');

export const mapChanged = buildActionCreator('mapChanged', ({ map }) => ({ map }));

export const gameOver = buildActionCreator('gameOver');

