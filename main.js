const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const crypt = require('./crypto/crypto.js');
const Store = require("electron-store");
const fs = require('fs');
const path = require("node:path");
const {generateKeyIdentifier, decryptMessage, encryptMessage} = require("./crypto/crypto");
const keyPath = path.join(app.getPath('userData'), 'rsa_keypair.json');

//////////////////
// Global variables
//////////////////
let mainWindow, subscriberWindow;
let tray = null;
let killRequest = false;  // Informs the close override to let the app close or not

const store = new Store({
    defaults: {
        bouncerAddress: "http://cryptseek.wycre.net:9090/upload",
        gatewayAddress: "tcp://cryptseek.wycre.net:5555",
    }
});

let keyPair = {};
const keys = {};

//////////////////
// IPC event message handlers
//////////////////

// Relays messages from the subscriber to the main window
async function handleMessageReceived(event, message) {
    console.log("Raw incoming message:", message);

    const path = app.getPath("userData");

    // Ensure data folder exists
    if (!fs.existsSync(`${path}/data`)) {
        fs.mkdirSync(`${path}/data`);
    }

    let msgObj;
    try {
        msgObj = JSON.parse(message);
    } catch (err) {
        console.error("Invalid message JSON:", err);
        return;
    }

    // Regular encrypted message
    const { payload, identifier } = msgObj;
    let parsed;

    if (!identifier || !payload) {
        console.warn("Missing identifier or payload. Skipping.");
        return;
    }

    // Check if identifier matches RSA ident
    console.log(identifier);
    console.log(keyPair["ident"])
    if (identifier === keyPair["ident"]) {
        console.log("Handling new Friend Request")
        let decrypted;
        try {
            decrypted = crypt.decryptWithRSA(payload, keyPair["privateKey"]);
        } catch (err) {
            console.error("Decryption failed:", err);
            return;
        }

        try {
            parsed = JSON.parse(decrypted);
        } catch (err) {
            console.error("Decrypted message is not valid JSON:", err);
            return;
        }

        const newKey = parsed["key"];
        console.log(newKey);

        const friendFolder = `${path}/data/${parsed["sender"]}`;
        if (!fs.existsSync(friendFolder)) {
            fs.mkdirSync(friendFolder);
        }

        const keyFile = `${app.getPath("userData")}/data/${parsed["sender"]}/key`;
        fs.writeFileSync(keyFile, newKey);

        // Set request status
        const statusFile = `${app.getPath("userData")}/data/${parsed["sender"]}/status`;
        fs.writeFileSync(statusFile, "pending");

        const keyBuffer = Buffer.from(newKey, 'base64');

        let ident = generateKeyIdentifier(keyBuffer, store.get('username'));
        keys[ident] = keyBuffer;

        ident = generateKeyIdentifier(keyBuffer, parsed["sender"]).toString();
        keys[ident] = keyBuffer;

        console.log(keys);

    }

    // AES encrypted messages
    else {
        const key = keys[identifier];

        if (!key) {
            console.warn("No key found for identifier:", identifier);
            return;
        }

        let decrypted;
        try {
            decrypted = crypt.decryptMessage(payload, key);
        } catch (err) {
            console.error("Decryption failed:", err);
            return;
        }

        try {
            parsed = JSON.parse(decrypted);
        } catch (err) {
            console.error("Decrypted message is not valid JSON:", err);
            return;
        }
    }


    let messageRel;
    if (parsed.sender === store.get('username')) {
        messageRel = parsed.recipient;
    } else {
        messageRel = parsed.sender;
    }

    const friendFolder = `${path}/data/${messageRel}`;
    if (!fs.existsSync(friendFolder)) {
        fs.mkdirSync(friendFolder);
    }

    // Check Friend Status
    let friendStatus;
    const statusFile = `${app.getPath("userData")}/data/${messageRel}/status`;
    try {
        friendStatus = fs.readFileSync(statusFile).toString('utf8');
    } catch (err) {
        friendStatus = 'unknown';
    }


    // Write Accept message if Friend
    if (friendStatus === "accepted" || friendStatus === "pending" || messageRel === store.get('username')) {
        console.log(messageRel);
        fs.appendFile(`${path}/data/${messageRel}/messages.jsonl`, `${JSON.stringify(parsed)}\n`, (err) => {
            if (err) {
                console.log('error', err);
            }
        });

        // Forward decrypted message
        mainWindow.webContents.send('message-received', parsed);

        if (friendStatus === "pending") {
            fs.writeFileSync(statusFile, 'pending1');
        }
    }
    else if (friendStatus === "pending1") {
        parsed["message"] = "Blocked message from unconfirmed friend";
        mainWindow.webContents.send('message-received', parsed);
    }
    else if (friendStatus === "blocked") {
        console.log("Blocked message from " + messageRel)
    }
}

