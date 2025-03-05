# CryptSeek Client

## Setup
You should have NodeJS and npm installed on your system.

### Install Dependencies
```sh
npm install
```

## Running the App
The App can be run in the terminal using
```sh
npx electron .
```

## Technical Description
- `main.js` - Loads the two electron windows used in the client
  - `subscriber.html` - Blank HTML file containing the javascript for subscribing to the message server
    - The window which loads this file is kept hidden, as it exists only to perform background actions
  - `index.html` - The main frontend for the interface
