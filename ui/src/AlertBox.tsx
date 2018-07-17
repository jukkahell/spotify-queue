import * as React from "react";

export interface IAlert {
    className: "alert-success"|"alert-danger"|"alert-warning"|"alert-info";
    msg: string;
}

export interface IAlertBoxProps {
    alert: IAlert;
    close: () => void;
}

export class AlertBox extends React.Component<IAlertBoxProps> {

    public constructor(props: IAlertBoxProps) {
        super(props);
    }

    public render() {
        return (
            <div className={"alert " + this.props.alert.className + " fixed-top"} role="alert" onClick={this.props.close}>{this.props.alert.msg}</div>
        );
    }
}

export default AlertBox;
