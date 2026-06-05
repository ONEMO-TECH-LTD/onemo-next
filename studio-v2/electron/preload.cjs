const { contextBridge, ipcRenderer } = require( 'electron' );

function toArrayBuffer( data ) {

	if ( data instanceof ArrayBuffer ) return data;
	if ( ArrayBuffer.isView( data ) ) {

		return data.buffer.slice( data.byteOffset, data.byteOffset + data.byteLength );

	}
	return new Uint8Array( data ).buffer;

}

contextBridge.exposeInMainWorld( 'ONEMO_DESKTOP', {
	openOnemoFile: async function () {

		const file = await ipcRenderer.invoke( 'onemo:open-file' );
		if ( file === null ) return null;

		return {
			name: file.name,
			path: file.path,
			data: toArrayBuffer( file.data )
		};

	},
	saveOnemoFile: async function ( payload ) {

		return ipcRenderer.invoke( 'onemo:save-file', {
			name: payload?.name,
			data: toArrayBuffer( payload?.data || new ArrayBuffer( 0 ) )
		} );

	}
} );
