const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const crypt = require('./crypto/crypto.js');
const Store = require("electron-store");
const fs = require('fs');

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

//////////////////
// IPC event message handlers
//////////////////

// Relays messages from the subscriber to the main window
function handleMessageReceived(event, message) {
    console.log(message);

    let path = app.getPath("userData");

    // Ensure data folder exists
    if (!fs.existsSync(`${path}/data`)) {
        fs.mkdirSync(`${path}/data`);
    }

    let msgObj = JSON.parse(message);

    // Ensure friend folder exists
    let messageRel;
    if (msgObj['sender'] === store.get('username')) {
        messageRel = msgObj['recipient'];
    }
    else {
        messageRel = msgObj['sender'];
    }
    if (!fs.existsSync(`${path}/data/${messageRel}`)) {
        fs.mkdirSync(`${path}/data/${messageRel}`);
    }

    // Write message to data file
    console.log(messageRel);
    fs.appendFile(`${path}/data/${messageRel}/messages.jsonl`, `${message}\n`, (err) => {
        if (err) {
            console.log('error', err);
        }
    });

    mainWindow.webContents.send('message-received', {data: message});
}

// Restarts the subscriber window (to accept new settings)
function restartSubscriber(event, data) {
    subscriberWindow.webContents.reload();

    // I don't know why it has to be this way,
    // It really shouldn't be this way
    // So why on gods green earth am I required to do this horribleness?!?!?!?  - wycre
    setTimeout( () => {subscriberWindow.webContents.reload();}, 250); // 100 works on my machine

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

    console.log(app.getPath('userData'));

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
    ipcMain.on('message-received', handleMessageReceived)
    ipcMain.on('settings-saved', restartSubscriber);
    ipcMain.on('get-path', getPath);
    // Encrypt a message with AES key
    ipcMain.handle('encrypt-message', async (event, { message, key }) => {
        const keyBuffer = Buffer.from(key, 'base64');
        const encrypted = crypt.encryptMessage(message, keyBuffer);
        return encrypted.toString('base64');
    });

    // Decrypt a message with AES key
    ipcMain.handle('decrypt-message', async (event, { encrypted, key }) => {
        const encryptedBuffer = Buffer.from(encrypted, 'base64');
        const keyBuffer = Buffer.from(key, 'base64');
        try {
            const decrypted = crypt.decryptMessage(encryptedBuffer, keyBuffer);
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

    // Find key using identifier and nonce
    ipcMain.handle('find-key', async (event, { identifier, nonce }) => {
        const nonceBuffer = Buffer.from(nonce, 'base64');
        const foundKey = crypt.findKey(identifier, nonceBuffer);
        return foundKey ? foundKey.toString('base64') : null;
    });

    // Get my RSA public key
    ipcMain.handle('get-public-key', async () => {
        const { publicKey } = crypt.loadRSAKeyPair();
        return publicKey;
    });

    // Encrypt AES key with friend's public RSA key
    ipcMain.handle('encrypt-aes-key', async (event, { aesKeyBase64, friendPublicKey }) => {
        const aesKey = Buffer.from(aesKeyBase64, 'base64');
        return crypt.encryptAESKeyWithRSA(friendPublicKey, aesKey);
    });

    // Decrypt AES key with my private RSA key
    ipcMain.handle('decrypt-aes-key', async (event, { encryptedKey }) => {
        const { privateKey } = crypt.loadRSAKeyPair();
        const keyBuffer = crypt.decryptAESKeyWithRSA(encryptedKey, privateKey);
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
