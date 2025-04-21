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

const store = new Store({
    defaults: {
        bouncerAddress: "http://cryptseek.wycre.net:9090/upload",
        gatewayAddress: "tcp://cryptseek.wycre.net:5555",
    }
});

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

    // Skip decryption for key exchange messages
    if (msgObj.type === 'aes-key') {
        console.log("Received AES key message from:", msgObj.from);

        const messageRel = msgObj.from || "unknown";
        const friendFolder = `${path}/data/${messageRel}`;

        if (!fs.existsSync(friendFolder)) {
            fs.mkdirSync(friendFolder);
        }

        fs.appendFile(`${friendFolder}/messages.jsonl`, `${message}\n`, (err) => {
            if (err) console.error('Error writing aes-key message:', err);
        });

        // Forward to renderer so it can handle it in index.html
        mainWindow.webContents.send('message-received', { data: message });
        return;
    }

    // Regular encrypted message
    const { payload, identifier } = msgObj;

    if (!identifier || !payload) {
        console.warn("Missing identifier or payload. Skipping.");
        return;
    }

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

    let parsed;
    try {
        parsed = JSON.parse(decrypted);
    } catch (err) {
        console.error("Decrypted message is not valid JSON:", err);
        return;
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

    fs.appendFile(`${friendFolder}/messages.jsonl`, `${message}\n`, (err) => {
        if (err) {
            console.error("Failed to write message:", err);
        }
    });

    // Forward decrypted message
    mainWindow.webContents.send('message-received', { data: message });
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

//////////////////
// Start app
//////////////////
app.whenReady().then(() => {
    Store.initRenderer();

    const dataPath = app.getPath("userData");
    console.log(dataPath);

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

    console.log(keys)



    // Initialize system tray
    tray = new Tray('tray-logo.png');
    const contextMenu = Menu.buildFromTemplate([
        { label: 'CryptSeek is running' },
        { label: 'Options', type: 'separator' },
        { label: 'Stop CryptSeek', type: 'normal', click: () => {
                subscriberWindow.close();
                if (!mainWindow?.isDestroyed() && mainWindow?.isFocusable()) { mainWindow.close(); }
            }
        },
    ]);
    tray.setToolTip('CryptSeek');
    tray.setContextMenu(contextMenu);




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
            let identifier = crypt.generateKeyIdentifier(recipientPubKey, recipient)

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

    // Decrypt a message with AES key (input: Base64, output: UTF-8 string)
    ipcMain.handle('decrypt-message', async (event, { encrypted, key }) => {
        if (!key) {
            console.error("decrypt-message called with undefined key");
            return null;
        }

        try {
            const keyBuffer = Buffer.from(key, 'base64');
            const decrypted = crypt.decryptMessage(encrypted, keyBuffer);
            return decrypted;
        } catch (err) {
            console.error("Decryption failed:", err);
            return null;
        }
    });

    // Store key and return identifier + nonce
    ipcMain.handle('store-key', async (event, { key, sender }) => {
        const keyBuffer = Buffer.from(key, 'base64');
        const { identifier } = crypt.storeKey(keyBuffer, sender);
        return { identifier };
    });

    ipcMain.handle('find-key', async (event, { identifier, sender }) => {
        const foundKey = crypt.findKey(identifier, sender);
        return foundKey ? foundKey.toString('base64') : null;
    });

    // Get my RSA public key
    ipcMain.handle('get-public-key', async () => {
        const { publicKey } = crypt.loadRSAKeyPair(keyPath);
        return publicKey;
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

    // Encrypt AES key with friend's public RSA key
    ipcMain.handle('encrypt-aes-key', async (event, { aesKeyBase64, friendPublicKey }) => {
        const aesKey = Buffer.from(aesKeyBase64, 'base64');
        return crypt.encryptAESKeyWithRSA(friendPublicKey, aesKey);
    });

    // Decrypt AES key with my private RSA key
    ipcMain.handle('decrypt-aes-key', async (event, { encryptedKey, sender }) => {
        const { privateKey } = crypt.loadRSAKeyPair(keyPath);
        const keyBuffer = crypt.decryptAESKeyWithRSA(encryptedKey, privateKey);

        // Store in runtime key dictionary
        const ident1 = generateKeyIdentifier(keyBuffer, sender);
        const ident2 = generateKeyIdentifier(keyBuffer, store.get('username'));
        keys[ident1] = keyBuffer;
        keys[ident2] = keyBuffer;

        return keyBuffer.toString('base64');
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
    mainWindow.setMenu(null);
    mainWindow.webContents.openDevTools();
    mainWindow.loadFile("client-pages/index.html");
});
