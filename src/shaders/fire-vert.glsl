#version 300 es

//This is a vertex shader. While it is called a "shader" due to outdated conventions, this file
//is used to apply matrix transformations to the arrays of vertex data passed to it.
//Since this code is run on your GPU, each vertex is transformed simultaneously.
//If it were run on your CPU, each vertex would have to be processed in a FOR loop, one at a time.
//This simultaneous transformation allows your program to run much faster, especially when rendering
//geometry with millions of vertices.

uniform float u_Time;

// Used for driving animation with music
uniform float u_Loudness;
uniform float u_Tempo; // BPM
uniform float u_FireSpeed;
uniform float u_TendrilNoiseLayers;

uniform mat4 u_Model;       // The matrix that defines the transformation of the
                            // object we're rendering. In this assignment,
                            // this will be the result of traversing your scene graph.

uniform mat4 u_ModelInvTr;  // The inverse transpose of the model matrix.
                            // This allows us to transform the object's normals properly
                            // if the object has been non-uniformly scaled.

uniform mat4 u_ViewProj;    // The matrix that defines the camera's transformation.
                            // We've written a static matrix for you to use for HW2,
                            // but in HW3 you'll have to generate one yourself

in vec4 vs_Pos;             // The array of vertex positions passed to the shader

in vec4 vs_Nor;             // The array of vertex normals passed to the shader

in vec4 vs_Col;             // The array of vertex colors passed to the shader.

out vec4 fs_Nor;            // The array of normals that has been transformed by u_ModelInvTr. This is implicitly passed to the fragment shader.
out vec4 fs_LightVec;       // The direction in which our virtual light lies, relative to each vertex. This is implicitly passed to the fragment shader.
out vec4 fs_Col;            // The color of each vertex. This is implicitly passed to the fragment shader.
out vec4 fs_Pos;            // The position of each vertex. This is implicitly passed to the fragment shader.

const float PI = 3.14159265359;

float powPulse(float x, float k) {
    if (x < 0.0 || x > 1.0) {
        return 0.0;
    }
    return pow(4.0 * x * (1.0 - x), k);
}

float diracDelta(float x, float a) {
    return exp(-pow(x / a, 2.0));
}

float bias(float b, float t) {
    return pow(t, log(b) / log(0.5));
}

const float domainNoiseScaleFactor = 0.1;      // controls domain scale of noise pattern
const float rangeNoiseScaleFactor = 0.2;       // controls range scale of noise pattern

