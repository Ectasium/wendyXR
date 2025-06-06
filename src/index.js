import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRButton } from 'three/examples/jsm/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'; 
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import officeModelUrl from './models/office.glb';

let container;
let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let loadedModel;

let raycaster;

const intersected = [];

let controls, group;

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

	// const floorGeometry = new THREE.PlaneGeometry( 6, 6 );
	// const floorMaterial = new THREE.ShadowMaterial( { opacity: 0.25, blending: THREE.CustomBlending, transparent: false } );
	// const floor = new THREE.Mesh( floorGeometry, floorMaterial );
	// floor.rotation.x = - Math.PI / 2;
	// floor.receiveShadow = true;
    // scene.add( floor );
    
    // Add a button to enter stereoscopic mode
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
        // Request a WebXR session with stereoscopic rendering
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

	// controllers

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

	//

	const geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );

	const line = new THREE.Line( geometry );
	line.name = 'line';
	line.scale.z = 5;

	controller1.add( line.clone() );
	controller2.add( line.clone() );

	raycaster = new THREE.Raycaster();

	//

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

    if (intersections.length > 0) {
        const intersection = intersections[0];
        const object = intersection.object;
        
        // If it's part of the loaded model
        if (object.parent && (object.parent === loadedModel || object.parent.parent === loadedModel)) {
            // We want to move the entire model, not just the specific mesh
            const modelRoot = loadedModel;
            
            // Highlight the selected part
            object.material.emissive.b = 1;
            controller.attach(modelRoot);
            controller.userData.selected = modelRoot;
            controller.userData.selectedMesh = object; // Remember which part was selected
        } else {
            // Handle normal objects as before
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
        
        // Return highlighting to normal
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
    
    // Get all objects to test, including individual meshes in loaded models
    const objectsToTest = [];
    
    // Add standard geometric objects
    group.children.forEach(object => {
        if (object.isMesh) {
            objectsToTest.push(object);
        } else if (object.isGroup) {
            // For GLB models that are groups with child meshes
            object.traverse(child => {
                if (child.isMesh) {
                    objectsToTest.push(child);
                }
            });
        }
    });
    
    return raycaster.intersectObjects(objectsToTest, false);
}


function loadModel(modelurl) {
    const loader = new GLTFLoader();
    const modelPath = modelurl; // use the imported URL

    console.log('Loading model from path:', modelPath);

    loader.load(
        modelPath,
        gltf => {
            loadedModel = gltf.scene;
            loadedModel.position.set(0, 1.3, 0);
            loadedModel.scale.set(0.1, 0.1, 0.1);
            group.add(loadedModel);
			console.log('✅ Model successfully loaded and added to scene!');
			
			loadedModel.traverse(function(child) {
                if (child.isMesh) {
                    // Add material properties needed for highlighting
                    child.material.emissive = child.material.emissive || new THREE.Color(0, 0, 0);
                }
            });
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const progress = (xhr.loaded / xhr.total) * 100;
                console.log(`Loading model: ${progress.toFixed(2)}% completed`);
            } else {
                console.log(`Loaded ${xhr.loaded} bytes`);
            }
        },
        (error) => {
            console.error('❌ Error loading model:', error);
            console.error('Failed to load model from path:', modelPath);
        }
    );
}

function intersectObjects(controller) {
    // Do not highlight in mobile-ar
    if (controller.userData.targetRayMode === 'screen') return;

    // Do not highlight when already selected
    if (controller.userData.selected !== undefined) return;

    const line = controller.getObjectByName('line');
    const intersections = getIntersections(controller);

    if (intersections.length > 0) {
        const intersection = intersections[0];
        const object = intersection.object;
        
        // Make sure the object has the material property before accessing it
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

	renderer.render( scene, camera );

}