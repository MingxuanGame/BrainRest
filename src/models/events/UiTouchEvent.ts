import type {UiEvent} from './UiEvent'

/** Touch interaction event data */
export interface UiTouchEvent extends UiEvent {
    /** Discriminant literal */
    type: 'touchstart' | 'touchend' | 'touchmove'
    /** Unique touch point identifier */
    identifier: number
    /** X coordinate relative to the viewport */
    clientX: number
    /** Y coordinate relative to the viewport */
    clientY: number
    /** Normalised pressure (0..1) */
    force: number
    /** Radius of the touch ellipse along the X axis */
    radiusX: number
    /** Radius of the touch ellipse along the Y axis */
    radiusY: number
    /** Rotation angle of the touch ellipse in degrees */
    rotationAngle: number
}
