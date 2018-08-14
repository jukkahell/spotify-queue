import * as React from "react";

export class AlertBox extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className={"alert " + this.props.alert.className + " fixed-top"} role="alert" onClick={this.props.close}>{this.props.alert.msg}</div>
        );
    }
}

export default AlertBox;
