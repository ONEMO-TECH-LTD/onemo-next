import { LAYERID_DEPTH, type AppBase } from 'playcanvas';
import * as THREE from 'three';

// Centralize remaining engine dependencies for viewport code while swapping math primitives
// to Three-backed compatibility classes.
export * from 'playcanvas';

export const moveViewportDepthLayer = (app: AppBase) => {
    const depthLayer = app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (!depthLayer) {
        return;
    }

    app.scene.layers.remove(depthLayer);
    app.scene.layers.insertOpaque(depthLayer, 2);
};

type Vector2Like = { x: number; y: number };
type Vector3Like = { x: number; y: number; z: number };
type Vector4Like = { x: number; y: number; z: number; w: number };
type QuaternionLike = { x: number; y: number; z: number; w: number };
type MatrixLike = { data?: ArrayLike<number>; elements?: ArrayLike<number> };

const DEG_TO_RAD = THREE.MathUtils.DEG2RAD;
const RAD_TO_DEG = THREE.MathUtils.RAD2DEG;

const getMatrixElements = (matrix: MatrixLike) => {
    if ('data' in matrix && matrix.data) {
        return matrix.data;
    }

    if ('elements' in matrix && matrix.elements) {
        return matrix.elements;
    }

    throw new Error('Unsupported matrix shape');
};

export const math = {
    clamp: THREE.MathUtils.clamp,
    lerp: THREE.MathUtils.lerp,
    DEG_TO_RAD,
    RAD_TO_DEG
};

export class Vec2 extends THREE.Vector2 {
    constructor(x = 0, y = 0) {
        if (Array.isArray(x)) {
            super(x[0] ?? 0, x[1] ?? 0);
            return;
        }

        super(x, y);
    }

    clone() {
        return new Vec2(this.x, this.y);
    }

    copy(rhs: Vector2Like) {
        this.x = rhs.x;
        this.y = rhs.y;
        return this;
    }
}

export class Vec3 extends THREE.Vector3 {
    static readonly ZERO = Object.freeze(new Vec3(0, 0, 0));

    static readonly ONE = Object.freeze(new Vec3(1, 1, 1));

    static readonly UP = Object.freeze(new Vec3(0, 1, 0));

    static readonly DOWN = Object.freeze(new Vec3(0, -1, 0));

    static readonly LEFT = Object.freeze(new Vec3(-1, 0, 0));

    static readonly RIGHT = Object.freeze(new Vec3(1, 0, 0));

    static readonly FORWARD = Object.freeze(new Vec3(0, 0, -1));

    static readonly BACK = Object.freeze(new Vec3(0, 0, 1));

    constructor(x = 0, y = 0, z = 0) {
        if (Array.isArray(x)) {
            super(x[0] ?? 0, x[1] ?? 0, x[2] ?? 0);
            return;
        }

        super(x, y, z);
    }

    add(rhs: Vector3Like) {
        this.x += rhs.x;
        this.y += rhs.y;
        this.z += rhs.z;
        return this;
    }

    add2(lhs: Vector3Like, rhs: Vector3Like) {
        this.x = lhs.x + rhs.x;
        this.y = lhs.y + rhs.y;
        this.z = lhs.z + rhs.z;
        return this;
    }

    addScalar(scalar: number) {
        this.x += scalar;
        this.y += scalar;
        this.z += scalar;
        return this;
    }

