'use strict';

import { LivenessDetectionSessionSettings } from "./livenessDetectionSession";
import { Angle, Axis, Bearing, ImageSource, Rect, Size } from "./types"
import { Subscriber } from "rxjs"

/**
 * Circular (ring) buffer implementation
 * 
 * @typeParam Type - Type of value the buffer contains
 * @internal
 */
export class CircularBuffer<Type> {
    private buffer: Array<Type> = []
    private capacity: number
    /**
     * Constructor
     * @param capacity Capacity of the buffer
     */
    constructor(capacity: number) {
        this.capacity = capacity
    }
    /**
     * Enqueue (add) an element into the buffer
     * 
     * If the buffer is full the first value in the buffer will be discarded
     * @param value Element to add to the buffer
     */
    enqueue(value: Type) {
        if (this.buffer.length == this.capacity) {
            this.buffer.shift()
        }
        this.buffer.push(value)
    }
    /**
     * Dequeue (remove) the first element from the buffer and return it
     * @returns First element in the buffer or `null` if the buffer is empty
     */
    dequeue(): Type|undefined {
        if (this.buffer.length == 0) {
            return undefined
        }
        return this.buffer.shift()
    }
    /**
     * Number of elements in the buffer
     */
    get length(): number {
        return this.buffer.length
    }
    /**
     * `true` if the buffer is empty
     */
    get isEmpty(): boolean {
        return this.buffer.length == 0
    }
    /**
     * Last element in the buffer or `undefined` if the buffer is empty
     */
    get lastElement(): Type|undefined {
        if (this.buffer.length > 0) {
            return this.buffer[this.buffer.length-1]
        }
        return undefined
    }
    /**
     * `true` if the buffer is full
     */
    get isFull(): boolean {
        return this.buffer.length == this.capacity
    }
    /**
     * Get an element in the buffer
     * @param index Index of the element 
     * @returns Element at the given index or `undefined` if the buffer doesn't contain an element at the given index
     */
    get(index: number): Type|undefined {
        if (index < 0 || index >= this.buffer.length) {
            return undefined
        }
        return this.buffer[index]
    }
    /**
     * Clear the buffer
     */
    clear() {
        this.buffer = []
    }
    /**
     * @param fn Function to use for reducing the buffer to a single value
     * @returns Result of applying the supplied function to each element of the array
     */
    reduce(fn: (previousValue: Type, currentValue: Type, currentIndex: number, array: Type[]) => Type) {
        if (this.buffer.length == 0) {
            return null
        }
        if (this.buffer.length == 1) {
            return this.buffer[0]
        }
        return this.buffer.reduce(fn)
    }
}

/**
 * Evaluates angles in relation to bearings
 * @internal
 */
export class AngleBearingEvaluation {

    settings: LivenessDetectionSessionSettings
    pitchThresholdTolerance: number
    yawThresholdTolerance: number

    constructor(settings: LivenessDetectionSessionSettings, pitchThresholdTolerance: number, yawThresholdTolerance: number) {
        this.settings = settings
        this.pitchThresholdTolerance = pitchThresholdTolerance
        this.yawThresholdTolerance = yawThresholdTolerance
    }

    thresholdAngleForAxis(axis: Axis): number {
        if (axis == Axis.PITCH) {
            return this.settings.pitchThreshold
        } else {
            return this.settings.yawThreshold
        }
    }

