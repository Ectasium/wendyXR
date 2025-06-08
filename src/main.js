import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRButton } from 'three/examples/jsm/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'; 
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import officeModelUrl from './models/wendy.glb';
import * as DigitalBaconUI from 'DigitalBacon-UI';

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
let uiBody;

init();

async function init() {
	container = document.createElement('div');
	document.body.appendChild(container);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x808080);

	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
	camera.position.set(0, 1.6, 3);

	controls = new OrbitControls(camera, container);
	controls.target.set(0, 1.6, 0);
	controls.update();

	const stereoButton = document.createElement('button');
	stereoButton.textContent = 'VR Glasses Mode';
	Object.assign(stereoButton.style, {
		top: '20px',
		left: '20px',
		position: 'absolute',
		padding: '12px',
		border: 'none',
		borderRadius: '4px',
		backgroundColor: '#00A3E0',
		color: 'white',
		cursor: 'pointer'
	});
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

	scene.add(new THREE.HemisphereLight(0xbcbcbc, 0xa5a5a5, 3));
	const light = new THREE.DirectionalLight(0xffffff, 3);
	light.position.set(0, 6, 0);
	light.castShadow = true;
	light.shadow.camera.top = 3;
	light.shadow.camera.bottom = -3;
	light.shadow.camera.right = 3;
	light.shadow.camera.left = -3;
	light.shadow.mapSize.set(4096, 4096);
	scene.add(light);

	group = new THREE.Group();
	scene.add(group);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animate);
	renderer.shadowMap.enabled = true;
	renderer.xr.enabled = true;
	container.appendChild(renderer.domElement);
	document.body.appendChild(XRButton.createButton(renderer, {
		optionalFeatures: ['depth-sensing'],
		depthSensing: { usagePreference: ['gpu-optimized'], dataFormatPreference: [] }
	}));

	controller1 = renderer.xr.getController(0);
	controller1.addEventListener('selectstart', onSelectStart);
	controller1.addEventListener('selectend', onSelectEnd);
	scene.add(controller1);

	controller2 = renderer.xr.getController(1);
	controller2.addEventListener('selectstart', onSelectStart);
	controller2.addEventListener('selectend', onSelectEnd);
	scene.add(controller2);

	const controllerModelFactory = new XRControllerModelFactory();
	controllerGrip1 = renderer.xr.getControllerGrip(0);
	controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
	scene.add(controllerGrip1);
	controllerGrip2 = renderer.xr.getControllerGrip(1);
	controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
	scene.add(controllerGrip2);

	const geometry = new THREE.BufferGeometry().setFromPoints([
		new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)
	]);
	const line = new THREE.Line(geometry);
	line.name = 'line';
	line.scale.z = 5;
	controller1.add(line.clone());
	controller2.add(line.clone());

	raycaster = new THREE.Raycaster();

	await setupUI();
	loadModel(officeModelUrl);

	createRandomObjects();
	createVubeButton();

	window.addEventListener('resize', onWindowResize);
}

function onSessionStarted(session) {
	renderer.xr.setSession(session);
}

async function setupUI() {
	await DigitalBaconUI.init(container, renderer, scene, camera);

	uiBody = new DigitalBaconUI.Body({
		borderRadius: 0.06,
		borderWidth: 0.005,
		justifyContent: 'center',
		materialColor: 0x222222,
		opacity: 0.9,
		padding: 0.06,
		width: 0.6,
	});
	scene.add(uiBody);

	const moveButton = new DigitalBaconUI.Div({
		backgroundVisible: true,
		borderRadius: 0.05,
		height: 0.1,
		justifyContent: 'center',
		marginBottom: 0.05,
		materialColor: 0xff4081,
		width: 0.5,
	});

	const buttonText = new DigitalBaconUI.Text('MOVE Wendy', {
		color: '#ffffff',
		fontSize: 0.055,
		maxWidth: '100%'
	});

	moveButton.add(buttonText);
	uiBody.add(moveButton);

	moveButton.onClick = () => {
		if (loadedModel) {
			loadedModel.rotation.y += Math.PI / 4;
		}
	};

	DigitalBaconUI.InputHandler.enableXRControllerManagement(scene);
}

function createRandomObjects() {
	const geometries = [
		new THREE.CylinderGeometry(0.2, 0.2, 0.2, 64),
		new THREE.IcosahedronGeometry(0.2, 8),
		new THREE.TorusGeometry(0.2, 0.04, 64, 32)
	];

	for (let i = 0; i < 5; i++) {
		const geometry = geometries[Math.floor(Math.random() * geometries.length)];
		const material = new THREE.MeshStandardMaterial({
			color: Math.random() * 0xffffff,
			roughness: 0.7,
			metalness: 0.0
		});
		const object = new THREE.Mesh(geometry, material);
		object.position.set(Math.random() * 4 - 2, Math.random() * 2, Math.random() * 4 - 2);
		object.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
		object.scale.setScalar(Math.random() + 0.5);
		object.castShadow = true;
		object.receiveShadow = true;
		group.add(object);
	}
}

function createVubeButton() {
	const buttonGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.01);
	const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
	vubeButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
	vubeButton.name = 'vubeButton';
	scene.add(vubeButton);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelectStart(event) {
	const controller = event.target;
	const intersections = getIntersections(controller);

	if (intersections.length > 0 && intersections[0].object.name === 'vubeButton') {
		if (loadedModel) loadedModel.position.z += 0.1;
		return;
	}

	if (intersections.length > 0) {
		const object = intersections[0].object;
		if (object.parent && object.parent.parent === loadedModel) {
			object.material.emissive.b = 1;
			controller.attach(loadedModel);
			controller.userData.selected = loadedModel;
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
	if (controller.userData.selected) {
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
	loader.load(
		modelurl,
		gltf => {
			loadedModel = gltf.scene;
			loadedModel.position.set(0, 1.3, 0);
			baseY = 1.3;
			loadedModel.scale.set(0.1, 0.1, 0.1);
			group.add(loadedModel);
			loadedModel.traverse(child => {
				if (child.isMesh) child.material.emissive = child.material.emissive || new THREE.Color(0, 0, 0);
			});
		},
		xhr => {
			if (xhr.lengthComputable) {
				console.log(`Loading model: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% completed`);
			} else {
				console.log(`Loaded ${xhr.loaded} bytes`);
			}
		},
		error => {
			console.error('❌ Error loading model:', error);
			console.error('Failed to load model from path:', modelurl);
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
		if (object && object.material) object.material.emissive.r = 0;
	}
}

function animate(time, frame) {
	cleanIntersected();
	intersectObjects(controller1);
	intersectObjects(controller2);

	if (loadedModel) {
		const elapsed = (Date.now() - startTime) / 1000;
		loadedModel.position.y = baseY + 0.06 * Math.sin(elapsed);
	}

	const distance = 0.5;
	const cameraDirection = new THREE.Vector3();
	camera.getWorldDirection(cameraDirection);

	DigitalBaconUI.update(frame);

	vubeButton.position.copy(camera.position)
		.add(cameraDirection.multiplyScalar(distance))
		.add(new THREE.Vector3(0, -0.2, 0));
	vubeButton.quaternion.copy(camera.quaternion);

	renderer.render(scene, camera);
}