async function handleSendMessage(event, messageObject) {
    console.log("Sending Message", messageObject);
    let recipient = messageObject.recipient;
    const keyFile = `${app.getPath("userData")}/data/${recipient}/key`;

    if (!fs.existsSync(keyFile)) {
        console.warn("Tried to send message but no AES key exists for:", recipient);
    }

    if (fs.existsSync(keyFile)) {
        let key = Buffer.from(fs.readFileSync(keyFile).toString(), 'base64');
        let encrypted = crypt.encryptMessage(JSON.stringify(messageObject), key);
        console.log(encrypted);
        let identifier = crypt.generateKeyIdentifier(key, recipient)

        let envelope = {
            identifier: identifier,
            payload: encrypted
        }

        await fetch(store.get('bouncerAddress'), {
            method: 'POST',
            body: JSON.stringify(envelope),
        })
    }
}

// Restarts the subscriber window (to accept new settings)
function restartSubscriber() {
    subscriberWindow.webContents.reload();
    setTimeout(() => subscriberWindow.webContents.reload(), 250);

    // Reload AES keys
    const dataPath = app.getPath("userData");
    const friends = fs.readdirSync(`${dataPath}/data`);
    for (const friend of friends) {
        const filePath = `${dataPath}/data/${friend}/key`;
        if (fs.existsSync(filePath)) {
            const key = Buffer.from(fs.readFileSync(filePath).toString(), 'base64');
            const ident1 = generateKeyIdentifier(key, friend);
            const ident2 = generateKeyIdentifier(key, store.get('username'));
            keys[ident1] = key;
            keys[ident2] = key;
        }
    }
}

// Tells the data path to the main window
function getPath(event) {
    mainWindow.webContents.send('path-relay', {data: app.getPath("userData")});
}


function getRSAKeyPair() {
    const pair = crypt.loadRSAKeyPair(keyPath);
    pair["publicKey"] = Buffer.from(pair["publicKey"]);
    pair["privateKey"] = Buffer.from(pair["privateKey"]);
    return pair;
}

