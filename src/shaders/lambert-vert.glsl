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

const vec4 lightPos = vec4(5, 5, 3, 1); //The position of our virtual light, which is used to compute the shading of
                                        //the geometry in the fragment shader.

const float PI = 3.14159265359;

float powPulse(float x, float k) {
    return pow(4.0 * x * (1.0 - x), k);
}

vec3 computeTangent(vec3 normal) {
    // Choose an arbitrary vector that is not parallel to the normal
    vec3 arbitrary = vec3(0.0, 1.0, 0.0);
    if (abs(normal.y) > 0.999) {
        arbitrary = vec3(1.0, 0.0, 0.0);
    }

    // Compute the tangent vector
    vec3 tangent = normalize(cross(normal, arbitrary));

    return tangent;
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

    vec3 tangent = computeTangent(fs_Nor.xyz);
    vec3 bitangent =  normalize(cross(fs_Nor.xyz, tangent));;
    vec3 dTangent = modelposition.xyz + (0.0001) * tangent;
    vec3 dBitangent = modelposition.xyz + (0.0001) * bitangent;

    /* Warp vertices in model space */

    // Low frequency sine warp

    float warpAmplitude = 0.05;
    float warpFreq = 7.0;
    float warpSpeed = 2000.0;
    float warpPhase = 0.0;
    float warpAmount = warpAmplitude * sin(warpFreq * PI * (modelposition.y - (u_Time / warpSpeed) + warpPhase));
    modelposition.xyz += warpAmount * normalize(modelposition.xyz);

    /* Approximate new normals */
    float tangentWarp = warpAmplitude * sin(warpFreq * PI * (dTangent.y - (u_Time / warpSpeed) + warpPhase));
    dTangent += tangentWarp * normalize(dTangent);
    float bitangentWarp = warpAmplitude * sin(warpFreq * PI * (dBitangent.y - (u_Time / warpSpeed) + warpPhase));
    dBitangent += bitangentWarp * normalize(dBitangent);

    fs_Nor = vec4(normalize(cross(dTangent - modelposition.xyz, dBitangent - modelposition.xyz)), 0.0);

    /* End warp */

    /* Distort vertices according to music loudness and tempo */

    // Since loudness is in DB, we need to convert it to a linear scale
    float distortionAmplitude = clamp(pow(10.0, (u_Loudness - 5.0) * 0.05), 0.05, 1.75);

    if (u_Tempo != 0.0) {
        float timePerBeat = (60.0 / u_Tempo) * 1000.0; // Time in milliseconds per beat
        // Repeats every timePerBeat, ranges from 0 to 1.
        // Phase shift u_Time so that the peak of the distortion is at the start of the beat
        float modTime = mod(u_Time, timePerBeat) / timePerBeat;
        float distortion = distortionAmplitude * powPulse(modTime, 7.0);
        modelposition.xyz += distortion * normalize(modelposition.xyz);
    }

    /* End distortion */

    fs_LightVec = lightPos;

    gl_Position = u_ViewProj * modelposition; // gl_Position is a built-in variable of OpenGL which is
                                              // used to render the final positions of the geometry's vertices
}