    angleForBearing(bearing: Bearing): Angle {
        const pitchDistance: number = this.thresholdAngleForAxis(Axis.PITCH)
        const yawDistance: number = this.thresholdAngleForAxis(Axis.YAW)
        const angle = new Angle()
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - pitchDistance
                break
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = pitchDistance
                break
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = yawDistance
                break;
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - yawDistance
                break
        }
        return angle
    }

    thresholdAngleToleranceForAxis(axis: Axis): number {
        if (axis == Axis.PITCH) {
            return this.pitchThresholdTolerance
        } else {
            return this.yawThresholdTolerance
        }
    }

    angleMatchesBearing(angle: Angle, bearing: Bearing): boolean {
        const minAngle: Angle = this.minAngleForBearing.call(this, bearing)
        const maxAngle: Angle = this.maxAngleForBearing.call(this, bearing)
        return angle.pitch > minAngle.pitch && angle.pitch < maxAngle.pitch && angle.yaw > minAngle.yaw && angle.yaw < maxAngle.yaw
    }

    isAngleBetweenBearings(angle: Angle, fromBearing: Bearing, toBearing: Bearing): boolean {
        if (this.angleMatchesBearing(angle, fromBearing) || this.angleMatchesBearing(angle, toBearing)) {
            return true
        }
        const fromAngle: Angle = this.angleForBearing(fromBearing)
        const toAngle: Angle = this.angleForBearing(toBearing)
        const radius: number = Math.max(this.thresholdAngleForAxis(Axis.PITCH), this.thresholdAngleForAxis(Axis.YAW))
        const angleRad: number = Math.atan2(toAngle.pitch-fromAngle.pitch, toAngle.yaw-fromAngle.yaw) + Math.PI*0.5
        const cosRad: number = Math.cos(angleRad) * radius
        const sinRad: number = Math.sin(angleRad) * radius
        const startRight: Angle = new Angle(fromAngle.yaw + cosRad, fromAngle.pitch + sinRad)
        const startLeft: Angle = new Angle(fromAngle.yaw - cosRad, fromAngle.pitch - sinRad)
        const endRight: Angle = new Angle(toAngle.yaw + cosRad, toAngle.pitch + sinRad)
        const endLeft: Angle = new Angle(toAngle.yaw - cosRad, toAngle.pitch - sinRad)
        const isNotRightOfRight = !this.isPointToRightOfPlaneBetweenPoints(angle, startRight, endRight)
        const isLeftOfLeft = this.isPointToRightOfPlaneBetweenPoints(angle, startLeft, endLeft)
        const isRightOfStart = this.isPointToRightOfPlaneBetweenPoints(angle, startRight, startLeft)
        const isInsideCircle = this.isPointInsideCircleCentredInPointWithRadius(angle, fromAngle, radius)
        return isNotRightOfRight && isLeftOfLeft && (isRightOfStart || isInsideCircle)
    }

    offsetFromAngleToBearing(angle: Angle, bearing: Bearing): Angle {
        const result: Angle = new Angle()
        if (!this.angleMatchesBearing(angle, bearing)) {
            const bearingAngle: Angle = this.angleForBearing(bearing)
            result.yaw = (bearingAngle.yaw - angle.yaw) / (this.thresholdAngleForAxis(Axis.YAW) + this.thresholdAngleToleranceForAxis(Axis.YAW))
            result.pitch = (bearingAngle.pitch - angle.pitch) / (this.thresholdAngleForAxis(Axis.PITCH) + this.thresholdAngleToleranceForAxis(Axis.PITCH))
        }
        return result
    }

    private isPointToRightOfPlaneBetweenPoints(angle: Angle, start: Angle, end: Angle): boolean {
        const d: number = (angle.yaw - start.yaw) * (end.pitch - start.pitch) - (angle.pitch - start.pitch) * (end.yaw - start.yaw)
        return d <= 0
    }

    isPointInsideCircleCentredInPointWithRadius(angle: Angle, centre: Angle, radius: number): boolean {
        return Math.hypot(angle.yaw-centre.yaw, angle.pitch-centre.pitch) < radius
    }

    minAngleForBearing(bearing: Bearing): Angle {
        const pitchDistance: number = this.thresholdAngleForAxis(Axis.PITCH)
        const pitchTolerance: number = this.thresholdAngleToleranceForAxis(Axis.PITCH)
        const yawDistance: number = this.thresholdAngleForAxis(Axis.YAW)
        const yawTolerance: number = this.thresholdAngleToleranceForAxis(Axis.YAW)
        const angle: Angle = new Angle()
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = Number.NEGATIVE_INFINITY
                break
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = pitchDistance - pitchTolerance
                break
            default:
                angle.pitch = 0 - pitchDistance + pitchTolerance
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = yawDistance - yawTolerance
                break
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = Number.NEGATIVE_INFINITY
                break
            default:
                angle.yaw = 0 - yawDistance + yawTolerance
        }
        return angle
    }

    maxAngleForBearing(bearing: Bearing): Angle {
        const pitchDistance: number = this.thresholdAngleForAxis(Axis.PITCH)
        const pitchTolerance: number = this.thresholdAngleToleranceForAxis(Axis.PITCH)
        const yawDistance: number = this.thresholdAngleForAxis(Axis.YAW)
        const yawTolerance: number = this.thresholdAngleToleranceForAxis(Axis.YAW)
        const angle: Angle = new Angle()
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - pitchDistance + pitchTolerance
                break
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = Number.POSITIVE_INFINITY
                break
            default:
                angle.pitch = pitchDistance - pitchTolerance
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = Number.POSITIVE_INFINITY
                break
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - yawDistance + yawTolerance
                break
            default:
                angle.yaw = yawDistance - yawTolerance
        }
        return angle
    }
}

