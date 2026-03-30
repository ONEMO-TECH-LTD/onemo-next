import * as THREE from 'three';

import {
    clearBridgeComponent,
    ensureBridgeHelper,
    ensureLabelSprite,
    getStoredBridgeComponentData,
    readNumber,
    readVec3,
    sampleCurve,
    sampleCurveSet,
    setBridgeUpdater,
    setStoredBridgeComponentData
} from './bridge-utils';


type Particle = {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    age: number;
    lifetime: number;
};

type ParticleRuntime = {
    particles: Particle[];
    emitAccumulator: number;
    emittedTotal: number;
};

const getParticleDefaults = () => {
    return editor.call('components:getDefault', 'particlesystem') || {};
};

const getParticleRuntime = (object: THREE.Object3D): ParticleRuntime => {
    if (!object.userData.__particleRuntime) {
        object.userData.__particleRuntime = {
            particles: [],
            emitAccumulator: 0,
            emittedTotal: 0
        } satisfies ParticleRuntime;
    }

    return object.userData.__particleRuntime as ParticleRuntime;
};

const clearParticleRuntime = (object: THREE.Object3D) => {
    delete object.userData.__particleRuntime;
    clearBridgeComponent(object, 'particlesystem');
};

const spawnParticle = (observer: import('@/editor-api').EntityObserver) => {
    const shape = readNumber(observer.get('components.particlesystem.emitterShape'), 0);
    const extents = readVec3(observer.get('components.particlesystem.emitterExtents'), [0, 0, 0]);
    const radius = readNumber(observer.get('components.particlesystem.emitterRadius'), 0);

    const position = new THREE.Vector3();
    if (shape === 1) {
        position.setFromSphericalCoords(
            Math.random() * Math.max(radius, 0.001),
            Math.random() * Math.PI,
            Math.random() * Math.PI * 2
        );
    } else {
        position.set(
            (Math.random() - 0.5) * extents[0] * 2,
            (Math.random() - 0.5) * extents[1] * 2,
            (Math.random() - 0.5) * extents[2] * 2
        );
    }

    const localVelocity = sampleCurveSet(observer.get('components.particlesystem.localVelocityGraph'), 0, [0, 1, 0]);
    const worldVelocity = sampleCurveSet(observer.get('components.particlesystem.velocityGraph'), 0, [0, 0, 0]);
    const velocity = new THREE.Vector3(
        localVelocity[0] + worldVelocity[0],
        localVelocity[1] + worldVelocity[1],
        localVelocity[2] + worldVelocity[2]
    );

    return {
        position,
        velocity,
        age: 0,
        lifetime: Math.max(0.05, readNumber(observer.get('components.particlesystem.lifetime'), 5))
    } satisfies Particle;
};

const refreshParticleGeometry = (
    observer: import('@/editor-api').EntityObserver,
    runtime: ParticleRuntime,
    points: THREE.Points
) => {
    const maxParticles = Math.max(1, Math.floor(readNumber(observer.get('components.particlesystem.numParticles'), 30)));
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    const defaultColor = sampleCurveSet(observer.get('components.particlesystem.colorGraph'), 0, [1, 1, 1]);
    const averageScale = Math.max(0.01, sampleCurve(observer.get('components.particlesystem.scaleGraph'), 0, 0.1));

    runtime.particles.slice(0, maxParticles).forEach((particle, index) => {
        const alpha = THREE.MathUtils.clamp(particle.age / Math.max(particle.lifetime, 0.0001), 0, 1);
        const color = sampleCurveSet(observer.get('components.particlesystem.colorGraph'), alpha, defaultColor);
        positions[index * 3] = particle.position.x;
        positions[index * 3 + 1] = particle.position.y;
        positions[index * 3 + 2] = particle.position.z;
        colors[index * 3] = color[0] * (1 - alpha * 0.6);
        colors[index * 3 + 1] = color[1] * (1 - alpha * 0.6);
        colors[index * 3 + 2] = color[2] * (1 - alpha * 0.6);
    });

    const geometry = points.geometry as THREE.BufferGeometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    (points.material as THREE.PointsMaterial).size = averageScale;
};

export const createParticleData = (object: THREE.Object3D) => {
    return getStoredBridgeComponentData(object, 'particlesystem', getParticleDefaults());
};

export const createParticleComponentData = createParticleData;

export const applyParticleObserverChange = (
    object: THREE.Object3D,
    _path: string,
    observer: import('@/editor-api').EntityObserver
) => {
    const particleData = observer.get('components.particlesystem');
    if (!particleData) {
        clearParticleRuntime(object);
        return true;
    }

    setStoredBridgeComponentData(object, 'particlesystem', particleData);

    const label = ensureLabelSprite(object, 'particlesystem:label', {
        text: 'FX',
        backgroundColor: 'rgba(102, 55, 140, 0.88)',
        borderColor: 'rgba(237, 212, 255, 0.95)',
        scale: 0.006,
        fontSize: 34
    });
    label.position.set(0, 0.48, 0);
    label.visible = !!observer.get('components.particlesystem.enabled');

    const points = ensureBridgeHelper(object, 'particlesystem:points', () => {
        return new THREE.Points(
            new THREE.BufferGeometry(),
            new THREE.PointsMaterial({
                color: '#ffffff',
                size: 0.1,
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                depthWrite: false
            })
        );
    });
    points.visible = !!observer.get('components.particlesystem.enabled');

    const runtime = getParticleRuntime(object);
    setBridgeUpdater(object, 'particlesystem', (delta) => {
        if (!observer.get('components.particlesystem.enabled')) {
            runtime.particles.length = 0;
            refreshParticleGeometry(observer, runtime, points as THREE.Points);
            return;
        }

        const maxParticles = Math.max(1, Math.floor(readNumber(observer.get('components.particlesystem.numParticles'), 30)));
        const loop = observer.get('components.particlesystem.loop') !== false;
        const emissionRate = Math.max(0.1, readNumber(observer.get('components.particlesystem.rate'), 4));

        runtime.emitAccumulator += delta * emissionRate;
        while (runtime.emitAccumulator >= 1 && runtime.particles.length < maxParticles) {
            if (!loop && runtime.emittedTotal >= maxParticles) {
                break;
            }
            runtime.emitAccumulator -= 1;
            runtime.particles.push(spawnParticle(observer));
            runtime.emittedTotal += 1;
        }

        runtime.particles = runtime.particles.filter((particle) => {
            particle.age += delta;
            const alpha = THREE.MathUtils.clamp(particle.age / Math.max(particle.lifetime, 0.0001), 0, 1);
            const localVelocity = sampleCurveSet(observer.get('components.particlesystem.localVelocityGraph'), alpha, [
                particle.velocity.x,
                particle.velocity.y,
                particle.velocity.z
            ]);
            const worldVelocity = sampleCurveSet(observer.get('components.particlesystem.velocityGraph'), alpha, [0, 0, 0]);
            particle.position.x += (localVelocity[0] + worldVelocity[0]) * delta;
            particle.position.y += (localVelocity[1] + worldVelocity[1]) * delta;
            particle.position.z += (localVelocity[2] + worldVelocity[2]) * delta;
            return particle.age < particle.lifetime;
        });

        refreshParticleGeometry(observer, runtime, points as THREE.Points);
    });

    return true;
};
