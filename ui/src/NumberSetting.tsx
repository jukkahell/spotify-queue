import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface INumberSettingProps {
    value: number;
    step: number;
    min?: number;
    max?: number;
    updateValue: (val: number) => void;
}

export class NumberSetting extends React.Component<INumberSettingProps> {

    public constructor(props: INumberSettingProps) {
        super(props);

        this.increase = this.increase.bind(this);
        this.decrease = this.decrease.bind(this);
    }

    protected increase(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.props.updateValue((this.props.value || 0) + this.props.step);
    }

    protected decrease(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        const newValue = (this.props.value || 0) - this.props.step;
        let cappedValue = this.props.min ? Math.max(newValue, this.props.min) : newValue;
        cappedValue = this.props.max ? Math.min(newValue, this.props.max) : cappedValue;
        this.props.updateValue(cappedValue);
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
