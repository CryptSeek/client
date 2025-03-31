// requires the electron module
const { app, BrowserWindow, ipcMain } = require("electron");

const Store = require("electron-store");

let mainWindow, subscriberWindow;

function handleMessageReceived(event, message) {
    mainWindow.webContents.send('message-received', {data: message});
}

function restartSubscriber(event, data) {
    subscriberWindow.webContents.reload();

    // I don't know why it has to be this way,
    // It really shouldn't be this way
    // So why on gods green earth am I required to do this horribleness?!?!?!?  - wycre
    setTimeout( () => {subscriberWindow.webContents.reload();}, 250); // 100 works on my machine

}

// The index will request the data path sometimes
function getPath(event) {
    mainWindow.webContents.send('path-relay', {data: app.getPath("userData")});
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
    ipcMain.on('get-path', getPath);

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
