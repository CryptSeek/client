// requires the electron module
const { app, BrowserWindow, ipcMain } = require("electron");

let mainWindow, subscriberWindow;

function handleMessageReceived(event, message) {
    mainWindow.webContents.send('message-received', {data: message});
}

// Start app
app.whenReady().then(() => {
    // Register event listener for message reception
    ipcMain.on('message-received', handleMessageReceived)

    // Create subscriber window
    subscriberWindow = new BrowserWindow({
        show: false,
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
    mainWindow.loadFile("index.html");
});