//////////////////
// Start app
//////////////////
app.whenReady().then(() => {
    Store.initRenderer();

    const dataPath = app.getPath("userData");
    console.log(dataPath);

    // Get asym key first
    keyPair = getRSAKeyPair();
    keyPair["ident"] = crypt.generateKeyIdentifier(keyPair["publicKey"], store.get('username'));


    if (fs.existsSync(`${dataPath}/data`)) {
        let friends = fs.readdirSync(`${dataPath}/data`);
        friends.forEach(friend => {
           const filePath = `${dataPath}/data/${friend}/key`;
           if (fs.existsSync(filePath)) {
               let key = Buffer.from(fs.readFileSync(filePath).toString(), 'base64');
               let ident = generateKeyIdentifier(key, store.get('username'));
               keys[ident] = key;

               ident = generateKeyIdentifier(key, friend).toString();
               keys[ident] = key;
           }
        });
    }

    console.log(keyPair);
    console.log(keys)

    // Initialize system tray
    tray = new Tray('tray-logo.png');
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open CryptSeek', type: 'normal', click: () => {
                if (!mainWindow.visible) { mainWindow.show(); }
            }},
        { label: 'Options', type: 'separator' },
        { label: 'Stop CryptSeek', type: 'normal', click: () => {
                subscriberWindow.close();
                if (!mainWindow?.isDestroyed() && mainWindow?.isFocusable()) {
                    killRequest = true;  // Inform the close override to let the app close
                    mainWindow.close();
                }
            }
        },
    ]);
    tray.setToolTip('CryptSeek');
    tray.setContextMenu(contextMenu);
    tray.on('click', (event) => {
        if (!mainWindow.visible) { mainWindow.show(); }
    });




    // Register event listener for message reception
    ipcMain.on('message-received', handleMessageReceived);
    ipcMain.on('send-message', handleSendMessage);
    ipcMain.on('settings-saved', restartSubscriber);
    ipcMain.on('get-path', getPath);


    ipcMain.on('send-asym-message', async (event, messageObject, recipientPubKey) => {
        console.log("Sending Message", messageObject);
        let recipient = messageObject.recipient;

        if (recipientPubKey) {
            let encrypted = crypt.encryptWithRSA(JSON.stringify(messageObject), recipientPubKey);
            console.log("Sending Encrypted Friend Request:", encrypted);
            let identifier = crypt.generateKeyIdentifier(Buffer.from(recipientPubKey), recipient);

            let envelope = {
                identifier: identifier,
                payload: encrypted
            }

            await fetch(store.get('bouncerAddress'), {
                method: 'POST',
                body: JSON.stringify(envelope),
            })
        }
    });


    ipcMain.handle('get-path-sync', () => {
        return app.getPath("userData");
    });


    ipcMain.handle('store-aes-key', (event, key, friendName) => {
        console.log("Storing key for", friendName);
        console.log(key);

        const keyBuffer = Buffer.from(key, 'base64');

        let ident = generateKeyIdentifier(keyBuffer, store.get('username'));
        keys[ident] = keyBuffer;

        ident = generateKeyIdentifier(keyBuffer, friendName).toString();
        keys[ident] = keyBuffer;

        console.log(keys)
    });


    // Encrypt a message with AES key (returns Base64 string)
    ipcMain.handle('encrypt-message', async (event, { message, key }) => {
        try {
            const keyBuffer = Buffer.from(key, 'base64');
            const encrypted = crypt.encryptMessage(message, keyBuffer); // returns Base64
            return encrypted;
        } catch (err) {
            console.error("Encryption failed:", err);
            return null;
        }
    });

    // Get my encoded friend token for sharing
    ipcMain.handle('get-public-key-token', async (event, { username }) => {
    const { publicKey } = crypt.loadRSAKeyPair(keyPath);
        const tokenObj = {
            username,
            pubkey: publicKey
        };
        const tokenString = JSON.stringify(tokenObj);
        return Buffer.from(tokenString).toString('base64');
    });

    // Reset and regenerate RSA key pair
    ipcMain.handle('reset-rsa-keypair', async () => {
        if (fs.existsSync(keyPath)) {
            fs.unlinkSync(keyPath);
        }

        // Generate and persist new key pair
        const newKeyPair = crypt.generateRSAKeyPair(keyPath);

        // Update the global keyPair object in memory
        keyPair = {
            ...newKeyPair,
            ident: crypt.generateKeyIdentifier(Buffer.from(newKeyPair.publicKey), store.get('username'))
        };

        console.log("RSA keypair regenerated:", keyPair);
        return keyPair.publicKey.toString('base64');
    });


    // Create subscriber window
    subscriberWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    //subscriberWindow.webContents.openDevTools();
    subscriberWindow.loadFile("subscriber.html");


    // This is the main viewport for the app
    mainWindow = new BrowserWindow({
        // window dimensions and settings
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Override closing
    mainWindow.on('close', (event) => {
        if (!killRequest) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.setMenu(null);
    mainWindow.webContents.openDevTools();
    mainWindow.loadFile("client-pages/index.html");
});
