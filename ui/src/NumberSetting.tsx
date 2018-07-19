import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface INumberSettingProps {
    value: number;
    step: number;
    updateValue: (val: number) => void;
}

export class NumberSetting extends React.Component<INumberSettingProps> {

    public constructor(props: INumberSettingProps) {
        super(props);

        this.increase = this.increase.bind(this);
        this.decrease = this.decrease.bind(this);
    }

    protected increase() {
        this.props.updateValue((this.props.value || 0) + this.props.step);
    }

    protected decrease() {
        this.props.updateValue((this.props.value || 0) - this.props.step);
    }

    public render() {
        return (
            <div className="numberSettingContainer">
                <div onClick={this.decrease}><FontAwesomeIcon icon="minus-circle"/></div>
                <div onClick={this.increase}><FontAwesomeIcon icon="plus-circle"/></div>
            </div>
        );
    }
}

export default NumberSetting;
