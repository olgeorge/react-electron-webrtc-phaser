# Serverless React Electron Peer-to-Peer Phaser Game

<img src="https://github.com/olgeorge/react-electron-webrtc-phaser/raw/master/resources/screenshot.png" alt="screenshot" width="888px" height="641px"/>

### Tech Stack

- Built starting off of [electron-react-boilerplate](https://github.com/chentsulin/electron-react-boilerplate)
- Built with [Electron](http://electron.atom.io/) to package JS into a standalone app on Mac/Windows/Linux
- [React](https://facebook.github.io/react/), [Redux](https://github.com/reactjs/redux) and [React Router](https://github.com/reactjs/react-router) are used for the UI
- [Phaser.io](https://phaser.io/) is used as the HTML5 WebGL game engine 
- Uses [WebRTC](https://webrtc.org/) via [simple-peer](https://github.com/feross/simple-peer) as the p2p communication channel
- Uses [reconnecting-websocket](https://github.com/joewalnes/reconnecting-websocket) with a [wsninja](https://wsninja.io/) free server for signalling
- In a real world game [socket.io](https://socket.io/) should be used instead
- Is serverless in the sense that it uses a free WebSocket server for discovery and free public STUN servers for signalling. For a production game you will of course have to use paid ones =)
- Game art of the archer is [taken from here](https://opengameart.org/content/archer-static-64x64) and white walker [from here](https://jesse-m.itch.io/skeleton-pack)

### Game Features

It's a simple demonstration of the tech stack in a setting of *The Wall* being attacked by a never-ending increasing waves of *White Walkers*

Each user of the game can:
- Host a p2p server
- See how many rooms are opened on their server
- See how many players are currently in the rooms
- Join any room on any opened server or create a new one
- Leave the room at any time

The game mechanics is as follows:
- Players can shoot white walkers with the bow
- Players see when other players in the room shoot the bow
- See when they or other players hit the white walker
- If the White Walker receives enough damage, it dies
- The longer the player draws the bow, the larger the damage is
- The white walkers come in ever-increasing waves
- Yet, at any point in time the max number of white walkers is 100
- When a white walker reach the wall, the game is over
- You cannot win and the goal is to get the highest score

### Technical Details

- The game is started when the first player joins a room
- If the last player leaves, the room is frozen for 30 seconds and resumed if a player rejoins
- In case of the connection problems, the client will detect them and attempt to reconnect
- The server announces positions and velocities of walkers every 2 seconds
- The walkers move on the invisible 30x10 grid
- The client imitates continuous movement by applying the given velocity to game sprites
- The clients corrects positions and velocities with every update
- When a player shoots the walkers, the client checks if the player clicked on a walker 
- If so, it reports the coordinates of the walker as the Player's shooting target
- If the walker is hit, the server announces the hit to all clients of the room
- The other clients imitate the shot by the other player
- The above shebang exists to make up for the difference in what server knows (30x10) grid and what player sees (continuously moving walkers)
- The 30x10 grid and 2-second update were picked for demonstration purposes

## Play

You can download the packaged binaries for Mac and Windows:

- [Mac](https://drive.google.com/open?id=1zkYu915gHuQbxsIy-CDfLipO28FDYONJ) - install as a regular Mac app
- [Windows](https://drive.google.com/open?id=1B-1dHOZb6KAxedRr70K_ujPU9txBuhzU) - unpack and run the .exe

## Install

Clone the repository, then:

```bash
$ npm install
```

## Run

To run locally after installing:

```bash
$ npm run dev
```

To run locally several instances, chose a different port:

```bash
$ PORT=4343 npm run dev
```

## Packaging

To package apps for the local platform:

```bash
$ npm run package
```

To package apps for all platforms:

```bash
$ npm run package-all
```

To package apps with options:

```bash
$ npm run package -- --[option]
```

## Issues

Refer to [electron-react-boilerplate](https://github.com/chentsulin/electron-react-boilerplate) README for any issues with installation, running or packaging. 
