import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRButton } from 'three/examples/jsm/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'; 
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import officeModelUrl from './models/wendy.glb';

let container;
let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let loadedModel;
let raycaster;
const intersected = [];
let controls, group;
let baseY = 0;          
let startTime = Date.now(); 
let vubeButton;

init();

function init() {
	container = document.createElement( 'div' );
	document.body.appendChild( container );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x808080 );

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 10 );
	camera.position.set( 0, 1.6, 3 );

	controls = new OrbitControls( camera, container );
	controls.target.set( 0, 1.6, 0 );
	controls.update();

	const stereoButton = document.createElement('button');
	stereoButton.textContent = 'VR Glasses Mode';
	stereoButton.style.position = 'absolute';
	stereoButton.style.top = '20px';
	stereoButton.style.left = '20px';
	stereoButton.style.padding = '12px';
	stereoButton.style.border = 'none';
	stereoButton.style.borderRadius = '4px';
	stereoButton.style.backgroundColor = '#00A3E0';
	stereoButton.style.color = 'white';
	stereoButton.style.cursor = 'pointer';

	stereoButton.addEventListener('click', () => {
		if (renderer.xr.isPresenting) {
			renderer.xr.getSession().end();
		} else {
			navigator.xr.requestSession('immersive-vr', {
				optionalFeatures: ['local-floor', 'bounded-floor']
			}).then(onSessionStarted);
		}
	});
	document.body.appendChild(stereoButton);

	scene.add( new THREE.HemisphereLight( 0xbcbcbc, 0xa5a5a5, 3 ) );
	const light = new THREE.DirectionalLight( 0xffffff, 3 );
	light.position.set( 0, 6, 0 );
	light.castShadow = true;
	light.shadow.camera.top = 3;
	light.shadow.camera.bottom = - 3;
	light.shadow.camera.right = 3;
	light.shadow.camera.left = - 3;
	light.shadow.mapSize.set( 4096, 4096 );
	scene.add( light );

	group = new THREE.Group();
	scene.add( group );

	const geometries = [
		new THREE.BoxGeometry( 0.2, 0.2, 0.2 ),
		new THREE.ConeGeometry( 0.2, 0.2, 64 ),
		new THREE.CylinderGeometry( 0.2, 0.2, 0.2, 64 ),
		new THREE.IcosahedronGeometry( 0.2, 8 ),
		new THREE.TorusGeometry( 0.2, 0.04, 64, 32 )
	];

	for ( let i = 0; i < 5; i ++ ) {
		const geometry = geometries[ Math.floor( Math.random() * geometries.length ) ];
		const material = new THREE.MeshStandardMaterial( {
			color: Math.random() * 0xffffff,
			roughness: 0.7,
			metalness: 0.0
		} );
		const object = new THREE.Mesh( geometry, material );
		object.position.x = Math.random() * 4 - 2;
		object.position.y = Math.random() * 2;
		object.position.z = Math.random() * 4 - 2;
		object.rotation.x = Math.random() * 2 * Math.PI;
		object.rotation.y = Math.random() * 2 * Math.PI;
		object.rotation.z = Math.random() * 2 * Math.PI;
		object.scale.setScalar( Math.random() + 0.5 );
		object.castShadow = true;
		object.receiveShadow = true;
		group.add(object);
	}

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.shadowMap.enabled = true;
	renderer.xr.enabled = true;
	container.appendChild( renderer.domElement );
	document.body.appendChild( XRButton.createButton( renderer, {
		'optionalFeatures': [ 'depth-sensing' ],
		'depthSensing': { 'usagePreference': [ 'gpu-optimized' ], 'dataFormatPreference': [] }
	}));
	function onSessionStarted(session) {
		renderer.xr.setSession(session);
	}

	controller1 = renderer.xr.getController( 0 );
	controller1.addEventListener( 'selectstart', onSelectStart );
	controller1.addEventListener( 'selectend', onSelectEnd );
	scene.add( controller1 );

	controller2 = renderer.xr.getController( 1 );
	controller2.addEventListener( 'selectstart', onSelectStart );
	controller2.addEventListener( 'selectend', onSelectEnd );
	scene.add( controller2 );

	const controllerModelFactory = new XRControllerModelFactory();
	controllerGrip1 = renderer.xr.getControllerGrip( 0 );
	controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
	scene.add( controllerGrip1 );
	controllerGrip2 = renderer.xr.getControllerGrip( 1 );
	controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
	scene.add( controllerGrip2 );

	const geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );
	const line = new THREE.Line( geometry );
	line.name = 'line';
	line.scale.z = 5;
	controller1.add( line.clone() );
	controller2.add( line.clone() );
	raycaster = new THREE.Raycaster();

	// Create vubeButton
	const buttonGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.01);
	const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
	vubeButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
	vubeButton.name = 'vubeButton';
	scene.add(vubeButton);

	window.addEventListener( 'resize', onWindowResize );
	loadModel(officeModelUrl);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}

