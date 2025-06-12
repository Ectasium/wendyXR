// Import necessary modules from Three.js and supporting libraries
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRButton } from 'three/examples/jsm/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import WendyModelUrl from './models/wendy.glb'; // Path to your GLB model

// Declare variables for global use
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
let moveButton;

// Initialize the scene
init();

//Maybe this could be useful für checking, in which environment we are in/which headset we are using (though XR also does some detection)
function detectOS() {
	const userAgent = navigator.userAgent;
	const platform = navigator.userAgentData?.platform || navigator;
	
	// OS detection logic using the constants above
	if (/Win/.test(platform) || /Windows/.test(userAgent)) return "Windows";
	if ((/iPhone|iPad|iPod/.test(platform) || /iPhone|iPad|iPod/.test(userAgent)) || 
		(/Mac/.test(platform) && navigator.maxTouchPoints > 0)) return "iOS";
	if (/Mac/.test(platform) || /Macintosh/.test(userAgent)) return "macOS";
	if (/Android/.test(userAgent)) return "Android";
	if (/Linux/.test(platform) || (/Linux/.test(userAgent) && !/Android/.test(userAgent))) return "Linux";
	if (/CrOS/.test(userAgent)) return "ChromeOS";
	if (/FreeBSD/.test(platform)) return "FreeBSD";
	if (/OpenBSD/.test(platform)) return "OpenBSD";
	if (/NetBSD/.test(platform)) return "NetBSD";
	
	return "Unknown OS";
  }
  
  console.log("Operating System:", detectOS());

// Main initialization function
function init() {
	// Create DOM container for WebGL canvas
	container = document.createElement('div');
	document.body.appendChild(container);

	// Set up the Three.js scene
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x808080); // Gray background

	// Set up perspective camera
	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
	camera.position.set(0, 1.6, 3); // Typical height for VR

	// Allow mouse orbiting when not in VR
	controls = new OrbitControls(camera, container);
	controls.target.set(0, 1.6, 0);
	controls.update();

	// Button to toggle stereoscopic VR mode (non-WebXR fallback)
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

	// Add ambient and directional lighting
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

	// Group to hold geometry and loaded models
	group = new THREE.Group();
	scene.add(group);

	// Create and add some random 3D shapes to the group
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
		object.rotation.set(
			Math.random() * 2 * Math.PI,
			Math.random() * 2 * Math.PI,
			Math.random() * 2 * Math.PI
		);
		object.scale.setScalar(Math.random() + 0.5);
		object.castShadow = true;
		object.receiveShadow = true;
		group.add(object);
	}

	// Configure and add WebGL renderer
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animate); // Render loop
	renderer.shadowMap.enabled = true;
	renderer.xr.enabled = true;
	container.appendChild(renderer.domElement);

	// Add WebXR button
	document.body.appendChild(XRButton.createButton(renderer, {
		optionalFeatures: ['depth-sensing'],
		depthSensing: {
			usagePreference: ['gpu-optimized'],
			dataFormatPreference: []
		}
	}));

	// Set the XR session
	function onSessionStarted(session) {
		renderer.xr.setSession(session);
	}

	// Create and add XR controllers
	controller1 = renderer.xr.getController(0);
	controller2 = renderer.xr.getController(1);
	controller1.addEventListener('selectstart', onSelectStart);
	controller1.addEventListener('selectend', onSelectEnd);
	controller2.addEventListener('selectstart', onSelectStart);
	controller2.addEventListener('selectend', onSelectEnd);
	scene.add(controller1);
	scene.add(controller2);

	// Add 3D models of controllers (e.g., Oculus Touch)
	const controllerModelFactory = new XRControllerModelFactory();
	controllerGrip1 = renderer.xr.getControllerGrip(0);
	controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
	scene.add(controllerGrip1);
	controllerGrip2 = renderer.xr.getControllerGrip(1);
	controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
	scene.add(controllerGrip2);

	// Add visible ray lines to each controller
	const geometry = new THREE.BufferGeometry().setFromPoints([
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(0, 0, -1)
	]);
	const line = new THREE.Line(geometry);
	line.name = 'line';
	line.scale.z = 5;
	controller1.add(line.clone());
	controller2.add(line.clone());

	// Initialize raycaster and extend with helper for XR
	raycaster = new THREE.Raycaster();
	raycaster.setFromXRController = function (controller) {
		const tempMatrix = new THREE.Matrix4();
		tempMatrix.identity().extractRotation(controller.matrixWorld);
		raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
		raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
	};	

	// Create and add a button in 3D space
	function createButton(text, name) {
		const canvas = document.createElement('canvas');
		const scaleFactor = 4;
		canvas.width = 256 * scaleFactor;
		canvas.height = 64 * scaleFactor;

		const context = canvas.getContext('2d');
		context.scale(scaleFactor, scaleFactor);
		context.fillStyle = 'white';
		context.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);
		context.font = 'bold 40px Calibri';
		context.fillStyle = 'black';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(text, canvas.width / (2 * scaleFactor), canvas.height / (2 * scaleFactor));

		const texture = new THREE.CanvasTexture(canvas);
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
		texture.needsUpdate = true;

		const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
		const geometry = new THREE.PlaneGeometry(0.15, 0.05);
		const buttonMesh = new THREE.Mesh(geometry, material);
		buttonMesh.name = name;

		return buttonMesh;
	}

	moveButton = createButton('👉 Click me ', 'moveButton');
	scene.add(moveButton); // Add the button to the scene

	window.addEventListener('resize', onWindowResize); // Handle screen resize

	loadModel(WendyModelUrl); // Load GLB model
}