    addScaled(rhs: Vector3Like, scalar: number) {
        this.x += rhs.x * scalar;
        this.y += rhs.y * scalar;
        this.z += rhs.z * scalar;
        return this;
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    copy(rhs: Vector3Like) {
        this.x = rhs.x;
        this.y = rhs.y;
        this.z = rhs.z;
        return this;
    }

    cross(rhs: Vector3Like): this;
    cross(lhs: Vector3Like, rhs: Vector3Like): this;
    cross(a: Vector3Like, b?: Vector3Like) {
        if (b) {
            return this.crossVectors(a as THREE.Vector3, b as THREE.Vector3) as this;
        }

        return super.cross(a as THREE.Vector3) as this;
    }

    div(rhs: Vector3Like) {
        this.x /= rhs.x;
        this.y /= rhs.y;
        this.z /= rhs.z;
        return this;
    }

    div2(lhs: Vector3Like, rhs: Vector3Like) {
        this.x = lhs.x / rhs.x;
        this.y = lhs.y / rhs.y;
        this.z = lhs.z / rhs.z;
        return this;
    }

    mul(rhs: Vector3Like) {
        this.x *= rhs.x;
        this.y *= rhs.y;
        this.z *= rhs.z;
        return this;
    }

    mul2(lhs: Vector3Like, rhs: Vector3Like) {
        this.x = lhs.x * rhs.x;
        this.y = lhs.y * rhs.y;
        this.z = lhs.z * rhs.z;
        return this;
    }

    mulScalar(scalar: number) {
        return this.multiplyScalar(scalar) as this;
    }

    scale(scalar: number) {
        return this.mulScalar(scalar);
    }

    sub(rhs: Vector3Like) {
        this.x -= rhs.x;
        this.y -= rhs.y;
        this.z -= rhs.z;
        return this;
    }

    sub2(lhs: Vector3Like, rhs: Vector3Like) {
        this.x = lhs.x - rhs.x;
        this.y = lhs.y - rhs.y;
        this.z = lhs.z - rhs.z;
        return this;
    }

    lerp(v: Vector3Like, alpha: number): this;
    lerp(lhs: Vector3Like, rhs: Vector3Like, alpha: number): this;
    lerp(a: Vector3Like, b: Vector3Like | number, c?: number) {
        if (typeof b === 'number') {
            return super.lerp(a as THREE.Vector3, b) as this;
        }

        const alpha = c ?? 0;
        this.x = a.x + (b.x - a.x) * alpha;
        this.y = a.y + (b.y - a.y) * alpha;
        this.z = a.z + (b.z - a.z) * alpha;
        return this;
    }
}

export class Vec4 extends THREE.Vector4 {
    constructor(x = 0, y = 0, z = 0, w = 0) {
        if (Array.isArray(x)) {
            super(x[0] ?? 0, x[1] ?? 0, x[2] ?? 0, x[3] ?? 0);
            return;
        }

        super(x, y, z, w);
    }

    clone() {
        return new Vec4(this.x, this.y, this.z, this.w);
    }

    copy(rhs: Vector4Like) {
        this.x = rhs.x;
        this.y = rhs.y;
        this.z = rhs.z;
        this.w = rhs.w;
        return this;
    }
}

export class Quat extends THREE.Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        if (Array.isArray(x)) {
            super(x[0] ?? 0, x[1] ?? 0, x[2] ?? 0, x[3] ?? 1);
            return;
        }