function onSelectStart(event) {
	const controller = event.target;
	const intersections = getIntersections(controller);

	if (intersections.length > 0 && intersections[0].object.name === 'vubeButton') {
		if (loadedModel) {
			loadedModel.rotation.y += Math.PI / 4;
		}
		return;
	}

	if (intersections.length > 0) {
		const intersection = intersections[0];
		const object = intersection.object;

		if (object.parent && (object.parent.parent === loadedModel)) {
			const modelRoot = loadedModel;
			object.material.emissive.b = 1;
			controller.attach(modelRoot);
			controller.userData.selected = modelRoot;
			controller.userData.selectedMesh = object;
		} else {
			object.material.emissive.b = 1;
			controller.attach(object);
			controller.userData.selected = object;
		}
	}

	controller.userData.targetRayMode = event.data.targetRayMode;
}

function onSelectEnd(event) {
	const controller = event.target;
	if (controller.userData.selected !== undefined) {
		const object = controller.userData.selected;
		if (controller.userData.selectedMesh) {
			controller.userData.selectedMesh.material.emissive.b = 0;
		} else if (object.material) {
			object.material.emissive.b = 0;
		}
		group.attach(object);
		controller.userData.selected = undefined;
		controller.userData.selectedMesh = undefined;
	}
}

function getIntersections(controller) {
	controller.updateMatrixWorld();
	raycaster.setFromXRController(controller);

	const objectsToTest = [];
	group.traverse(child => {
		if (child.isMesh) objectsToTest.push(child);
	});
	objectsToTest.push(vubeButton);

	return raycaster.intersectObjects(objectsToTest, false);
}

function loadModel(modelurl) {
	const loader = new GLTFLoader();
	const modelPath = modelurl;
	loader.load(
		modelPath,
		gltf => {
			loadedModel = gltf.scene;
			loadedModel.position.set(0, 1.3, 0);
			baseY = 1.3;
			loadedModel.scale.set(0.1, 0.1, 0.1);
			group.add(loadedModel);
			loadedModel.traverse(child => {
				if (child.isMesh) {
					child.material.emissive = child.material.emissive || new THREE.Color(0, 0, 0);
				}
			});
		},
		xhr => {
			if (xhr.lengthComputable) {
				const progress = (xhr.loaded / xhr.total) * 100;
				console.log(`Loading model: ${progress.toFixed(2)}% completed`);
			} else {
				console.log(`Loaded ${xhr.loaded} bytes`);
			}
		},
		error => {
			console.error('❌ Error loading model:', error);
			console.error('Failed to load model from path:', modelPath);
		}
	);
}

function intersectObjects(controller) {
	if (controller.userData.targetRayMode === 'screen') return;
	if (controller.userData.selected !== undefined) return;
	const line = controller.getObjectByName('line');
	const intersections = getIntersections(controller);
	if (intersections.length > 0) {
		const intersection = intersections[0];
		const object = intersection.object;
		if (object.material) {
			object.material.emissive.r = 1;
			intersected.push(object);
		}
		line.scale.z = intersection.distance;
	} else {
		line.scale.z = 5;
	}
}

function cleanIntersected() {
	while (intersected.length) {
		const object = intersected.pop();
		if (object && object.material) {
			object.material.emissive.r = 0;
		}
	}
}

function animate() {
	cleanIntersected();
	intersectObjects( controller1 );
	intersectObjects( controller2 );
	if (loadedModel) {
		const elapsed = (Date.now() - startTime) / 1000;
		const bounce = 0.06 * Math.sin(elapsed);
		loadedModel.position.y = baseY + bounce;
	}

	// Helper: create a canvas texture with "CLICK" text
function createClickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Fill background white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw black "CLICK" text centered
    ctx.fillStyle = 'black';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLICK', canvas.width / 2, canvas.height / 2);

    return new THREE.CanvasTexture(canvas);
}

// Create the materials array with white for all faces except front with the text texture
const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const clickTextureMaterial = new THREE.MeshStandardMaterial({ map: createClickTexture() });

const materials = [
    whiteMaterial,  // right
    whiteMaterial,  // left
    whiteMaterial,  // top
    whiteMaterial,  // bottom
    clickTextureMaterial,  // front (z+)
    whiteMaterial   // back
];

// Assuming vubeButton is your mesh, update its geometry and materials accordingly
vubeButton.geometry = new THREE.BoxGeometry(0.15, 0.15, 0.05);
vubeButton.material = materials;

// Position and orient the button as before:
const distance = 0.5;
const cameraDirection = new THREE.Vector3();
camera.getWorldDirection(cameraDirection);

// Position in front of camera and slightly down
vubeButton.position.copy(camera.position)
    .add(cameraDirection.multiplyScalar(distance))
    .add(new THREE.Vector3(0, -0.2, 0));

// Align button with camera quaternion so it stays parallel and front faces camera
vubeButton.quaternion.copy(camera.quaternion);


    renderer.render(scene, camera);
}