// Handle window resizing
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

// Handler for controller select start
function onSelectStart(event) {
	const controller = event.target;
	const intersections = getIntersections(controller);

	if (intersections.length > 0 && intersections[0].object.name === 'moveButton') {
		if (loadedModel) loadedModel.position.z += 0.1;
		return;
	}

	if (intersections.length > 0) {
		const object = intersections[0].object;
		if (object.parent && (object.parent.parent === loadedModel)) {
			if (object.material.emissive) object.material.emissive.b = 1;
			controller.attach(loadedModel);
			controller.userData.selected = loadedModel;
			controller.userData.selectedMesh = object;
		} else {
			if (object.material.emissive) object.material.emissive.b = 1;
			controller.attach(object);
			controller.userData.selected = object;
		}
	}

	controller.userData.targetRayMode = event.data.targetRayMode;	
}

// Handler for controller select end
function onSelectEnd(event) {
	const controller = event.target;
	if (controller.userData.selected) {
		const object = controller.userData.selected;
		if (controller.userData.selectedMesh?.material.emissive) {
			controller.userData.selectedMesh.material.emissive.b = 0;
		} else if (object.material?.emissive) {
			object.material.emissive.b = 0;
		}
		group.attach(object);
		controller.userData.selected = undefined;
		controller.userData.selectedMesh = undefined;
	}
}

// Return intersections from raycaster
function getIntersections(controller) {
	controller.updateMatrixWorld();
	raycaster.setFromXRController(controller);

	const objectsToTest = [];

	group.traverse(child => {
		if (child.isMesh) objectsToTest.push(child);
	});

	if (loadedModel) {
		loadedModel.traverse(child => {
			if (child.isMesh) objectsToTest.push(child);
		});
	}

	if (moveButton) objectsToTest.push(moveButton);

	return raycaster.intersectObjects(objectsToTest, false);
}

// Load GLB 3D model into the scene
function loadModel(modelurl) {
	const loader = new GLTFLoader();
	loader.load(modelurl,
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
		}
	);
}

// Highlight intersected objects
function intersectObjects(controller) {
	if (controller.userData.targetRayMode === 'screen') return;
	if (controller.userData.selected) return;

	const line = controller.getObjectByName('line');
	const intersections = getIntersections(controller);

	if (intersections.length > 0) {
		const object = intersections[0].object;
		if (object.material?.emissive) {
			object.material.emissive.r = 1;
			intersected.push(object);
		}
		line.scale.z = intersections[0].distance;
	} else {
		line.scale.z = 5;
	}
}

// Reset highlighted objects each frame
function cleanIntersected() {
	while (intersected.length) {
		const object = intersected.pop();
		if (object.material?.emissive) {
			object.material.emissive.r = 0;
		}
	}
}

// Main render loop
function animate() {
	cleanIntersected();
	intersectObjects(controller1);
	intersectObjects(controller2);

	// Animate the loaded model with a bounce effect
	if (loadedModel) {
		const elapsed = (Date.now() - startTime) / 1000;
		const bounce = 0.06 * Math.sin(elapsed);
		loadedModel.position.y = baseY + bounce;
	}

	// === Position the 3D button at the bottom center of the screen ===
	const ndc = new THREE.Vector3(-0.9, -0.4, 0.5); // X=0 (center), Y=-0.9 (bottom), Z=0.5 (distance into scene)
	ndc.unproject(camera);

	// Compute direction from camera to unprojected point
	const dir = ndc.clone().sub(camera.position).normalize();
	const distance = 0.5; // distance in front of the camera
	const targetPos = camera.position.clone().add(dir.multiplyScalar(distance));

	targetPos.y += 0.08;

	moveButton.position.copy(targetPos);

	// Lock rotation to horizontal (yaw only)
	const euler = new THREE.Euler(0, 0, 0, 'YXZ');
	euler.setFromQuaternion(camera.quaternion);
	euler.x = 0;
	euler.z = 0;
	moveButton.quaternion.setFromEuler(euler);

	renderer.render(scene, camera);
}


