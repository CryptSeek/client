// requires the electron module
const { app, BrowserWindow, ipcMain } = require("electron");

const Store = require("electron-store");

let mainWindow, subscriberWindow;

function handleMessageReceived(event, message) {
    mainWindow.webContents.send('message-received', {data: message});
}

function restartSubscriber(event, data) {
    subscriberWindow.webContents.reloadIgnoringCache();
}

// Start app
app.whenReady().then(() => {
    Store.initRenderer();

    const store = new Store({
        defaults: {
            bouncerAddress: "http://cryptseek.wycre.net:9090/upload",
            gatewayAddress: "tcp://cryptseek.wycre.net:5555",
        }
    });

    console.log(app.getPath('userData'));

    // Register event listener for message reception
    ipcMain.on('message-received', handleMessageReceived)
    ipcMain.on('settings-saved', restartSubscriber);

    // Create subscriber window
    subscriberWindow = new BrowserWindow({
        show: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    subscriberWindow.webContents.openDevTools();
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
    mainWindow.loadFile("client-pages/index.html");
});