/**
 * @internal
 */
export class Smoothing {
    buffer: CircularBuffer<number>
    private _smoothedValue: number|undefined

    constructor(bufferSize: number) {
        this.buffer = new CircularBuffer(bufferSize)
    }

    addSample(value: number) {
        this.buffer.enqueue(value)
        this._smoothedValue = this.calculateSmoothedValue()
    }

    removeFirstSample(): number|undefined {
        return this.buffer.dequeue()
    }

    get smoothedValue(): number|undefined {
        return this._smoothedValue
    }

    private calculateSmoothedValue(): number|undefined {
        if (this.buffer.length == 0) {
            return undefined
        }
        const val: number|null = this.buffer.reduce(function(previous, next) {
            return previous + next
        })
        if (val) {
            return val / this.buffer.length
        }
        return undefined;
    }

    reset() {
        this.buffer.clear()
        this._smoothedValue = undefined
    }
}

/**
 * @internal
 */
export type ObservableNextEvent<T> = {
    type: "next",
    value: T
}

/**
 * @internal
 */
export type ObservableErrorEvent = {
    type: "error",
    error: any
}

/**
 * @internal
 */
export type ObservableCompleteEvent = {
    type: "complete"
}

type ObservableEvent<T> = ObservableNextEvent<T> | ObservableErrorEvent | ObservableCompleteEvent

/**
 * @internal
 */
export function emitRxEvent<T>(subscriber: Subscriber<T>, event: ObservableEvent<T>): void {
    if (subscriber.closed) {
        return
    }
    if (event.type == "next") {
        subscriber.next((event as ObservableNextEvent<T>).value)
    } else if (event.type == "error") {
        subscriber.error((event as ObservableErrorEvent).error)
    } else if (event.type == "complete") {
        subscriber.complete()
    }
}

/**
 * @internal
 */
export class RectSmoothing {

    private xSmoothing: Smoothing
    private ySmoothing: Smoothing
    private widthSmoothing: Smoothing
    private heightSmoothing: Smoothing
    private _smoothedValue: Rect|undefined

    constructor(bufferSize: number) {
        this.xSmoothing = new Smoothing(bufferSize)
        this.ySmoothing = new Smoothing(bufferSize)
        this.widthSmoothing = new Smoothing(bufferSize)
        this.heightSmoothing = new Smoothing(bufferSize)
    }

    addSample(value: Rect) {
        this.xSmoothing.addSample(value.x)
        this.ySmoothing.addSample(value.y)
        this.widthSmoothing.addSample(value.width)
        this.heightSmoothing.addSample(value.height)
        this._smoothedValue = this.calculateSmoothedValue()
    }

    get smoothedValue(): Rect|undefined {
        return this._smoothedValue
    }

    reset() {
        this.xSmoothing.reset()
        this.ySmoothing.reset()
        this.widthSmoothing.reset()
        this.heightSmoothing.reset()
        this._smoothedValue = undefined
    }

    removeFirstSample() {
        this.xSmoothing.removeFirstSample()
        this.ySmoothing.removeFirstSample()
        this.widthSmoothing.removeFirstSample()
        this.heightSmoothing.removeFirstSample()
    }
    
