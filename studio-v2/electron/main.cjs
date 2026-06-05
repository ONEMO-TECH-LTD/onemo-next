const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol } = require( 'electron' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { pathToFileURL } = require( 'node:url' );

protocol.registerSchemesAsPrivileged( [
	{
		scheme: 'onemo-studio',
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true
		}
	}
] );

const APP_ROOT = path.resolve( __dirname, '..' );
const DIST_ROOT = path.join( APP_ROOT, 'dist' );
const BUNDLED_ASSETS_ROOT = app.isPackaged ? path.join( process.resourcesPath, 'assets' ) : path.join( DIST_ROOT, 'assets' );
const EXTERNAL_ASSETS_ROOT = process.env.ONEMO_STUDIO_ASSETS_DIR || process.env.ONEMO_ASSETS_DIR || '';

app.setName( 'Studio' );

function safeJoin( root, relativePath ) {

	const resolved = path.normalize( path.join( root, relativePath ) );
	if ( resolved !== root && ! resolved.startsWith( root + path.sep ) ) return null;
	return resolved;

}

function findAssetRoot() {

	if ( EXTERNAL_ASSETS_ROOT && fs.existsSync( EXTERNAL_ASSETS_ROOT ) ) return EXTERNAL_ASSETS_ROOT;
	if ( fs.existsSync( BUNDLED_ASSETS_ROOT ) ) return BUNDLED_ASSETS_ROOT;
	return path.join( APP_ROOT, '..', 'public', 'assets' );

}

function resolveStudioFile( requestUrl ) {

	const url = new URL( requestUrl );
	const pathname = decodeURIComponent( url.pathname === '/' ? '/index.html' : url.pathname );

	if ( pathname.startsWith( '/assets/' ) ) {

		return safeJoin( findAssetRoot(), pathname.slice( '/assets/'.length ) );

	}

	return safeJoin( DIST_ROOT, pathname.slice( 1 ) );

}

function registerStudioProtocol() {

	protocol.handle( 'onemo-studio', function ( request ) {

		const filePath = resolveStudioFile( request.url );
		if ( filePath === null || ! fs.existsSync( filePath ) ) {

			return new Response( 'Not found', { status: 404 } );

		}

		return net.fetch( pathToFileURL( filePath ).toString() );

	} );

}

function createWindow() {

	const iconPath = path.join( APP_ROOT, 'build', 'icon.png' );
	const win = new BrowserWindow( {
		width: 1440,
		height: 980,
		minWidth: 1100,
		minHeight: 760,
		show: false,
		frame: false,
		title: 'ONEMO Studio',
		backgroundColor: '#f5f3ee',
		icon: iconPath,
		webPreferences: {
			preload: path.join( __dirname, 'preload.cjs' ),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		}
	} );

	if ( process.platform === 'darwin' && app.dock ) {

		app.dock.setIcon( nativeImage.createFromPath( iconPath ) );

	}

	win.once( 'ready-to-show', function () {

		win.show();

	} );

	win.loadURL( 'onemo-studio://app/index.html' );
	return win;

}

ipcMain.handle( 'onemo:open-file', async function () {

	const result = await dialog.showOpenDialog( {
		title: 'Open ONEMO scene',
		properties: [ 'openFile' ],
		filters: [
			{ name: 'ONEMO scenes', extensions: [ 'onemo' ] }
		]
	} );

	if ( result.canceled || result.filePaths.length === 0 ) return null;

	const filePath = result.filePaths[ 0 ];
	const data = await fs.promises.readFile( filePath );
	return {
		name: path.basename( filePath ),
		path: filePath,
		data
	};

} );

ipcMain.handle( 'onemo:save-file', async function ( _event, payload ) {

	const result = await dialog.showSaveDialog( {
		title: 'Save ONEMO scene',
		defaultPath: payload?.name || 'scene.onemo',
		filters: [
			{ name: 'ONEMO scenes', extensions: [ 'onemo' ] }
		]
	} );

	if ( result.canceled || ! result.filePath ) return null;

	await fs.promises.writeFile( result.filePath, Buffer.from( payload.data ) );
	return {
		path: result.filePath
	};

} );

app.whenReady().then( function () {

	Menu.setApplicationMenu( null );
	registerStudioProtocol();
	createWindow();

	app.on( 'activate', function () {

		if ( BrowserWindow.getAllWindows().length === 0 ) createWindow();

	} );

} );

app.on( 'window-all-closed', function () {

	if ( process.platform !== 'darwin' ) app.quit();

} );
