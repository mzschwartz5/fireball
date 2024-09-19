import {vec3, vec4} from 'gl-matrix';
const Stats = require('stats-js');
import * as DAT from 'dat.gui';
import Icosphere from './geometry/Icosphere';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
  tesselations: 8,
  'Load Scene': loadScene, // A function pointer, essentially
  'Diffuse Color': [255, 0, 0],
  'Toggle Worley Noise View': true
};

let icosphere: Icosphere;
let prevTesselations: number = 5;
let prevTimestamp: number = 0;
let musicTime = 0;
let musicSectionIndex = 0;
let musicSegmentIndex = 0;
let lastUpdateTime = 0;

function loadScene() {
  icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, controls.tesselations);
  icosphere.create();
}


function main() {
  // Initial display for framerate
  const stats = Stats();
  stats.setMode(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);

  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'tesselations', 0, 8).step(1);
  gui.add(controls, 'Load Scene');
  gui.add(controls, 'Toggle Worley Noise View');
  gui.addColor(controls, 'Diffuse Color');

  // get canvas and webgl context
  const canvas = <HTMLCanvasElement> document.getElementById('canvas');
  const gl = <WebGL2RenderingContext> canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL 2 not supported!');
  }
  // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
  // Later, we can import `gl` from `globals.ts` to access it
  setGL(gl);

  // Initial call to load scene
  loadScene();

  const camera = new Camera(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, 0));

  const renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0.05, 0.05, 0.05, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const lambertShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/lambert-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/lambert-frag.glsl')),
  ]);

  // This function will be called every frame
  function tick(timestamp: number) {
    if (prevTimestamp === 0) {
      prevTimestamp = timestamp; // Initialize prevTimestamp with the current timestamp
    }
    let deltaTime = timestamp - prevTimestamp; // Calculate delta time
    prevTimestamp = timestamp; // Update previous timestamp

    let shader = lambertShader;
    shader.setTime(timestamp);

    camera.update();
    shader.setLookDirection(camera.getLookDirection());

    stats.begin();
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);

    renderer.clear();
    if(controls.tesselations != prevTesselations)
    {
      prevTesselations = controls.tesselations;
      icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, prevTesselations);
      icosphere.create();
    }

    // Updating music uniforms

    if ((window as any).isPlaying && (window as any).audioAnalysisData) {
      let spotifyData = (window as any).audioAnalysisData;
      musicTime += (deltaTime / 1000);

      shader.setTempo(Math.floor(spotifyData.track.tempo));

      if (musicSectionIndex < spotifyData.sections.length) {

        if (musicTime > spotifyData.sections[musicSectionIndex].start) {
          musicSectionIndex++;
        }
      }

      let shouldUpdate = false;
      let beatLength = 60 / spotifyData.track.tempo;
      if (musicTime - lastUpdateTime > beatLength && musicTime - lastUpdateTime < beatLength + deltaTime) {
        shouldUpdate = true;
      }

      if (musicSegmentIndex < spotifyData.segments.length) {
        if (spotifyData.segments[musicSegmentIndex].confidence > 0.85) {
          // Update loudness every beat (not every frame)
          let beatLength = 60 / spotifyData.track.tempo;
          if (shouldUpdate) {
            console.log("HI");
            shader.setLoudness(spotifyData.segments[musicSegmentIndex].loudness_max);
            lastUpdateTime = musicTime;
          }
        }
        if (musicTime > spotifyData.segments[musicSegmentIndex].start) {
          musicSegmentIndex++;
        }
      }
    }

    // End music update

    const diffuseColor = controls['Diffuse Color'];
    shader.setGeometryColor(vec4.fromValues(diffuseColor[0] / 255, diffuseColor[1] / 255, diffuseColor[2] / 255, 1.0));

    renderer.render(camera, shader, [
      icosphere
    ]);
    stats.end();

    // Tell the browser to call `tick` again whenever it renders a new frame
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  tick(0);
}

main();