    private calculateSmoothedValue(): Rect|undefined {
        if (this.xSmoothing.smoothedValue === undefined || this.ySmoothing.smoothedValue === undefined || this.widthSmoothing.smoothedValue === undefined || this.heightSmoothing.smoothedValue === undefined) {
            return undefined
        }
        return new Rect(
            this.xSmoothing.smoothedValue,
            this.ySmoothing.smoothedValue,
            this.widthSmoothing.smoothedValue,
            this.heightSmoothing.smoothedValue
        )
    }
}

/**
 * @internal
 */
export class AngleSmoothing {
    
    private yawSmoothing: Smoothing
    private pitchSmoothing: Smoothing
    private _smoothedValue: Angle|undefined

    constructor(bufferSize: number) {
        this.yawSmoothing = new Smoothing(bufferSize)
        this.pitchSmoothing = new Smoothing(bufferSize)
        this._smoothedValue = undefined
    }

    private calculateSmoothedValue(): Angle|undefined {
        if (this.yawSmoothing.smoothedValue === undefined) {
            return undefined
        }
        return new Angle(
            this.yawSmoothing.smoothedValue,
            this.pitchSmoothing.smoothedValue
        )
    }

    get smoothedValue(): Angle|undefined {
        return this._smoothedValue
    }

    addSample(value: Angle) {
        this.yawSmoothing.addSample(value.yaw)
        this.pitchSmoothing.addSample(value.pitch)
        this._smoothedValue = this.calculateSmoothedValue()
    }

    reset() {
        this.yawSmoothing.reset()
        this.pitchSmoothing.reset()
        this._smoothedValue = undefined
    }

    removeFirstSample() {
        this.yawSmoothing.removeFirstSample()
        this.pitchSmoothing.removeFirstSample()
    }
}

/**
 * Clamp a number so that it's between {@code 0-limit} and {@code limit}
 * @param a Number to clamp
 * @param limit Value to limit the clamped number to
 * @returns Clamped number
 * @internal
 */
export function clamp(a: number, limit: number): number {
    if (a < 0-limit) {
        return 0-limit
    }
    if (a > limit) {
        return limit
    }
    return a
}

/**
 * 
 * @param imageSource 
 * @returns 
 * @internal
 */
