#version 300 es
precision highp float;

uniform vec2 u_Dimensions;
uniform sampler2D u_PostProcessTexture;
uniform float u_Bloom;

out vec4 out_Col;

const mat3 Gx = mat3(
    3., 10., 3.,
    0., 0., 0.,
    -3., -10., -3.
);

const mat3 Gy = mat3(
    3., 0., -3.,
    10., 0., -10.,
    3., 0., -3.
);

float threshold = 0.9999999;

const float kernel[121] = float[](0.006849, 0.007239, 0.007559, 0.007795, 0.007941, 0.00799, 0.007941, 0.007795, 0.007559, 0.007239, 0.006849,
                            0.007239, 0.007653, 0.00799, 0.00824, 0.008394, 0.008446, 0.008394, 0.00824, 0.00799, 0.007653, 0.007239,
                            0.007559, 0.00799, 0.008342, 0.008604, 0.008764, 0.008819, 0.008764, 0.008604, 0.008342, 0.00799, 0.007559,
                            0.007795, 0.00824, 0.008604, 0.008873, 0.009039, 0.009095, 0.009039, 0.008873, 0.008604, 0.00824, 0.007795,
                            0.007941, 0.008394, 0.008764, 0.009039, 0.009208, 0.009265, 0.009208, 0.009039, 0.008764, 0.008394, 0.007941,
                            0.00799, 0.008446, 0.008819, 0.009095, 0.009265, 0.009322, 0.009265, 0.009095, 0.008819, 0.008446, 0.00799,
                            0.007941, 0.008394, 0.008764, 0.009039, 0.009208, 0.009265, 0.009208, 0.009039, 0.008764, 0.008394, 0.007941,
                            0.007795, 0.00824, 0.008604, 0.008873, 0.009039, 0.009095, 0.009039, 0.008873, 0.008604, 0.00824, 0.007795,
                            0.007559, 0.00799, 0.008342, 0.008604, 0.008764, 0.008819, 0.008764, 0.008604, 0.008342, 0.00799, 0.007559,
                            0.007239, 0.007653, 0.00799, 0.00824, 0.008394, 0.008446, 0.008394, 0.00824, 0.00799, 0.007653, 0.007239,
                            0.006849, 0.007239, 0.007559, 0.007795, 0.007941, 0.00799, 0.007941, 0.007795, 0.007559, 0.007239, 0.006849);

const int radius = 5;
const int dim = 11;

void main()
{

    // TODO: Compute the weighted average of the 11x11 set of pixels
    // in u_Texture surrounding the current fragment's location.
    // The weights are stored in the array above; index into it
    // using the same method you used to index into the Z buffer
    // in homework 3.
    vec3 weightedAverage = vec3(0.0);
    for (int x = -5; x <= 5; ++x) {
        for (int y = -radius; y <=radius; ++y) {
            ivec2 textureCoord = ivec2(gl_FragCoord.xy) + ivec2(x, y);
            vec3 textureCol = texelFetch(u_PostProcessTexture, textureCoord, 0).rgb;

            weightedAverage += textureCol * kernel[(x + radius) * dim + (y + radius)];
        }
    }

    weightedAverage *= u_Bloom;

    out_Col = texture(u_PostProcessTexture, gl_FragCoord.xy / u_Dimensions) + vec4(weightedAverage, 1.0);
}