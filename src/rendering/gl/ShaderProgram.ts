import {vec4, vec3, mat4, vec2} from 'gl-matrix';
import Drawable from './Drawable';
import {gl} from '../../globals';

var activeProgram: WebGLProgram = null;

export class Shader {
  shader: WebGLShader;

  constructor(type: number, source: string) {
    this.shader = gl.createShader(type);
    gl.shaderSource(this.shader, source);
    gl.compileShader(this.shader);

    if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(this.shader);
    }
  }
};

class ShaderProgram {
  prog: WebGLProgram;

  attrPos: number;
  attrNor: number;
  attrCol: number;

  unifModel: WebGLUniformLocation;
  unifModelInvTr: WebGLUniformLocation;
  unifViewProj: WebGLUniformLocation;

  unifDimensions: WebGLUniformLocation;
  unifPostProcessTexture: WebGLUniformLocation;
  unifTime: WebGLUniformLocation;
  unifLoudness: WebGLUniformLocation;
  unifTempo: WebGLUniformLocation;
  unifBloom: WebGLUniformLocation;
  unifFireSpeed: WebGLUniformLocation;
  unifPerlinNoiseScale: WebGLUniformLocation;

  unifTendrilNoiseLayers: WebGLUniformLocation;
  unifHotColor: WebGLUniformLocation;
  unifColdColor: WebGLUniformLocation;
  unifLookDirection: WebGLUniformLocation;

  constructor(shaders: Array<Shader>) {
    this.prog = gl.createProgram();

    for (let shader of shaders) {
      gl.attachShader(this.prog, shader.shader);
    }
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(this.prog);
    }

    this.attrPos = gl.getAttribLocation(this.prog, "vs_Pos");
    this.attrNor = gl.getAttribLocation(this.prog, "vs_Nor");
    this.attrCol = gl.getAttribLocation(this.prog, "vs_Col");
    this.unifModel      = gl.getUniformLocation(this.prog, "u_Model");
    this.unifModelInvTr = gl.getUniformLocation(this.prog, "u_ModelInvTr");
    this.unifViewProj   = gl.getUniformLocation(this.prog, "u_ViewProj");

    this.unifDimensions = gl.getUniformLocation(this.prog, "u_Dimensions");
    this.unifPostProcessTexture = gl.getUniformLocation(this.prog, "u_PostProcessTexture");
    this.unifTime = gl.getUniformLocation(this.prog, "u_Time");
    this.unifLoudness = gl.getUniformLocation(this.prog, "u_Loudness");
    this.unifTempo = gl.getUniformLocation(this.prog, "u_Tempo");
    this.unifBloom = gl.getUniformLocation(this.prog, "u_Bloom");
    this.unifFireSpeed = gl.getUniformLocation(this.prog, "u_FireSpeed");
    this.unifPerlinNoiseScale = gl.getUniformLocation(this.prog, "u_PerlinNoiseScale");
    this.unifTendrilNoiseLayers = gl.getUniformLocation(this.prog, "u_TendrilNoiseLayers");
    this.unifHotColor = gl.getUniformLocation(this.prog, "u_HotColor");
    this.unifColdColor = gl.getUniformLocation(this.prog, "u_ColdColor");
    this.unifLookDirection = gl.getUniformLocation(this.prog, "u_LookDirection");

  }

  use() {
    if (activeProgram !== this.prog) {
      gl.useProgram(this.prog);
      activeProgram = this.prog;
    }
  }

  setModelMatrix(model: mat4) {
    this.use();
    if (this.unifModel !== -1) {
      gl.uniformMatrix4fv(this.unifModel, false, model);
    }

    if (this.unifModelInvTr !== -1) {
      let modelinvtr: mat4 = mat4.create();
      mat4.transpose(modelinvtr, model);
      mat4.invert(modelinvtr, modelinvtr);
      gl.uniformMatrix4fv(this.unifModelInvTr, false, modelinvtr);
    }
  }

  setViewProjMatrix(vp: mat4) {
    this.use();
    if (this.unifViewProj !== -1) {
      gl.uniformMatrix4fv(this.unifViewProj, false, vp);
    }
  }

  setDimensions(dimensions: vec2) {
    this.use();
    gl.uniform2fv(this.unifDimensions, dimensions);
  }

  setPostProcessTexture() {
    this.use();
    gl.uniform1i(this.unifPostProcessTexture, 0);
  }

  setTime(time: number) {
    this.use();
    gl.uniform1f(this.unifTime, time);
  }

  setLoudness(loudness: number) {
    this.use();
    gl.uniform1f(this.unifLoudness, loudness);
  }

  setTempo(tempo: number) {
    this.use();
    gl.uniform1f(this.unifTempo, tempo);
  }

  setBloom(bloom: number) {
    this.use();
    gl.uniform1f(this.unifBloom, bloom);
  }

  setFireSpeed(fireSpeed: number) {
    this.use();
    gl.uniform1f(this.unifFireSpeed, fireSpeed);
  }

  setPerlinNoiseScale(perlinNoiseScale: number) {
    this.use();
    gl.uniform1f(this.unifPerlinNoiseScale, perlinNoiseScale);
  }

  setTendrilNoiseLayers(tendrilNoiseLayers: number) {
    this.use();
    gl.uniform1f(this.unifTendrilNoiseLayers, tendrilNoiseLayers);
  }

  setHotColor(hotColor: vec3) {
    this.use();
    gl.uniform3fv(this.unifHotColor, hotColor);
  }

  setColdColor(coldColor: vec3) {
    this.use();
    gl.uniform3fv(this.unifColdColor, coldColor);
  }

  setLookDirection(lookDirection: vec3) {
    this.use();
    gl.uniform3fv(this.unifLookDirection, lookDirection);
  }

  draw(d: Drawable) {
    this.use();

    if (this.attrPos != -1 && d.bindPos()) {
      gl.enableVertexAttribArray(this.attrPos);
      gl.vertexAttribPointer(this.attrPos, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrNor != -1 && d.bindNor()) {
      gl.enableVertexAttribArray(this.attrNor);
      gl.vertexAttribPointer(this.attrNor, 4, gl.FLOAT, false, 0, 0);
    }

    d.bindIdx();
    gl.drawElements(d.drawMode(), d.elemCount(), gl.UNSIGNED_INT, 0);

    if (this.attrPos != -1) gl.disableVertexAttribArray(this.attrPos);
    if (this.attrNor != -1) gl.disableVertexAttribArray(this.attrNor);
  }
};

export default ShaderProgram;
