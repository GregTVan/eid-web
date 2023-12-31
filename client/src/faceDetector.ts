'use strict';

import { Face } from "./types";
import { FaceCapture } from "./types";
import * as faceapi from "face-api.js/build/es6"
import { estimateFaceAngle } from "./faceAngle"
import { estimateFaceAngle as estimateFaceAngleNoseTip } from "./faceAngleNoseTip"
import { canvasFromImageSource, sizeOfImageSource, blobFromImageSource } from "./utils"
import { Rect } from "./types";
import { Point } from "./types";
import { Angle } from "./types";
import { ImageSource, Size } from "./types"

/**
 * @category Face detection
 */
export type FaceDetectionSource = {
    element: ImageSource
    mirrored: boolean
}
/**
 * @category Face detection
 */
export interface FaceDetector {
    detectFace(source: FaceDetectionSource): Promise<FaceCapture>
}
/**
 * @category Face detection
 */
export interface FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>
}

interface FaceApiFace {
    landmarks: {
        positions: {x:number,y:number}[]
        getLeftEye(): Point[]
        getRightEye(): Point[]
    }
}

/**
 * @category Face detection
 */
export class VerIDFaceDetector implements FaceDetector {

    detectFace = async (source: FaceDetectionSource): Promise<FaceCapture> => {
        const src = source.element instanceof HTMLVideoElement || source.element instanceof HTMLImageElement || source.element instanceof HTMLCanvasElement ? source.element : await canvasFromImageSource(source.element)
        const faceApiFace = await faceapi.detectSingleFace(src, new faceapi.TinyFaceDetectorOptions({"inputSize": 128})).withFaceLandmarks()
        let face: Face|null
        if (faceApiFace) {
            face = this.faceApiFaceToVerIDFace(faceApiFace, (await sizeOfImageSource(source.element)).width, source.mirrored)
        } else {
            face = null
        }
        const image: Blob = await blobFromImageSource(source.element)
        return FaceCapture.create(image, face)
    }

    private calculateFaceAngle(face: FaceApiFace): Angle {
        const landmarks: Point[] = face.landmarks.positions.map((pt: {x:number,y:number}) => new Point(pt.x, pt.y))
        return estimateFaceAngle(landmarks, estimateFaceAngleNoseTip)
    }

    private faceApiFaceToVerIDFace(face: FaceApiFace, imageWidth: number, mirrorOutput = false): Face {
        const angle: Angle = this.calculateFaceAngle(face)
        const leftEye: Point[] = face.landmarks.getLeftEye()
        const rightEye: Point[] = face.landmarks.getRightEye()
        const leftEyeCentre: Point = {
            "x": leftEye[0].x + (leftEye[3].x - leftEye[0].x) / 2,
            "y": leftEye[0].y + (leftEye[3].y - leftEye[0].y) / 2
        }
        const rightEyeCentre: Point = {
            "x": rightEye[0].x + (rightEye[3].x - rightEye[0].x) / 2,
            "y": rightEye[0].y + (rightEye[3].y - rightEye[0].y) / 2
        }
        const distanceBetweenEyes: number = Math.sqrt(Math.pow(rightEyeCentre.x - leftEyeCentre.x, 2) + Math.pow(rightEyeCentre.y - leftEyeCentre.y, 2))
        const ovalCentre: Point = {
            "x": leftEyeCentre.x + (rightEyeCentre.x - leftEyeCentre.x) / 2,
            "y": leftEyeCentre.y + (rightEyeCentre.y - leftEyeCentre.y) / 2
        }
        const ovalSize: Size = {
            "width": distanceBetweenEyes * 3,
            "height": 0
        }
        ovalSize.height = ovalSize.width / 4 * 5
        if (mirrorOutput) {
            ovalCentre.x = imageWidth - ovalCentre.x
            angle.yaw = 0-angle.yaw
        }
        ovalCentre.y += ovalSize.height * 0.04
        const veridFace: Face = new Face(new Rect(ovalCentre.x - ovalSize.width / 2, ovalCentre.y - ovalSize.height / 2, ovalSize.width, ovalSize.height), angle)
        if (mirrorOutput) {
            veridFace.bounds = veridFace.bounds.mirrored(imageWidth)
        }
        return veridFace
    }
}

/**
 * @category Face detection testing
 */
export class VerIDFaceDetectorFactory implements FaceDetectorFactory {

    createFaceDetector = async(): Promise<FaceDetector> => {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/node_modules/@appliedrecognition/ver-id-browser/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/node_modules/@appliedrecognition/ver-id-browser/models")
        ])
        return new VerIDFaceDetector()
    }
}