import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { unzipSync, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { AddObjectCommand } from './commands/AddObjectCommand.js';

const GOLDEN_TEMPLATES = [
	{ label: 'Open Golden v0', url: '/assets/templates/effect-70mm.onemo' },
	{ label: 'Open Golden v1 Draco', url: '/assets/templates/golden-effect-70mm/v1-draco-lossless.onemo' },
	{ label: 'Open Golden v2 Draco', url: '/assets/templates/golden-effect-70mm/v2-draco-decimated-smooth.onemo' }
];

const LOCAL_ENV_PRESETS = {
	studio: '/assets/env/studio_small_03_1k.hdr'
};

function MenubarONEMO( editor ) {

	const textureCache = new Map();

	const container = new UIPanel();
	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( 'ONEMO' );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	for ( const template of GOLDEN_TEMPLATES ) {

		options.add( createOption( template.label, function () {

			loadOnemoFromUrl( template.url );

		} ) );

	}

	options.add( new UIHorizontalRule() );

	const fileInput = document.createElement( 'input' );
	fileInput.type = 'file';
	fileInput.accept = '.onemo';
	fileInput.style.display = 'none';
	fileInput.addEventListener( 'change', async function () {

		const file = fileInput.files[ 0 ];
		if ( file === undefined ) return;

		await loadOnemoBuffer( await file.arrayBuffer(), file.name );
		fileInput.value = '';

	} );
	document.body.appendChild( fileInput );

	options.add( createOption( 'Open .onemo...', function () {

		if ( window.ONEMO_DESKTOP?.openOnemoFile ) {

			openDesktopOnemoFile();
			return;

		}

		fileInput.click();

	} ) );

	options.add( new UIHorizontalRule() );

	options.add( createOption( 'Save .onemo (P2)', function () {

		alert( 'Save .onemo is scheduled for P2: GLTFExporter scene.glb plus studio.json into a zip.' );

	} ) );

	function createOption( label, onClick ) {

		const option = new UIRow().addClass( 'option' ).setTextContent( label );
		option.onClick( onClick );
		return option;

	}

	async function loadOnemoFromUrl( url ) {

		try {

			const res = await fetch( url );
			if ( ! res.ok ) throw new Error( 'HTTP ' + res.status + ' ' + url );
			return await loadOnemoBuffer( await res.arrayBuffer(), url );

		} catch ( e ) {

			console.error( '[ONEMO] load failed', e );
			alert( 'Failed to load .onemo: ' + e.message );
			throw e;

		}

	}

	async function openDesktopOnemoFile() {

		try {

			const file = await window.ONEMO_DESKTOP.openOnemoFile();
			if ( file === null ) return;
			await loadOnemoBuffer( file.data, file.path || file.name );

		} catch ( e ) {

			console.error( '[ONEMO] desktop open failed', e );
			alert( 'Failed to open .onemo: ' + e.message );

		}

	}

	function loadOnemoBuffer( arrayBuffer, source = '.onemo' ) {

		return new Promise( function ( resolve, reject ) {

			let files;
			try {

				files = unzipSync( new Uint8Array( arrayBuffer ) );

			} catch ( e ) {

				rejectOnemoError( reject, 'Invalid .onemo zip', e );
				return;

			}

			const glb = files[ 'scene.glb' ];
			if ( glb === undefined ) {

				rejectOnemoError( reject, 'Invalid .onemo: missing scene.glb' );
				return;

			}

			let studioJson = {};
			if ( files[ 'studio.json' ] ) {

				try {

					studioJson = JSON.parse( strFromU8( files[ 'studio.json' ] ) );

				} catch ( e ) {

					console.warn( '[ONEMO] bad studio.json; loading geometry only', e );

				}

			}

			const loader = new GLTFLoader();
			const dracoLoader = new DRACOLoader();
			dracoLoader.setDecoderPath( '/vendor/three/examples/jsm/libs/draco/gltf/' );
			loader.setDRACOLoader( dracoLoader );
			loader.setMeshoptDecoder( MeshoptDecoder );

			const glbBuffer = glb.buffer.slice( glb.byteOffset, glb.byteOffset + glb.byteLength );
			loader.parse( glbBuffer, '', function ( gltf ) {

				try {

					const root = applyOnemo( gltf.scene, studioJson, source );
					resolve( root );

				} catch ( e ) {

					rejectOnemoError( reject, 'Failed to apply ONEMO scene', e );

				} finally {

					dracoLoader.dispose();

				}

			}, function ( err ) {

				dracoLoader.dispose();
				rejectOnemoError( reject, 'Failed to parse scene.glb', err );

			} );

		} );

	}

	function rejectOnemoError( reject, message, cause ) {

		const error = cause instanceof Error ? cause : new Error( message );
		if ( error.message === message && cause !== undefined ) error.cause = cause;
		if ( error.message !== message ) error.message = message + ': ' + error.message;
		console.error( '[ONEMO] ' + message, cause || error );
		alert( message );
		reject( error );

	}

	function resolveAssetUrl( url ) {

		if ( ! url ) return null;
		if ( /^(https?:|blob:|data:)/.test( url ) ) return url;
		if ( url.startsWith( '/' ) ) return url;
		return '/assets/' + url.replace( /^assets\//, '' );

	}

	function loadTexture( url, srgb, repeat ) {

		const resolvedUrl = resolveAssetUrl( url );
		if ( ! resolvedUrl ) return null;

		const cacheKey = resolvedUrl + '::' + ( srgb ? 'srgb' : 'data' ) + '::' + ( repeat ? 'repeat' : 'clamp' );
		const cached = textureCache.get( cacheKey );
		if ( cached ) return cached;

		const texture = new THREE.TextureLoader().load( resolvedUrl, function ( loaded ) {

			loaded.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
			loaded.wrapS = loaded.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
			loaded.needsUpdate = true;
			editor.signals.sceneGraphChanged.dispatch();

		} );
		texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
		texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
		textureCache.set( cacheKey, texture );
		return texture;

	}

	function matchesMeshName( meshName, patterns ) {

		const normalizedMeshName = ( meshName || '' ).trim().toLowerCase();
		return ( patterns || [] ).some( function ( pattern ) {

			const normalizedPattern = ( pattern || '' ).trim().toLowerCase();
			if ( ! normalizedPattern ) return false;
			if ( normalizedPattern.includes( '*' ) ) {

				const regex = new RegExp( '^' + normalizedPattern.split( '*' ).map( function ( part ) {

					return part.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

				} ).join( '.*' ) + '$' );
				return regex.test( normalizedMeshName );

			}
			return normalizedMeshName === normalizedPattern;

		} );

	}

	function ensureUvAttribute( geometry ) {

		const uv = geometry.getAttribute( 'uv' );
		const pos = geometry.getAttribute( 'position' );
		if ( ! pos ) return;
		if ( uv && uv.count === pos.count ) return;

		writePlanarUv( geometry, pos );

	}

	function normalizeUvRangeIfNeeded( geometry ) {

		const uv = geometry.getAttribute( 'uv' );
		if ( ! uv || uv.count === 0 ) return;

		let uMin = Infinity;
		let uMax = - Infinity;
		let vMin = Infinity;
		let vMax = - Infinity;

		for ( let i = 0; i < uv.count; i ++ ) {

			const u = uv.getX( i );
			const v = uv.getY( i );
			if ( u < uMin ) uMin = u;
			if ( u > uMax ) uMax = u;
			if ( v < vMin ) vMin = v;
			if ( v > vMax ) vMax = v;

		}

		if ( uMin >= 0 && uMax <= 1 && vMin >= 0 && vMax <= 1 ) return;

		const uRange = uMax - uMin || 1;
		const vRange = vMax - vMin || 1;
		const normalized = new Float32Array( uv.count * 2 );
		for ( let i = 0; i < uv.count; i ++ ) {

			normalized[ i * 2 ] = ( uv.getX( i ) - uMin ) / uRange;
			normalized[ i * 2 + 1 ] = ( uv.getY( i ) - vMin ) / vRange;

		}

		geometry.setAttribute( 'uv', new THREE.BufferAttribute( normalized, 2 ) );

	}

	function forcePlanarUv( geometry ) {

		const pos = geometry.getAttribute( 'position' );
		if ( ! pos ) return;
		geometry.deleteAttribute( 'uv' );
		writePlanarUv( geometry, pos );

	}

	function writePlanarUv( geometry, pos ) {

		const count = pos.count;
		let xMin = Infinity;
		let xMax = - Infinity;
		let yMin = Infinity;
		let yMax = - Infinity;

		for ( let i = 0; i < count; i ++ ) {

			const x = pos.getX( i );
			const y = pos.getY( i );
			if ( x < xMin ) xMin = x;
			if ( x > xMax ) xMax = x;
			if ( y < yMin ) yMin = y;
			if ( y > yMax ) yMax = y;

		}

		const xRange = xMax - xMin || 1;
		const yRange = yMax - yMin || 1;
		const uv = new Float32Array( count * 2 );

		for ( let i = 0; i < count; i ++ ) {

			uv[ i * 2 ] = ( pos.getX( i ) - xMin ) / xRange;
			uv[ i * 2 + 1 ] = ( pos.getY( i ) - yMin ) / yRange;

		}

		geometry.setAttribute( 'uv', new THREE.BufferAttribute( uv, 2 ) );

	}

	function createRoleMaterial( role, artworkMap ) {

		const defaults = role.defaults || {};
		const textures = role.textures || {};
		const hasArtwork = artworkMap instanceof THREE.Texture;

		return new THREE.MeshPhysicalMaterial( {
			map: hasArtwork ? artworkMap : loadTexture( textures.map, true, true ),
			color: new THREE.Color( hasArtwork ? '#ffffff' : ( defaults.color || '#ffffff' ) ),
			normalMap: loadTexture( textures.normalMap, false, true ),
			normalScale: new THREE.Vector2( defaults.normalScale ?? 1, defaults.normalScale ?? 1 ),
			bumpMap: loadTexture( textures.bumpMap, false, true ),
			bumpScale: defaults.bumpScale ?? 1,
			roughnessMap: loadTexture( textures.roughnessMap, false, true ),
			roughness: defaults.roughness ?? 1,
			metalness: defaults.metalness ?? 0,
			sheen: defaults.sheen ?? 0,
			sheenColor: new THREE.Color( defaults.sheenColor ?? '#000000' ),
			sheenRoughness: defaults.sheenRoughness ?? 1,
			envMapIntensity: defaults.envMapIntensity ?? 1,
			clearcoat: defaults.clearcoat ?? 0,
			clearcoatRoughness: defaults.clearcoatRoughness ?? 0,
			side: THREE.FrontSide
		} );

	}

	function applyMaterialRoles( root, studioJson ) {

		const product = studioJson.product || {};
		const roles = Array.isArray( product.materialRoles ) ? product.materialRoles : [];
		const artworkSlot = product.artworkSlot || null;
		let artworkMap = null;

		if ( artworkSlot && artworkSlot.defaultUrl ) {

			artworkMap = loadTexture( artworkSlot.defaultUrl, true, true );
			if ( artworkMap ) {

				artworkMap.repeat.set( 1, 1 );
				artworkMap.offset.set( 0, 0 );

			}

		}

		root.traverse( function ( object ) {

			if ( ! object.isMesh ) return;

			if ( ( object.name || '' ).trim().toUpperCase() === 'NEW LIGHTS' ) {

				object.visible = false;
				return;

			}

			object.castShadow = true;
			object.receiveShadow = true;

			const role = roles.find( function ( candidate ) {

				return matchesMeshName( object.name, candidate.meshNames );

			} );

			if ( ! role ) {

				forceFrontSide( object.material );
				return;

			}

			const isArtworkMesh = artworkSlot && matchesMeshName( object.name, [ artworkSlot.meshName ] );
			if ( isArtworkMesh ) {

				forcePlanarUv( object.geometry );

			} else {

				ensureUvAttribute( object.geometry );
				normalizeUvRangeIfNeeded( object.geometry );

			}

			object.material = createRoleMaterial( role, isArtworkMesh ? artworkMap : null );

		} );

		return {
			roles,
			artworkApplied: artworkMap !== null
		};

	}

	function forceFrontSide( material ) {

		const materials = Array.isArray( material ) ? material : [ material ];
		for ( const entry of materials ) {

			if ( entry ) {

				entry.side = THREE.FrontSide;
				entry.needsUpdate = true;

			}

		}

	}

	function applySceneSettings( root, studioJson ) {

		const scene = studioJson.scene || {};
		const backgroundColor = scene.backgroundColor ? new THREE.Color( scene.backgroundColor ) : null;
		if ( backgroundColor ) editor.scene.background = backgroundColor;

		if ( scene.fog === 'linear' ) {

			editor.scene.fog = new THREE.Fog(
				new THREE.Color( scene.fogColor || '#000000' ),
				scene.fogNear ?? 1,
				scene.fogFar ?? 1000
			);

		} else if ( scene.fog === 'exp2' || scene.fog === 'exponential' ) {

			editor.scene.fog = new THREE.FogExp2(
				new THREE.Color( scene.fogColor || '#000000' ),
				scene.fogDensity ?? 0.01
			);

		} else {

			editor.scene.fog = null;

		}

		const existingAmbient = root.getObjectByName( 'ONEMO Ambient' );
		if ( existingAmbient ) root.remove( existingAmbient );

		const ambientColor = Array.isArray( scene.ambientColor ) ?
			new THREE.Color().fromArray( scene.ambientColor ) :
			new THREE.Color( scene.ambientColor || '#ffffff' );
		const ambient = new THREE.AmbientLight( ambientColor, scene.ambientIntensity ?? 0.5 );
		ambient.name = 'ONEMO Ambient';
		root.add( ambient );

		editor.signals.sceneBackgroundChanged.dispatch(
			backgroundColor ? 'Color' : 'Default',
			backgroundColor ? backgroundColor.getHex() : 0,
			null,
			null,
			THREE.SRGBColorSpace,
			0,
			1,
			0
		);

		if ( scene.fog === 'linear' ) {

			editor.signals.sceneFogChanged.dispatch(
				'Fog',
				new THREE.Color( scene.fogColor || '#000000' ).getHex(),
				scene.fogNear ?? 1,
				scene.fogFar ?? 1000,
				scene.fogDensity ?? 0.01
			);

		} else if ( scene.fog === 'exp2' || scene.fog === 'exponential' ) {

			editor.signals.sceneFogChanged.dispatch(
				'FogExp2',
				new THREE.Color( scene.fogColor || '#000000' ).getHex(),
				scene.fogNear ?? 1,
				scene.fogFar ?? 1000,
				scene.fogDensity ?? 0.01
			);

		} else {

			editor.signals.sceneFogChanged.dispatch( 'None' );

		}

	}

	function applyEnvironment( studioJson ) {

		const environment = studioJson.environment || {};
		const envUrl = resolveAssetUrl( environment.file ) || LOCAL_ENV_PRESETS[ environment.preset ] || LOCAL_ENV_PRESETS.studio;
		if ( ! envUrl ) return;

		const loader = /\.exr($|\?)/i.test( envUrl ) ? new EXRLoader() : new RGBELoader();
		loader.load( envUrl, function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;
			editor.scene.environment = texture;
			editor.environmentType = 'Equirectangular';

			if ( 'environmentIntensity' in editor.scene ) editor.scene.environmentIntensity = environment.intensity ?? 1;
			if ( 'environmentRotation' in editor.scene ) {

				const rotation = environment.rotation ?? 0;
				editor.scene.environmentRotation.set( 0, rotation, 0 );

			}

			editor.signals.sceneEnvironmentChanged.dispatch( editor.environmentType, texture );
			if ( 'environmentIntensity' in editor.scene ) editor.scene.environmentIntensity = environment.intensity ?? 1;
			if ( 'environmentRotation' in editor.scene ) editor.scene.environmentRotation.y = environment.rotation ?? 0;
			editor.signals.sceneGraphChanged.dispatch();

		}, undefined, function ( error ) {

			console.error( '[ONEMO] environment load failed', envUrl, error );

		} );

	}

	function applyRendererSettings( studioJson ) {

		const renderer = studioJson.renderer || {};
		const settings = {
			toneMapping: renderer.toneMapping ?? THREE.NeutralToneMapping,
			toneMappingExposure: renderer.toneMappingExposure ?? renderer.exposure ?? 0.7,
			shadowsEnabled: renderer.shadowsEnabled ?? renderer.shadows ?? true,
			shadowType: renderer.shadowType ?? THREE.PCFShadowMap,
			outputColorSpace: renderer.outputColorSpace
		};

		editor.config.setKey(
			'project/renderer/toneMapping', settings.toneMapping,
			'project/renderer/toneMappingExposure', settings.toneMappingExposure,
			'project/renderer/shadows', settings.shadowsEnabled,
			'project/renderer/shadowType', settings.shadowType
		);

		if ( typeof editor.applyRendererSettings === 'function' ) {

			editor.applyRendererSettings( settings );

		} else {

			editor.signals.rendererUpdated.dispatch();

		}

	}

	function applyCameraSettings( root, studioJson ) {

		const camera = studioJson.editorCamera || {};
		const position = Array.isArray( camera.position ) ? camera.position : null;
		const target = Array.isArray( camera.target ) ? camera.target : [ 0, 0, 0 ];

		editor.select( root );

		if ( ! position ) {

			editor.signals.objectFocused.dispatch( root );
			return;

		}

		editor.camera.position.fromArray( position );
		editor.camera.fov = camera.fov ?? editor.camera.fov;
		editor.camera.near = camera.near ?? editor.camera.near;
		editor.camera.far = camera.far ?? editor.camera.far;
		editor.camera.lookAt( new THREE.Vector3().fromArray( target ) );
		editor.camera.updateProjectionMatrix();
		editor.controls.center.fromArray( target );
		editor.signals.cameraChanged.dispatch( editor.camera );
		editor.signals.windowResize.dispatch();

	}

	function forceSolidRenderMode() {

		const select = Array.from( document.querySelectorAll( 'select' ) )
			.find( function ( item ) {

				return Array.from( item.options ).some( function ( option ) {

					return /SOLID/i.test( option.textContent || option.value );

				} );

			} );
		if ( ! select ) return;

		const solid = Array.from( select.options ).find( function ( option ) {

			return /SOLID/i.test( option.textContent || option.value );

		} );
		if ( solid && select.value !== solid.value ) {

			select.value = solid.value;
			select.dispatchEvent( new Event( 'change', { bubbles: true } ) );

		}

	}

	function applyOnemo( root, studioJson, source ) {

		editor.clear();
		textureCache.clear();

		root.name = studioJson.name || root.name || 'ONEMO Scene';
		root.userData.onemo = {
			source,
			studioJson
		};

		const materialResult = applyMaterialRoles( root, studioJson );
		applySceneSettings( root, studioJson );
		editor.execute( new AddObjectCommand( editor, root ) );
		applyEnvironment( studioJson );
		applyRendererSettings( studioJson );
		applyCameraSettings( root, studioJson );
		forceSolidRenderMode();

		editor.signals.sceneGraphChanged.dispatch();

		console.log(
			'[ONEMO] loaded',
			source,
			'roles:',
			materialResult.roles.map( function ( role ) { return role.role; } ).join( ', ' ),
			'artwork:',
			materialResult.artworkApplied
		);

		return root;

	}

	window.ONEMO_load = loadOnemoFromUrl;
	window.ONEMO_loadBuffer = loadOnemoBuffer;

	return container;

}

export { MenubarONEMO };
