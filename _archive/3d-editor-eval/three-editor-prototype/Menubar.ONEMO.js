import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { unzipSync, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { AddObjectCommand } from './commands/AddObjectCommand.js';

// ONEMO Studio v2 — native .onemo authoring on the three.js editor.
// Ports the onemo-next domain layer (material roles, artwork-on-print-surface,
// env/camera/render from studio.json) so the editor loads our golden scene
// fully set up, no scripting.

// studio.json env presets -> local HDR (mirrors onemo-next EffectViewer)
const LOCAL_ENV_PRESETS = { studio: '/assets/env/studio_small_03_1k.hdr' };

function MenubarONEMO( editor ) {

	const container = new UIPanel();
	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( 'ONEMO' );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	// Open Golden Scene

	let option = new UIRow().addClass( 'option' ).setTextContent( 'Open Golden Scene' );
	option.onClick( function () {

		loadOnemoFromUrl( '/assets/templates/effect-70mm.onemo' );

	} );
	options.add( option );

	// Open .onemo…

	const fileInput = document.createElement( 'input' );
	fileInput.type = 'file';
	fileInput.accept = '.onemo';
	fileInput.style.display = 'none';
	fileInput.addEventListener( 'change', async function () {

		const file = fileInput.files[ 0 ];
		if ( file === undefined ) return;
		loadOnemoBuffer( await file.arrayBuffer() );
		fileInput.value = '';

	} );
	document.body.appendChild( fileInput );

	option = new UIRow().addClass( 'option' ).setTextContent( 'Open .onemo…' );
	option.onClick( function () {

		fileInput.click();

	} );
	options.add( option );

	options.add( new UIHorizontalRule() );

	// Save .onemo (P2 — placeholder)

	option = new UIRow().addClass( 'option' ).setTextContent( 'Save .onemo  (P2)' );
	option.onClick( function () {

		alert( 'Save .onemo — coming in P2 (GLTFExporter scene.glb + studio.json -> zip).' );

	} );
	options.add( option );

	// ───────── loaders ─────────

	async function loadOnemoFromUrl( url ) {

		try {

			const res = await fetch( url );
			if ( ! res.ok ) throw new Error( 'HTTP ' + res.status );
			loadOnemoBuffer( await res.arrayBuffer() );

		} catch ( e ) {

			console.error( '[ONEMO] load failed', e );
			alert( 'Failed to load .onemo: ' + e.message );

		}

	}

	function loadOnemoBuffer( arrayBuffer ) {

		const files = unzipSync( new Uint8Array( arrayBuffer ) );
		const glb = files[ 'scene.glb' ];
		if ( glb === undefined ) { alert( 'Invalid .onemo: missing scene.glb' ); return; }

		let studioJson = {};
		if ( files[ 'studio.json' ] ) {

			try { studioJson = JSON.parse( strFromU8( files[ 'studio.json' ] ) ); } catch ( e ) { console.warn( '[ONEMO] bad studio.json', e ); }

		}

		// support compressed .onemo (Draco / meshopt) as well as uncompressed
		const loader = new GLTFLoader();
		loader.setDRACOLoader( new DRACOLoader().setDecoderPath( '../examples/jsm/libs/draco/gltf/' ) );
		loader.setMeshoptDecoder( MeshoptDecoder );

		const glbBuffer = glb.buffer.slice( glb.byteOffset, glb.byteOffset + glb.byteLength );
		loader.parse( glbBuffer, '', function ( gltf ) {

			applyOnemo( gltf.scene, studioJson );

		}, function ( err ) { console.error( '[ONEMO] glb parse error', err ); } );

	}

	// ───────── domain layer (ported from onemo-next EffectModel / onemo-loader) ─────────

	function loadTexture( url, srgb, repeat ) {

		if ( ! url ) return null;
		const t = new THREE.TextureLoader().load( url );
		t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
		t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
		return t;

	}

	function matchesMeshName( meshName, patterns ) {

		const n = ( meshName || '' ).trim().toLowerCase();
		return ( patterns || [] ).some( function ( p ) {

			const pp = ( p || '' ).trim().toLowerCase();
			if ( ! pp ) return false;
			if ( pp.indexOf( '*' ) !== - 1 ) {

				const rx = new RegExp( '^' + pp.split( '*' ).map( s => s.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ).join( '.*' ) + '$' );
				return rx.test( n );

			}
			return n === pp;

		} );

	}

	function forcePlanarUv( geometry ) {

		const pos = geometry.getAttribute( 'position' );
		const n = pos.count;
		let xmin = Infinity, xmax = - Infinity, ymin = Infinity, ymax = - Infinity;
		for ( let i = 0; i < n; i ++ ) {

			const x = pos.getX( i ), y = pos.getY( i );
			if ( x < xmin ) xmin = x; if ( x > xmax ) xmax = x;
			if ( y < ymin ) ymin = y; if ( y > ymax ) ymax = y;

		}
		const xr = ( xmax - xmin ) || 1, yr = ( ymax - ymin ) || 1;
		const uv = new Float32Array( n * 2 );
		for ( let i = 0; i < n; i ++ ) {

			uv[ i * 2 ] = ( pos.getX( i ) - xmin ) / xr;
			uv[ i * 2 + 1 ] = ( pos.getY( i ) - ymin ) / yr;

		}
		geometry.deleteAttribute( 'uv' );
		geometry.setAttribute( 'uv', new THREE.BufferAttribute( uv, 2 ) );

	}

	function createRoleMaterial( role, artworkMap ) {

		const d = role.defaults || {}, t = role.textures || {};
		const usesArtwork = !! artworkMap;
		return new THREE.MeshPhysicalMaterial( {
			map: usesArtwork ? artworkMap : loadTexture( t.map, true, true ),
			color: new THREE.Color( usesArtwork ? '#ffffff' : ( d.color || '#ffffff' ) ),
			normalMap: loadTexture( t.normalMap, false, true ),
			normalScale: new THREE.Vector2( d.normalScale ?? 1, d.normalScale ?? 1 ),
			bumpMap: loadTexture( t.bumpMap, false, true ),
			bumpScale: d.bumpScale ?? 1,
			roughnessMap: loadTexture( t.roughnessMap, false, true ),
			roughness: d.roughness ?? 1,
			metalness: d.metalness ?? 0,
			sheen: d.sheen ?? 0,
			sheenColor: new THREE.Color( d.sheenColor ?? '#000000' ),
			sheenRoughness: d.sheenRoughness ?? 1,
			envMapIntensity: d.envMapIntensity ?? 1,
			clearcoat: d.clearcoat ?? 0,
			clearcoatRoughness: d.clearcoatRoughness ?? 0,
			side: THREE.DoubleSide
		} );

	}

	function forceSolidRenderMode() {

		const sel = Array.from( document.querySelectorAll( 'select' ) )
			.find( s => Array.from( s.options ).some( o => /SOLID/i.test( o.textContent || o.value ) ) );
		if ( ! sel ) return;
		const solid = Array.from( sel.options ).find( o => /SOLID/i.test( o.textContent || o.value ) );
		if ( solid && sel.value !== solid.value ) { sel.value = solid.value; sel.dispatchEvent( new Event( 'change', { bubbles: true } ) ); }

	}

	function applyOnemo( root, studioJson ) {

		const product = studioJson.product || {};
		const roles = product.materialRoles || [];
		const artworkSlot = product.artworkSlot;

		// artwork texture (default placement: offset 0 / scale 1)
		let artworkMap = null;
		if ( artworkSlot && artworkSlot.defaultUrl ) {

			artworkMap = loadTexture( artworkSlot.defaultUrl, true, true );
			artworkMap.repeat.set( 1, 1 );
			artworkMap.offset.set( 0, 0 );

		}

		// apply role materials + artwork planar UV
		root.traverse( function ( o ) {

			if ( ! o.isMesh ) return;
			if ( ( o.name || '' ).toUpperCase() === 'NEW LIGHTS' ) { o.visible = false; return; }

			const role = roles.find( r => matchesMeshName( o.name, r.meshNames ) );
			if ( ! role ) return;

			const isArtworkRole = artworkSlot && artworkSlot.role === role.role && matchesMeshName( o.name, [ artworkSlot.meshName ] );
			if ( isArtworkRole ) forcePlanarUv( o.geometry );
			o.material = createRoleMaterial( role, isArtworkRole ? artworkMap : null );

		} );

		// scene background + ambient
		const sc = studioJson.scene || {};
		if ( sc.backgroundColor ) editor.scene.background = new THREE.Color( sc.backgroundColor );
		const amb = new THREE.AmbientLight( 0xffffff, sc.ambientIntensity ?? 0.5 );
		amb.name = 'ONEMO Ambient';
		root.add( amb );

		// add the scene group (with undo support)
		root.name = root.name || 'ONEMO Golden Scene';
		editor.execute( new AddObjectCommand( editor, root ) );

		// environment — raw equirect HDR (pathtracer-safe), intensity from studio.json
		const env = studioJson.environment || {};
		const envUrl = env.file || LOCAL_ENV_PRESETS[ env.preset ] || LOCAL_ENV_PRESETS.studio;
		if ( envUrl ) {

			new RGBELoader().load( envUrl, function ( hdr ) {

				hdr.mapping = THREE.EquirectangularReflectionMapping;
				editor.scene.environment = hdr;
				if ( 'environmentIntensity' in editor.scene ) editor.scene.environmentIntensity = env.intensity ?? 1;
				editor.signals.sceneGraphChanged.dispatch();

			} );

		}

		// renderer — Neutral tonemapping @ studio.json exposure
		const r = studioJson.renderer || {};
		editor.config.setKey( 'project/renderer/toneMapping', r.toneMapping ?? THREE.NeutralToneMapping );
		editor.config.setKey( 'project/renderer/toneMappingExposure', r.toneMappingExposure ?? 0.7 );
		editor.config.setKey( 'project/renderer/shadows', r.shadowsEnabled ?? true );
		editor.signals.rendererUpdated.dispatch();
		forceSolidRenderMode();

		// frame it
		editor.select( root );
		editor.signals.objectFocused.dispatch( root );

		console.log( '[ONEMO] loaded golden scene — roles:', roles.map( x => x.role ).join( ', ' ), '| artwork:', !! artworkMap );

	}

	// Testing hook — load any served .onemo by URL from the console.
	window.ONEMO_load = loadOnemoFromUrl;

	return container;

}

export { MenubarONEMO };
