
export default class MeetingLog{
    sequenceNumber: number;
    message: string;
    timestampMs: number;
    logLevel: string;

    constructor(sequenceNumber: number,
                message: string,
                timestampMs: number,
                logLevel: string) {
        this.sequenceNumber = sequenceNumber;
        this.message = message;
        this.timestampMs = timestampMs;
        this.logLevel = logLevel;
    }

}