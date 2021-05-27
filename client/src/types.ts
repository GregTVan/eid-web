import { 
    BlinkIdCombinedRecognizerResult, 
    BlinkIdRecognizerResult, 
    IdBarcodeRecognizerResult, 
    BlinkIdCombinedRecognizer, 
    BlinkIdRecognizer, 
    IdBarcodeRecognizer, 
    ImageOrientation,
    SuccessFrameGrabberRecognizer, 
    MetadataCallbacks 
} from "@microblink/blinkid-in-browser-sdk"

export type IdCaptureStatus = "pass" | "review" | "fail"

export interface IdCaptureResponse {
    error?: any
    result: {
        front?: DocumentFrontPage,
        back?: DocumentBackPage,
        passport?: PassportDocument
    }
    warnings?: Warning[]
    status: IdCaptureStatus
}
export interface Address {
    street: string
    city: string
    postalCode: string
    jurisdiction: string
}

export interface IDDocument {
    documentNumber: string
    firstName: string
    lastName: string
    warnings: Set<Warning>
    dateOfBirth: DocumentDate
    dateOfExpiry: DocumentDate
    recognizer: RecognizerType
}

export interface DatedDocument {
    dateOfIssue: DocumentDate
}

export interface ImageDocument {
    image: string
    faces: {
        x: number,
        y: number,
        width: number,
        height: number,
        quality: number,
        template: string
    }[]
    imageAnalysis: ImageQuality
    imageSize: Size
}

export interface ImageQuality {
    brightness: number
    contrast: number
    sharpness: number
}

export type RecognizerType = "BLINK_ID" | "USDL" | "PASSPORT"

export interface DocumentDate {
    day: number
    month: number
    year: number
    successfullyParsed?: boolean
    originalString?: string
}

export interface ClassInfo {
    country: string
    region: string
    type: string
    countryName: string
    isoAlpha3CountryCode: string
    isoAlpha2CountryCode: string
    isoNumericCountryCode: string
}

export interface DocumentFrontPage extends IDDocument, ImageDocument, DatedDocument {
    classInfo: ClassInfo
    fullName: string
    address: string
    authenticityScores: {[k: string]: number}
    authenticityScore: number
}

export interface DocumentBackPage extends IDDocument, DatedDocument {
    barcode: string
    issuerIdentificationNumber: string
    fullName: string
    address: Address
}

export interface PassportDocument extends IDDocument, ImageDocument {
    rawMRZString: string
    issuer: string
    nationality: string
    mrtdVerified: boolean
    recognitionStatus: string
}

export type CapturedDocument<T extends RecognizerType> = T extends "PASSPORT" ? PassportDocument : T extends "USDL" ? DocumentBackPage : DocumentFrontPage

export enum DocumentPages {
    FRONT = "front",
    BACK = "back",
    FRONT_AND_BACK = "front and back"
}

export type IdCaptureResult = {
    face?: RecognizableFace
    pages: DocumentPages
    result: SupportedRecognizerResult
    capturedImage?: {
        data: ImageData
        orientation: ImageOrientation
    }
}

export class Warning {

    readonly code: number
    readonly description: string

    constructor(code: number, description: string) {
        this.code = code
        this.description = description
    }
}

export type SupportedRecognizerResult = BlinkIdCombinedRecognizerResult|BlinkIdRecognizerResult|IdBarcodeRecognizerResult

type SupportedWrappedRecognizer = BlinkIdCombinedRecognizer|BlinkIdRecognizer|IdBarcodeRecognizer

export type SupportedRecognizer = SupportedWrappedRecognizer|SuccessFrameGrabberRecognizer<SupportedWrappedRecognizer>

export type ProgressListener = (progress: number) => void

/**
 * ID capture UI interface
 * 
 * Facilitates the implementation of a custom user interface for ID capture sessions
 */
export interface IdCaptureUI {
    /**
     * Video element to display the camera feed
     */
    readonly video: HTMLVideoElement
    /**
     * Trigger an ID capture event
     * 
     * The trigger method will be called by the ID capture throughout the session. 
     * It's up to your class to handle the triggers.
     * @param event Triggered event
     */
    trigger(event: IdCaptureEvent): void
    /**
     * Set a listener for the given event type
     * @param eventType Event type to listen for
     * @param callback Callback to be invoked when the event is triggered
     */
    on<Event extends IdCaptureEvent>(eventType: IdCaptureEventType, callback: (event: Event) => void): void
}

export type IdCaptureEvent = {
    type: IdCaptureEventType
}

export type IdCaptureProgressEvent = IdCaptureEvent & {
    progress: number
}

/**
 * ID capture event types
 */
export enum IdCaptureEventType {
    /**
     * ID capture session has been cancelled (e.g., user clicking on a cancel button)
     */
    CANCEL = "cancel",
    /**
     * Page of an ID document has been captured
     */
    PAGE_CAPTURED = "page captured",
    /**
     * ID capture session requested to capture the next page of the ID document
     */
    NEXT_PAGE_REQUESTED = "next page requested",
    /**
     * Camera is too far from the document
     */
    CAMERA_TOO_FAR = "camera too far",
    /**
     * Camera is too close to the document
     */
    CAMERA_TOO_CLOSE = "camera too close",
    /**
     * Camera is pointing at the document at an angle
     */
    CAMERA_ANGLED = "camera angled",
    /**
     * ID capture session is looking for a face on the document
     */
    FINDING_FACE = "finding face",
    /**
     * ID capture is capturing the document
     */
    CAPTURING = "capturing",
    /**
     * ID capture session ended
     */
    CAPTURE_ENDED = "capture ended",
    /**
     * ID capture session started
     */
    CAPTURE_STARTED = "capture started",
    /**
     * ID capture library loading progressed
     */
    LOADING_PROGRESSED = "loading progressed",
    /**
     * ID capture library has been loaded
     */
    LOADED = "loaded",
    /**
     * Failed to load the ID capture library
     */
    LOADING_FAILED = "loading failed"
}

/**
 * Face that contains a template that can be used for face recognition
 */
export interface RecognizableFace {
    /**
     * Distance of the face from the left side of the image (percent of image width)
     */
    x: number
    /**
     * Distance of the face from the top side of the image (percent of image height)
     */
    y: number
    /**
     * Width of the face (percent of image width)
     */
    width: number,
    /**
     * Height of the face (percent of image height)
     */
    height: number,
    /**
     * Quality of the detected face – ranges from 0 (worst) to 10 (best)
     */
    quality: number
    /**
     * Base64-encoded face recognition template
     */
    template: string
}

/**
 * Axis
 */
export enum Axis {
    /**
     * Yaw axis
     */
    YAW,
    /**
     * Pitch axis
     */
    PITCH
}

export interface Size {
    width: number,
    height: number
}

/**
 * Face alignment status
 */
export enum FaceAlignmentStatus {
    FOUND,
    FIXED,
    ALIGNED,
    MISALIGNED
}

/**
 * Bearing
 */
export enum Bearing {
    STRAIGHT,
    LEFT,
    RIGHT,
    UP,
    DOWN,
    LEFT_UP,
    RIGHT_UP,
    LEFT_DOWN,
    RIGHT_DOWN
}

export type RecognizerName = "BlinkIdCombinedRecognizer" | "BlinkIdRecognizer" | "IdBarcodeRecognizer"

export type IdCaptureUIFactory = () => IdCaptureUI