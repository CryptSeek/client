# Client Server Initialization

Be sure to do the following in the electron-client-server directory locally (To big for GitHub)\
Commands (I did this via WSL):

### Install Dependencies (Might not be all, these are the ones I needed):
```bash
    $ sudo apt update
    $ sudo apt install libnss3
    $ sudo apt install libgbm1
    $ npm install axios
```

### Install Node Version Manager
```bash
    $ curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
    $ source ~/.bashrc
```

### Install Node.js LTS Version
```bash
    $ nvm install --lts
    $ nvm use –lts
```

### Install Electron
```bash
    $ npm init -y
    $ npm install electron
```

### Install Express (We’ll change to zeromq later)
```bash
    $ npm install express
```

---

## Running the Servers

### In one terminal:
```bash
	$ node server.js
``` 
(Messages from client-server will show up here)

### In another terminal:
```bash
	$ npx electron .
``` 
(A message in the window will appear showing that the two servers were in contact)

index.html (HTML Page for Client-Server)\
server.js (CHANGE TO ZEROMQ)\
client.js (Client-server)
