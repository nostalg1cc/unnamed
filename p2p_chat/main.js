const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false // Recommended for security, use preload.js for Node APIs
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools - useful for development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // On macOS, applications and their menu bar stay active until the user quits
  // explicitly with Cmd + Q. On other platforms, quit directly.
  if (process.platform !== 'darwin') app.quit();
});

// Example IPC: If we needed to call Python for ID generation (Option B from plan)
// const { execFile } = require('child_process');
// ipcMain.handle('generate-id-python', async () => {
//   return new Promise((resolve, reject) => {
//     // Ensure python3 is in PATH or provide full path
//     // Ensure identity.py is in the correct relative path from main.js
//     execFile('python3', [path.join(__dirname, 'src/identity_for_electron.py'), 'generate'], (error, stdout, stderr) => {
//       if (error) {
//         console.error(`Python script error: ${stderr}`);
//         return reject(error);
//       }
//       resolve(stdout.trim());
//     });
//   });
// });