float pseudoRandom(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise3D(in vec3 position) {
    position /= domainNoiseScaleFactor;

    vec3 ijk = floor(position);
    vec3 posFraction = fract(position);
    vec3 smoothedPositionFract = smoothstep(0.0, 1.0, posFraction);

    // Coefficients for noise function
    float a = pseudoRandom(ijk + vec3(0, 0, 0));
    float b = pseudoRandom(ijk + vec3(1, 0, 0));
    float c = pseudoRandom(ijk + vec3(0, 1, 0));
    float d = pseudoRandom(ijk + vec3(1, 1, 0));
    float e = pseudoRandom(ijk + vec3(0, 0, 1));
    float f = pseudoRandom(ijk + vec3(1, 0, 1));
    float g = pseudoRandom(ijk + vec3(0, 1, 1));
    float h = pseudoRandom(ijk + vec3(1, 1, 1));

    float noise = mix(
        mix(mix(a, b, smoothedPositionFract.x), mix(c, d, smoothedPositionFract.x), smoothedPositionFract.y),
        mix(mix(e, f, smoothedPositionFract.x), mix(g, h, smoothedPositionFract.x), smoothedPositionFract.y),
        smoothedPositionFract.z
    );

    return rangeNoiseScaleFactor * noise;
}

float fbm(in vec3 seed, int iterations) {
    float value = noise3D(seed);
    float domainScale = 1.0;
    float rangeScale = 1.0;

    for (int i = 1; i < iterations; i++) {
        domainScale *= 2.0;
        rangeScale /= 2.0;

        float value_i = rangeScale * noise3D(domainScale * seed);
        value += value_i;
    }

    return value;
}

void createBigRipples(inout vec3 modelposition) {
    float warpAmplitude = 0.035;
    float warpFreq = 5.0;
    float warpSpeed = 1500.0;
    float warpPhase = 0.0;
    float warpAmount = warpAmplitude * sin(warpFreq * PI * (modelposition.y - (u_FireSpeed * u_Time / warpSpeed) + warpPhase));
    modelposition.xz += warpAmount * normalize(modelposition.xz);
}

void shapeIntoFire(inout vec3 modelposition) {
    modelposition.xz *= sqrt(-(modelposition.y - 1.0) / 2.0);
}

void createFireTendrils(inout vec3 modelposition) {
    float noise = fbm(vec3(modelposition.x, modelposition.y - (u_FireSpeed * u_Time / 8000.0), modelposition.z), int(u_TendrilNoiseLayers));

    // As we get towards the top of the flame, the tendrils should lean towards the center.
    vec3 center = normalize(modelposition) - vec3(0.0, 1.0, 0.0);
    float upwardsFactor = bias(0.4, (modelposition.y + 1.0) / 2.0);
    modelposition.y += (3.5 * upwardsFactor * noise);
}

void overallFireTransformation(inout vec3 modelposition) {
    createBigRipples(modelposition);
    shapeIntoFire(modelposition);
    createFireTendrils(modelposition);
}

void main()
{
    fs_Col = vs_Col;                         // Pass the vertex colors to the fragment shader for interpolation

    mat3 invTranspose = mat3(u_ModelInvTr);
    fs_Nor = vec4(normalize(invTranspose * vec3(vs_Nor)), 0);          // Pass the vertex normals to the fragment shader for interpolation.
                                                            // Transform the geometry's normals by the inverse transpose of the
                                                            // model matrix. This is necessary to ensure the normals remain
                                                            // perpendicular to the surface after the surface is transformed by
                                                            // the model matrix.


    vec4 modelposition = u_Model * vs_Pos;   // Temporarily store the transformed vertex positions for use below
    float posYNormalized = (modelposition.y + 1.0) / 4.5; // Tendrils can stretch upwards 3.5, so to normalize to 0-1 range, divide by 4.5

    /* Warp vertices in model space to look like fire */
    overallFireTransformation(modelposition.xyz);
    /* Distort vertices according to music loudness and tempo */

    // Since loudness is in DB, we need to convert it to a linear scale
    float distortionAmplitude = clamp(pow(10.0, (u_Loudness - 5.0) * 0.05), 0.05, 1.75);

    if (u_Tempo != 0.0) {
        float timePerBeat = (60.0 / u_Tempo) * 1000.0; // Time in milliseconds per beat
        // Repeats every timePerBeat, ranges from 0 to 1.
        // Phase shift u_Time so that the peak of the distortion is at the start of the beat
        float modTime = mod(u_Time, timePerBeat) / timePerBeat;
        float temporalDistortion = bias(0.9, modTime);
        float spatialDistortion = diracDelta(posYNormalized - modTime, 0.1); // bit of a misnomer as it also depends on time... sue me, variables are hard to name.
        float distortion = spatialDistortion * temporalDistortion * distortionAmplitude;

        // Pulse outwards in xz plane
        modelposition.xz += clamp(distortion * normalize(modelposition.xz), -1.0, 1.5);

        // Pull tendrils upwards
        float upwardsFactor = bias(0.4, posYNormalized);
        modelposition.y += (5.0 * distortionAmplitude * diracDelta(modTime - 0.5, 0.1) * upwardsFactor);
    }

    /* End distortion */

    fs_Pos = modelposition;

    gl_Position = u_ViewProj * modelposition; // gl_Position is a built-in variable of OpenGL which is
                                              // used to render the final positions of the geometry's vertices
}
