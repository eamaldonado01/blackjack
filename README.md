# Blackjack Game

## Overview

This project contains a Blackjack game built with a React front end and a Node.js back end. It supports both single‑player and real‑time multiplayer modes. Multiplayer lobbies use Socket.IO for communication and Firebase (Firestore and Realtime Database) to keep track of players, game state and the leaderboard. A small set of Firebase Cloud Functions keeps data in sync when players disconnect. The front end is powered by Vite and includes a leaderboard that shows the top balances.

## Instructions

The steps below assume no dependencies are installed on your machine.

1. **Install Node.js** (version 20 or later is recommended):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
   Alternatively use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions.

2. **Install the Firebase CLI** (required to emulate Firebase locally):
   ```bash
   npm install -g firebase-tools
   ```

3. **Clone the repository** and move into the project folder:
   ```bash
   git clone <repo-url>
   cd blackjack
   ```

4. **Install dependencies** for all parts of the project:
   ```bash
   npm install                     # install root dependencies
   cd client && npm install        # front end
   cd ../server && npm install     # Node server
   cd ../functions && npm install  # Firebase functions
   cd ..                           # return to the project root
   ```

5. **Start Firebase emulators** (Firestore, Realtime Database and Functions):
   ```bash
   firebase emulators:start
   ```
   Leave this terminal running so the emulators stay active.

6. **Start the Node.js game server** in a new terminal:
   ```bash
   cd server
   node index.js
   ```
   The server listens on port `3001` by default.

7. **Start the React front end** in another terminal window:
   ```bash
   cd client
   npm run dev
   ```
   By default Vite serves the app on `http://localhost:5173`.

8. Open your browser and navigate to `http://localhost:5173` to play the game.

You should now be able to create lobbies and play Blackjack locally in single‑player or multiplayer mode with friends. If you wish to play with other people, simply have your friend run these steps too and join your lobby.
