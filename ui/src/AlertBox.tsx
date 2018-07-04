import * as React from "react";

export interface IAlert {
    className: "alert-success"|"alert-danger"|"alert-warning"|"alert-info";
    msg: string;
}

export interface IAlertBoxProps {
    alert: IAlert | null;
}

export interface IAlertBoxState {
    alert: IAlert | null;
}

export class AlertBox extends React.Component<IAlertBoxProps, IAlertBoxState> {

    public constructor(props: IAlertBoxProps) {
        super(props);

        this.state = {
            alert: props.alert
        };
    }

    public componentWillReceiveProps(nextProps: IAlertBoxProps) {
        setTimeout(() => {
            this.setState({
                alert: null
            });
        }, 3000);

        this.setState({
            alert: nextProps.alert
        });
    }

    public render() {
        if (this.state.alert) {
            return (
                <div className={"alert " + this.state.alert.className + " fixed-top"} role="alert">{this.state.alert.msg}</div>
            );
        } else {
            return null;
        }
    }
}

export default AlertBox;