        super(x, y, z, w);
    }

    clone() {
        return new Quat(this.x, this.y, this.z, this.w);
    }

    copy(rhs: QuaternionLike) {
        this.x = rhs.x;
        this.y = rhs.y;
        this.z = rhs.z;
        this.w = rhs.w;
        return this;
    }

    invert(src: QuaternionLike = this) {
        if (src !== this) {
            this.copy(src);
        }

        return super.invert() as this;
    }

    mul(rhs: QuaternionLike) {
        return super.multiply(rhs as THREE.Quaternion) as this;
    }

    mul2(lhs: QuaternionLike, rhs: QuaternionLike) {
        return super.multiplyQuaternions(lhs as THREE.Quaternion, rhs as THREE.Quaternion) as this;
    }

    normalize(src: QuaternionLike = this) {
        if (src !== this) {
            this.copy(src);
        }

        return super.normalize() as this;
    }

    setFromEulerAngles(ex: number | Vector3Like, ey?: number, ez?: number) {
        if (typeof ex !== 'number') {
            return this.setFromEulerAngles(ex.x, ex.y, ex.z);
        }

        const euler = new THREE.Euler(ex * DEG_TO_RAD, (ey ?? 0) * DEG_TO_RAD, (ez ?? 0) * DEG_TO_RAD, 'XYZ');
        return super.setFromEuler(euler) as this;
    }

    setFromMat4(matrix: MatrixLike) {
        const mat4 = new THREE.Matrix4().fromArray(getMatrixElements(matrix));
        return super.setFromRotationMatrix(mat4) as this;
    }

    slerp(qb: QuaternionLike, t: number): this;
    slerp(lhs: QuaternionLike, rhs: QuaternionLike, alpha: number): this;
    slerp(a: QuaternionLike, b: QuaternionLike | number, c?: number) {
        if (typeof b === 'number') {
            return super.slerp(a as THREE.Quaternion, b) as this;
        }

        this.copy(a);
        return super.slerp(b as THREE.Quaternion, c ?? 0) as this;
    }

    transformVector(vec: Vector3Like, res = new Vec3()) {
        return res.copy(vec).applyQuaternion(this);
    }
}

export class Mat4 extends THREE.Matrix4 {
    get data() {
        return this.elements;
    }

    clone() {
        return new Mat4().copy(this);
    }

    copy(rhs: MatrixLike) {
        this.elements.set(getMatrixElements(rhs));
        return this;
    }

    invert(src: MatrixLike = this) {
        if (src !== this) {
            this.copy(src);
        }

        return super.invert() as this;
    }

    mul(rhs: MatrixLike) {
        return this.mul2(this, rhs);
    }

    mul2(lhs: MatrixLike, rhs: MatrixLike) {
        const left = new THREE.Matrix4().fromArray(getMatrixElements(lhs));
        const right = new THREE.Matrix4().fromArray(getMatrixElements(rhs));
        return super.multiplyMatrices(left, right) as this;
    }

    setTRS(t: Vector3Like, r: QuaternionLike, s: Vector3Like) {
        return super.compose(
            new THREE.Vector3(t.x, t.y, t.z),
            new THREE.Quaternion(r.x, r.y, r.z, r.w),
            new THREE.Vector3(s.x, s.y, s.z)
        ) as this;
    }

    transformPoint(vec: Vector3Like, res = new Vec3()) {
        const m = this.elements;
        const { x, y, z } = vec;
        res.x = x * m[0] + y * m[4] + z * m[8] + m[12];
        res.y = x * m[1] + y * m[5] + z * m[9] + m[13];
        res.z = x * m[2] + y * m[6] + z * m[10] + m[14];
        return res;
    }

    transformVector(vec: Vector3Like, res = new Vec3()) {
        const m = this.elements;
        const { x, y, z } = vec;
        res.x = x * m[0] + y * m[4] + z * m[8];
        res.y = x * m[1] + y * m[5] + z * m[9];
        res.z = x * m[2] + y * m[6] + z * m[10];
        return res;
    }
}

const tmpMin = new Vec3();
const tmpMax = new Vec3();

export class BoundingBox {
    center = new Vec3();

    halfExtents = new Vec3(0.5, 0.5, 0.5);

    private readonly min = new Vec3();

    private readonly max = new Vec3();

    constructor(center?: Vector3Like, halfExtents?: Vector3Like) {
        if (center) {
            this.center.copy(center);
        }

        if (halfExtents) {
            this.halfExtents.copy(halfExtents);
        }
    }

