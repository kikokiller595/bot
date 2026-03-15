const { app, BrowserWindow } = require('electron');
const path = require('path');
// Detectar modo desarrollo: variable de entorno o si no existe build
const isDev = process.env.ELECTRON_IS_DEV === '1' || 
              process.env.NODE_ENV === 'development' ||
              !require('fs').existsSync(path.join(__dirname, '../build/index.html'));

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  const fs = require('fs');
  const icon = fs.existsSync(iconPath) ? iconPath : undefined;
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // No mostrar hasta que esté lista
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: icon,
    title: 'TBY Sistemas - Sistema de Lotería'
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  // Función para cargar la URL con reintentos
  const loadApp = () => {
    if (isDev) {
      // En desarrollo, intentar cargar con reintentos
      mainWindow.loadURL(startUrl).catch(() => {
        console.log('Esperando a que React esté listo...');
        setTimeout(() => {
          mainWindow.loadURL(startUrl).catch(() => {
            console.log('Reintentando conexión...');
            setTimeout(loadApp, 2000);
          });
        }, 2000);
      });
    } else {
      mainWindow.loadURL(startUrl);
    }
  };
  
  loadApp();

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // Mostrar la ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