export async function blobFromImageSource(imageSource: ImageSource, cropRect?: Rect): Promise<Blob> {
    if ((imageSource instanceof Blob) && !cropRect) {
        return Promise.resolve(imageSource)
    }
    let canvas = await canvasFromImageSource(imageSource)
    if (cropRect) {
        const context = canvas.getContext("2d")
        const imageData = context!.getImageData(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
        canvas = await canvasFromImageSource(imageData)
    }
    return canvasToBlob(canvas)
}

/**
 * 
 * @param canvas Canvas to extract the blob from
 * @returns Promise resolving to a blob containing the canvas image
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    if (!canvas) {
        return Promise.reject(new Error("Invalid canvas"))
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob: Blob|null) => {
            if (blob) {
                resolve(blob)
            } else {
                reject(new Error("Failed to convert canvas to blob"))
            }
        })
    })
}

/**
 * Resize image
 * @param image Blob containing an image 
 * @param maxSize The image will be scaled so that its longer side is at most maxSize
 * @returns Promise resolving to a blob containing the resized image
 * @internal
 */
export async function resizeImage(image: ImageData, maxSize: number): Promise<ImageData> {
    const scale: number = Math.min(maxSize / Math.max(image.width, image.height), 1)
    if (scale <= 1) {
        return image
    }
    let canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height
    let context = canvas.getContext("2d")
    context!.putImageData(image, 0, 0)
    const blob = await canvasToBlob(canvas)
    const imgSrc = URL.createObjectURL(blob)
    try {
        const width = image.width * scale
        const height = image.height * scale
        const img = await loadImage(imgSrc)
        canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        context = canvas.getContext("2d")
        context!.drawImage(img, 0, 0, width, height)
        return context!.getImageData(0, 0, width, height)
    } finally {
        URL.revokeObjectURL(imgSrc)
    }
}

export async function cropImage(imageSource: ImageSource, cropRect?: Rect): Promise<Blob> {
    const canvas = await canvasFromImageSource(imageSource, cropRect)
    return canvasToBlob(canvas)
}

/**
 * 
 * @param imageSource 
 * @returns 
 * @internal
 */
export async function canvasFromImageSource(imageSource: ImageSource, cropRect?: Rect): Promise<HTMLCanvasElement> {
    if (imageSource instanceof HTMLCanvasElement) {
        return imageSource
    }
    const imageSize = await sizeOfImageSource(imageSource)
    if (!cropRect) {
        cropRect = new Rect(0, 0, imageSize.width, imageSize.height)
    }
    const canvas = document.createElement("canvas")
    canvas.width = cropRect.width
    canvas.height = cropRect.height
    const context = canvas.getContext("2d")
    if (imageSource instanceof ImageData) {
        context!.putImageData(imageSource, 0-cropRect.x, 0-cropRect.y)
    } else if (imageSource instanceof HTMLImageElement || imageSource instanceof HTMLVideoElement) {
        context!.drawImage(imageSource, 0-cropRect.x, 0-cropRect.y)
    } else if (imageSource instanceof Blob) {
        const src = URL.createObjectURL(imageSource)
        try {
            const img = await loadImage(src)
            context!.drawImage(img, 0-cropRect.x, 0-cropRect.y)
        } finally {
            URL.revokeObjectURL(src)
        }
        return canvas
    } else if (typeof imageSource == "string") {
        const img = await loadImage(imageSource)
        context!.drawImage(img, 0-cropRect.x, 0-cropRect.y)
        return canvas
    } else {
        throw new Error("Invalid image source")
    }
    return canvas
}

/**
 * 
 * @param imageSource
 * @returns 
 * @internal
 * @deprecated
 */
export async function imageFromImageSource(imageSource: ImageSource): Promise<HTMLImageElement> {
    if (imageSource instanceof HTMLImageElement) {
        return Promise.resolve(imageSource)
    }
    const blob = await blobFromImageSource(imageSource)
    return new Promise((resolve, reject) => {
        const img = document.createElement("img")
        const reader = new FileReader()
        reader.onload = () => {
            img.src = reader.result as string
            resolve(img)
        }
        reader.onerror = () => {
            reject(new Error("Failed to load image"))
        }
        reader.readAsDataURL(blob)
    })
}

/**
 * 
 * @param imageSource 
 * @returns 
 * @internal
 */
export async function sizeOfImageSource(imageSource: ImageSource): Promise<Size> {
    if (imageSource instanceof HTMLCanvasElement) {
        return {
            "width": imageSource.width,
            "height": imageSource.height
        }
    }
    if (imageSource instanceof ImageData) {
        return {
            "width": imageSource.width,
            "height": imageSource.height
        }
    }
    if (imageSource instanceof HTMLVideoElement) {
        return {
            "width": imageSource.videoWidth,
            "height": imageSource.videoHeight
        }
    }
    const onImageSize = (image: HTMLImageElement): Size => {
        return {
            "width": image.naturalWidth,
            "height": image.naturalHeight
        }
    }
    if (imageSource instanceof HTMLImageElement) {
        await (imageSource as HTMLImageElement).decode()
        return onImageSize(imageSource as HTMLImageElement)
    } else if (imageSource instanceof Blob) {
        const src = URL.createObjectURL(imageSource as Blob)
        try {
            const img = await loadImage(src)
            return onImageSize(img)
        } finally {
            URL.revokeObjectURL(src)
        }
    } else if (typeof imageSource == "string") {
        const img = await loadImage(imageSource)
        return onImageSize(img)
    } else {
        throw new Error("Invalid image source")
    }
}

export function loadImage(src: string, image?: HTMLImageElement): Promise<HTMLImageElement> {
    if (!image) {
        image = document.createElement("img")
    }
    return new Promise((resolve, reject) => {
        image!.onload = () => {
            resolve(image!)
        }
        image!.onerror = reject
        image!.src = src
    })
}