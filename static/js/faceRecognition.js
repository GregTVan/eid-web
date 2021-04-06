var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Rect } from "./utils.js";
export class RecognizableFace {
    constructor(jpeg, faceTemplate) {
        this.jpeg = jpeg;
        this.faceTemplate = faceTemplate;
    }
}
export function createRecognizableFace(image, faceRect) {
    return __awaiter(this, void 0, void 0, function* () {
        var jpeg;
        if (image instanceof Image) {
            var canvas = document.createElement("canvas");
            if (faceRect) {
                faceRect.x = Math.max(faceRect.x - faceRect.width * 0.1, 0);
                faceRect.y = Math.max(faceRect.y - faceRect.height * 0.1, 0);
                faceRect.width *= 1.2;
                faceRect.height *= 1.2;
                if (faceRect.x + faceRect.width > image.width) {
                    faceRect.width = image.width - faceRect.x;
                }
                if (faceRect.y + faceRect.height > image.height) {
                    faceRect.height = image.height - faceRect.y;
                }
            }
            else {
                faceRect = new Rect(0, 0, image.width, image.height);
            }
            canvas.width = faceRect.width;
            canvas.height = faceRect.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0 - faceRect.x, 0 - faceRect.y);
            jpeg = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");
        }
        else if (typeof (image) == "string") {
            jpeg = image;
        }
        else {
            throw new Error("Invalid image parameter");
        }
        var response = yield fetch("/detectFace", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify({ "image": jpeg })
        });
        var json = yield response.json();
        return new RecognizableFace(json.jpeg, json.faceTemplate);
    });
}
export function compareFaceTemplates(template1, template2) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!template1 || !template2) {
            throw new Error("Missing face templates");
        }
        var response = yield fetch("/compareFaces", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify([template1, template2])
        });
        var score = yield response.text();
        return parseFloat(score);
    });
}
//# sourceMappingURL=faceRecognition.js.map