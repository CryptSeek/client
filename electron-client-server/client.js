// requires the electron module
const { app, BrowserWindow, ipcMain } = require("electron");
const axios = require("axios");

let mainWindow;

// client server window
app.whenReady().then(() => {
    // load the window
    mainWindow = new BrowserWindow({
        // window dimensions and settings
        width: 600,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // which html file to load
    mainWindow.loadFile("index.html");
});

// gets the message and communicates with server
ipcMain.handle("send-message", async (event, message) => {
    try {
        // post to the sever and await reply
        const response = await axios.post("http://localhost:3000/message", { message });
        return response.data.reply;
    } catch (error) {
        // did not communicate with server
        console.error("Error:", error);
        return "Failed to communicate with server";
    }
});
