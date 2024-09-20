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
  'Bloom': 0.75,
  'Fire Speed': 1.0,
  'Cell Noise Scale': 2.0,
  'Tendril Noise Layers': 3.0,
  'Hot Color': [255, 255, 0],
  'Cold Color': [255, 0, 0],
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

// 0 if less than a, 1 if greater than b, and linearly interpolated between a and b otherwise
function smoothStep(a: number, b: number, t: number) {
  if (t < a) {
    return 0;
  }
  else if (t > b) {
    return 1;
  }
  else {
    return (t - a) / (b - a);
  }
}

function mix(a: number, b: number, t: number) {
  return a + t * (b - a);
}

function mixColors(a: number[], b: number[], t: number) {
  return [
    Math.floor(mix(a[0], b[0], t)),
    Math.floor(mix(a[1], b[1], t)),
    Math.floor(mix(a[2], b[2], t))
  ];
}

function main() {
  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'Bloom', 0.0, 1.5).step(0.05);
  gui.add(controls, 'Fire Speed', 0.0, 5.0).step(0.1);
  gui.add(controls, 'Cell Noise Scale', 0.0, 10.0).step(0.1);
  gui.add(controls, 'Tendril Noise Layers', 1.0, 6.0).step(1.0);
  gui.addColor(controls, 'Hot Color');
  gui.addColor(controls, 'Cold Color');

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

    // Controls
    postProcessShader.setBloom(controls.Bloom);
    fireShader.setFireSpeed(controls['Fire Speed']);
    fireShader.setPerlinNoiseScale(controls['Cell Noise Scale']);
    fireShader.setTendrilNoiseLayers(controls['Tendril Noise Layers']);
    fireShader.setHotColor(vec3.fromValues(controls['Hot Color'][0] / 255, controls['Hot Color'][1] / 255, controls['Hot Color'][2] / 255));
    fireShader.setColdColor(vec3.fromValues(controls['Cold Color'][0] / 255, controls['Cold Color'][1] / 255, controls['Cold Color'][2] / 255));
    // End controls

    let shader = fireShader;
    shader.setTime(timestamp);

    camera.update();
    shader.setLookDirection(camera.getLookDirection());

    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    postProcessShader.setDimensions(vec2.fromValues(window.innerWidth, window.innerHeight));

    renderer.clear();

    // Animating control properties for demo reel

    controls.Bloom = mix(controls.Bloom, 1.5, smoothStep(29000.0, 30000.0, timestamp));
    controls.Bloom = mix(controls.Bloom, 0, smoothStep(30000.0, 31000.0, timestamp));
    controls.Bloom = mix(controls.Bloom, 0.75, smoothStep(31000.0, 32000.0, timestamp));

    controls['Fire Speed'] = mix(controls['Fire Speed'], 2.0, smoothStep(33000.0, 34000.0, timestamp));
    controls['Fire Speed'] = mix(controls['Fire Speed'], 0.3, smoothStep(38000.0, 39000.0, timestamp));
    controls['Fire Speed'] = mix(controls['Fire Speed'], 1.0, smoothStep(43000.0, 44000.0, timestamp));

    controls['Hot Color'] = mixColors(controls['Hot Color'], [82, 0, 255], smoothStep(52500.0, 53500.0, timestamp));
    controls['Cold Color'] = mixColors(controls['Cold Color'], [255, 255, 255], smoothStep(63000.0, 64000.0, timestamp));

    gui.updateDisplay();

    // End animating control properties

    // Updating music uniforms

    if ((window as any).isPlaying && (window as any).audioAnalysisData) {
      let musicTime  = (window as any).musicTime;
      let spotifyData = (window as any).audioAnalysisData;

      if (musicSectionIndex < spotifyData.sections.length) {

        if (musicTime > spotifyData.sections[musicSectionIndex].start) {
          shader.setTempo(Math.floor(spotifyData.sections[musicSectionIndex].tempo));
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
