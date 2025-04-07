const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const Store = require("electron-store");
const fs = require('fs');

//////////////////
// Global variables
//////////////////
let mainWindow, subscriberWindow;
let tray = null;

//////////////////
// IPC event message handlers
//////////////////

// Relays messages from the subscriber to the main window
function handleMessageReceived(event, message) {
    console.log(message);
    // Write message to data file
    fs.appendFile(`${app.getPath("userData")}/messages.jsonl`, `${message}\n`, (err) => {
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

    const store = new Store({
        defaults: {
            bouncerAddress: "http://cryptseek.wycre.net:9090/upload",
            gatewayAddress: "tcp://cryptseek.wycre.net:5555",
        }
    });

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
