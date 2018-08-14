import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export class NumberSetting extends React.Component {

    constructor(props) {
        super(props);

        this.increase = this.increase.bind(this);
        this.decrease = this.decrease.bind(this);
    }

    increase(e) {
        e.preventDefault();
        this.props.updateValue((this.props.value || 0) + this.props.step);
    }

    decrease(e) {
        e.preventDefault();
        this.props.updateValue((this.props.value || 0) - this.props.step);
    }

    render() {
        return (
            <div className="numberSettingContainer">
                <div onClick={this.decrease}><FontAwesomeIcon icon="minus-circle"/></div>
                <div onClick={this.increase}><FontAwesomeIcon icon="plus-circle"/></div>
            </div>
        );
    }
}

export default NumberSetting;
