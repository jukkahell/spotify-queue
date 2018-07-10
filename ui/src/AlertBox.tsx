import * as React from "react";

export interface IAlert {
    className: "alert-success"|"alert-danger"|"alert-warning"|"alert-info";
    msg: string;
}

export interface IAlertBoxProps {
    alert: IAlert;
}

export interface IAlertBoxState {
    showAlert: boolean;
}

export class AlertBox extends React.Component<IAlertBoxProps, IAlertBoxState> {

    public constructor(props: IAlertBoxProps) {
        super(props);

        this.state = {
            showAlert: false
        };
    }

    public componentDidUpdate(prevProps: IAlertBoxProps) {
        if (this.props.alert.msg !== prevProps.alert.msg) {
            this.setState({
                showAlert: true
            });
            setTimeout(() => {
                this.setState({
                    showAlert: false
                });
            }, 3000);
        }
    }

    public render() {
        if (this.props.alert) {
            return (
                <div className={(this.state.showAlert ? "visible" : "invisible") + " alert " + this.props.alert.className + " fixed-top"} role="alert">{this.props.alert.msg}</div>
            );
        } else {
            return null;
        }
    }
}

export default AlertBox;
