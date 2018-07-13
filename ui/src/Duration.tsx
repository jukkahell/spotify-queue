import * as React from "react";

export interface IDurationProps {
    seconds?: number;
    milliseconds?: number;
}

export class Duration extends React.Component<IDurationProps> {

    public constructor(props: IDurationProps) {
        super(props);
    }

    public render() {
        return (
            <div>
                {this.printTime()}
            </div>
        );
    }

    private printTime() {
        let millis = this.props.milliseconds;
        if (!millis) {
            millis = this.props.seconds! * 1000;
        }
        const minutes = Math.floor(millis / 60000);
        const seconds = ((millis % 60000) / 1000);
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds.toFixed(0);
    }
}

export default Duration;
