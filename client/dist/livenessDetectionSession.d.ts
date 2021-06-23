import { Observable } from "rxjs";
import { FaceRecognition } from "./faceRecognition";
import { Face, FaceCaptureSettings, LiveFaceCapture, LivenessDetectionSessionResult } from "./faceDetection";
import { FaceCaptureUI } from "./faceDetectionUI";
import { Bearing, FaceRequirements, Size } from "./types";
import { Angle, AngleBearingEvaluation, AngleSmoothing, CircularBuffer, Rect, RectSmoothing } from "./utils";
import { FaceDetector } from "./faceDetector";
export declare type FaceRequirementListener = {
    onChange: (requirements: FaceRequirements) => void;
};
export declare class LivenessDetectionSession {
    readonly ui: FaceCaptureUI;
    readonly faceBuffer: CircularBuffer<Face>;
    readonly faces: CircularBuffer<Face>;
    private faceDetected;
    private faceAlignmentStatus;
    private fixTime;
    private alignedFaceCount;
    private angleHistory;
    private bearingGenerator;
    bearingIterator: IteratorResult<unknown, any>;
    private previousBearing;
    private closed;
    readonly startTime: number;
    readonly angleBearingEvaluation: AngleBearingEvaluation;
    readonly faceBoundsSmoothing: RectSmoothing;
    readonly faceAngleSmoothing: AngleSmoothing;
    readonly settings: FaceCaptureSettings;
    readonly faceRecognition: FaceRecognition;
    private hasFaceBeenAligned;
    private mediaRecorder;
    private videoType;
    readonly controlFaceCaptures: LiveFaceCapture[];
    faceDetector: FaceDetector;
    private faceRequirementListeners;
    private imageSize;
    private pendingFaceRequirementsNotificationBearing;
    private videoTrack;
    private previousFaceAngle;
    constructor(settings: FaceCaptureSettings, faceRecognition: FaceRecognition);
    readonly registerFaceRequirementListener: (listener: FaceRequirementListener) => void;
    readonly unregisterFaceRequirementListener: (listener: FaceRequirementListener) => void;
    private notifyFaceRequirementListeners;
    setupVideo: () => Promise<void>;
    protected cleanup: () => void;
    nextCaptureBearing(): IterableIterator<Bearing>;
    protected selectNextBearing: (availableBearings: Bearing[]) => Bearing;
    readonly faceAngleMatchesRequirements: (angle: Angle, requirements: FaceRequirements) => boolean;
    readonly faceRequirements: (imageSize: Size, bearing?: Bearing) => FaceRequirements;
    readonly isFaceFixedInImageSize: (actualFaceBounds: Rect, imageSize: Size) => boolean;
    readonly detectFacePresence: (capture: LiveFaceCapture) => LiveFaceCapture;
    readonly detectFaceAlignment: (capture: LiveFaceCapture) => LiveFaceCapture;
    readonly detectSpoofAttempt: (capture: LiveFaceCapture) => LiveFaceCapture;
    private movedTooFast;
    private movedOpposite;
    readonly createFaceCapture: (capture: LiveFaceCapture) => Observable<LiveFaceCapture>;
    private compareControlFacesToCaptureFaces;
    readonly resultFromCaptures: (captures: LiveFaceCapture[]) => Observable<LivenessDetectionSessionResult>;
    readonly onVideoSize: (videoSize: Size) => void;
    readonly onMediaStreamAvailable: (stream: MediaStream) => void;
    private getVideoURL;
    readonly close: () => void;
}
export declare class MockLivenessDetectionSession extends LivenessDetectionSession {
    setupVideo: () => Promise<void>;
}
