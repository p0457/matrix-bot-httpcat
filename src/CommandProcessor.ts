import { MatrixClient, RichReply } from "matrix-bot-sdk";
import { LogService } from "matrix-js-snippets";
import striptags = require("striptags");
import config from "./config";
const axios = require('axios');

export class CommandProcessor {
    private _client: MatrixClient;

    constructor(private client: MatrixClient) {
        this._client = client;
    }

    public tryCommand(roomId: string, event: any): Promise<any> {
        const message = event['content']['body'];
        if (!message) return;
        const requestedStatusCode = message.substring("!httpcat ".length).trim();
        if (!requestedStatusCode || requestedStatusCode.length !== 3) return;

        const url = `https://http.cat/${requestedStatusCode}`;

        if (!config.uploadImageOnRequest) return this.sendHtmlReply(roomId, event, url);
        else {
            return new Promise((resolve, reject) => {
                axios.get(url, { responseType: 'arraybuffer' })
                    .then((response) => {
                        const buffer = Buffer.from(response.data, "utf-8");
                        const fileName = `httpcat-${requestedStatusCode}.jpg`;
                        const mimeType = "image/jpeg";
                        this._client.uploadContent(buffer, mimeType, fileName)
                            .then((contentUri) => {
                                this.sendImageReply(roomId, event, fileName, contentUri, mimeType);
                                resolve();
                            })
                            .catch((error) => {
                                LogService.error(`CommandProcessor.URLUpload`, error);
                                this.sendHtmlReply(roomId, event, "There was an error processing your command");
                                reject(error);
                            });
                    })
                    .catch((error) => {
                        LogService.error(`CommandProcessor.URLUpload`, error);
                        this.sendHtmlReply(roomId, event, "There was an error processing your command");
                        reject(error);
                    });
            });
        }
    }

    private sendHtmlReply(roomId: string, event: any, message: string): Promise<any> {
        const reply = RichReply.createFor(roomId, event, striptags(message), message);
        reply["msgtype"] = "m.notice";
        return this.client.sendMessage(roomId, reply);
    }

    private sendImageReply(roomId: string, event: any, fileName: string, contentUri: string, mimeType: string): Promise<any> {
        const reply = RichReply.createFor(roomId, event, striptags(contentUri), contentUri);
        reply["body"] = fileName;
        reply["info"] = {
            mimetype: mimeType
        };
        reply["msgtype"] = "m.image";
        reply["url"] = contentUri;
        return this.client.sendMessage(roomId, reply);
    }
}