    add(other: BoundingBox) {
        const tc = this.center;
        const th = this.halfExtents;
        let tminx = tc.x - th.x;
        let tmaxx = tc.x + th.x;
        let tminy = tc.y - th.y;
        let tmaxy = tc.y + th.y;
        let tminz = tc.z - th.z;
        let tmaxz = tc.z + th.z;

        const oc = other.center;
        const oh = other.halfExtents;
        const ominx = oc.x - oh.x;
        const omaxx = oc.x + oh.x;
        const ominy = oc.y - oh.y;
        const omaxy = oc.y + oh.y;
        const ominz = oc.z - oh.z;
        const omaxz = oc.z + oh.z;

        if (ominx < tminx) tminx = ominx;
        if (omaxx > tmaxx) tmaxx = omaxx;
        if (ominy < tminy) tminy = ominy;
        if (omaxy > tmaxy) tmaxy = omaxy;
        if (ominz < tminz) tminz = ominz;
        if (omaxz > tmaxz) tmaxz = omaxz;

        tc.x = (tminx + tmaxx) * 0.5;
        tc.y = (tminy + tmaxy) * 0.5;
        tc.z = (tminz + tmaxz) * 0.5;
        th.x = (tmaxx - tminx) * 0.5;
        th.y = (tmaxy - tminy) * 0.5;
        th.z = (tmaxz - tminz) * 0.5;
        return this;
    }

    clone() {
        return new BoundingBox(this.center, this.halfExtents);
    }

    copy(src: BoundingBox) {
        this.center.copy(src.center);
        this.halfExtents.copy(src.halfExtents);
        return this;
    }

    getMax() {
        return this.max.copy(this.center).add(this.halfExtents);
    }

    getMin() {
        return this.min.copy(this.center).sub(this.halfExtents);
    }

    setMinMax(min: Vector3Like, max: Vector3Like) {
        this.center.add2(max, min).mulScalar(0.5);
        this.halfExtents.sub2(max, min).mulScalar(0.5);
        return this;
    }

    setFromTransformedAabb(aabb: BoundingBox, matrix: MatrixLike, ignoreScale = false) {
        const ac = aabb.center;
        const ar = aabb.halfExtents;
        const d = getMatrixElements(matrix);

        let mx0 = d[0];
        let mx1 = d[4];
        let mx2 = d[8];
        let my0 = d[1];
        let my1 = d[5];
        let my2 = d[9];
        let mz0 = d[2];
        let mz1 = d[6];
        let mz2 = d[10];

        if (ignoreScale) {
            let lengthSq = mx0 * mx0 + mx1 * mx1 + mx2 * mx2;
            if (lengthSq > 0) {
                const invLength = 1 / Math.sqrt(lengthSq);
                mx0 *= invLength;
                mx1 *= invLength;
                mx2 *= invLength;
            }

            lengthSq = my0 * my0 + my1 * my1 + my2 * my2;
            if (lengthSq > 0) {
                const invLength = 1 / Math.sqrt(lengthSq);
                my0 *= invLength;
                my1 *= invLength;
                my2 *= invLength;
            }

            lengthSq = mz0 * mz0 + mz1 * mz1 + mz2 * mz2;
            if (lengthSq > 0) {
                const invLength = 1 / Math.sqrt(lengthSq);
                mz0 *= invLength;
                mz1 *= invLength;
                mz2 *= invLength;
            }
        }

        this.center.set(
            d[12] + mx0 * ac.x + mx1 * ac.y + mx2 * ac.z,
            d[13] + my0 * ac.x + my1 * ac.y + my2 * ac.z,
            d[14] + mz0 * ac.x + mz1 * ac.y + mz2 * ac.z
        );

        this.halfExtents.set(
            Math.abs(mx0) * ar.x + Math.abs(mx1) * ar.y + Math.abs(mx2) * ar.z,
            Math.abs(my0) * ar.x + Math.abs(my1) * ar.y + Math.abs(my2) * ar.z,
            Math.abs(mz0) * ar.x + Math.abs(mz1) * ar.y + Math.abs(mz2) * ar.z
        );

        return this;
    }

    toBox3(target = new THREE.Box3()) {
        return target.set(tmpMin.copy(this.getMin()), tmpMax.copy(this.getMax()));
    }
}
