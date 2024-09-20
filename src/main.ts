import {vec3, vec2} from 'gl-matrix';
import * as DAT from 'dat.gui';
import Icosphere from './geometry/Icosphere';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';
import Square from './geometry/Square';

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
  'Load Scene': loadScene, // A function pointer, essentially
};

let icosphere: Icosphere;
let screenSpanningQuad: Square;
let prevTimestamp: number = 0;
let musicSectionIndex = 0;
let musicSegmentIndex = 0;
let lastUpdateTime = 0;

function loadScene() {
  icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, 8);
  icosphere.create();
  screenSpanningQuad = new Square(vec3.fromValues(0, 0, 0));
  screenSpanningQuad.create();
}


function main() {
  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'Load Scene');

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
  renderer.initPostProcessing();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const fireShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/fire-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/fire-frag.glsl')),
  ]);

  const postProcessShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/post-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/post-frag.glsl')),
  ]);

  // This function will be called every frame
  function tick(timestamp: number) {
    if (prevTimestamp === 0) {
      prevTimestamp = timestamp; // Initialize prevTimestamp with the current timestamp
    }
    let deltaTime = timestamp - prevTimestamp; // Calculate delta time
    prevTimestamp = timestamp; // Update previous timestamp

    let shader = fireShader;
    shader.setTime(timestamp);

    camera.update();
    shader.setLookDirection(camera.getLookDirection());

    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    postProcessShader.setDimensions(vec2.fromValues(window.innerWidth, window.innerHeight));

    renderer.clear();

    // Updating music uniforms

    if ((window as any).isPlaying && (window as any).audioAnalysisData) {
      let musicTime  = (window as any).musicTime;;
      let spotifyData = (window as any).audioAnalysisData;

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
          if (shouldUpdate) {
            shader.setLoudness(spotifyData.segments[musicSegmentIndex].loudness_max);
            lastUpdateTime = musicTime;
          }
        }
        if (musicTime > spotifyData.segments[musicSegmentIndex].start) {
          musicSegmentIndex++;
        }
      }
    }
    else {
      shader.setTempo(0);
    }

    // End music update

    // First pass: draw to framebuffer
    renderer.renderSceneToFBO(camera, shader, [
      icosphere
    ]);

    // Second pass: draw to screen
    postProcessShader.setPostProcessTexture();
    renderer.render(camera, postProcessShader, [screenSpanningQuad]);

    // Tell the browser to call `tick` again whenever it renders a new frame
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.resizeFramebuffer();
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.resizeFramebuffer();
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  tick(0);
}

main();
