import * as React from "react";

export interface ITimeProps {
    afterMillis?: number;
}

export class Time extends React.Component<ITimeProps> {
    public constructor(props: ITimeProps) {
        super(props);
    }

    public render() {
      if (this.props.afterMillis) {
        return <div className="estimatedPlayTime">{this.printTime()}</div>;
      } else {
        return null;
      }
    }

    private printTime() {
        const millis = Date.now() + this.props.afterMillis!;
        const date = new Date(millis);
        const hour = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        const minute = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
        return hour + ":" + minute;
    }
}

export default Time;
