import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";

export interface IDevice {
    id: string;
    name: string;
    type: string;
}

export interface IDeviceSelectProps {
    setDevice: (deviceId: string) => void;
}

export interface IDeviceSelectState {
    devices: IDevice[];
    selectedDeviceName: string;
    selectedDeviceId: string | null;
    dropdownVisible: boolean;
}

export class DeviceSelect extends React.Component<IDeviceSelectProps, IDeviceSelectState> {

    public constructor(props: IDeviceSelectProps) {
        super(props);

        this.state = {
            devices: [],
            selectedDeviceName: "Select device",
            selectedDeviceId: null,
            dropdownVisible: false
        };

        axios.get("http://spotique.fi:8000/getDevices")
            .then(response => {
                this.setState({
                    devices: response.data
                });
            }).catch(error => {
                console.log(error);
            }
        );

        this.selectDevice = this.selectDevice.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.setDevice = this.setDevice.bind(this);
    }

    public selectDevice(e: React.MouseEvent<HTMLElement>) {
        this.setState({
            selectedDeviceId: e.currentTarget.id,
            selectedDeviceName: e.currentTarget.innerText,
            dropdownVisible: false
        });
    }

    public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        this.setState({
            dropdownVisible: !this.state.dropdownVisible
        });
    }

    public renderDeviceOptions() {
        return this.state.devices.map((device: IDevice, i: number) => (
            <a className="dropdown-item" key={"device-" + i} href="#" id={device.id} onClick={this.selectDevice}>
                <FontAwesomeIcon icon={this.deviceTypeToIcon(device.type)} /> {device.name}
            </a>
        ));
    }

    public setDevice() {
        if (this.state.selectedDeviceId) {
            axios.post("http://spotique.fi:8000/setDevice", { deviceId: this.state.selectedDeviceId })
            .then(response => {
                this.props.setDevice(this.state.selectedDeviceId!);
            }).catch(error => {
                console.log(error);
            }
        );
        }
    }

    public render() {
        return (
            <div className="container h-100">
                <div className="row h-100 justify-content-center align-items-center">
                    <div className="row h-20 w-100 justify-content-center">
                        <div className="dropdown col-md-2">
                            <button className="btn btn-secondary dropdown-toggle w-100"
                                    onClick={this.dropdownClicked}
                                    type="button"
                                    id="deviceMenuButton"
                                    data-toggle="dropdown"
                                    aria-haspopup="true"
                                    aria-expanded="false">
                                {this.state.selectedDeviceName}
                            </button>
                            <div className={"dropdown-menu col-md-12 " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="deviceMenuButton">
                                {this.renderDeviceOptions()}
                            </div>
                        </div>
                        <div className="col-md-2">
                            <button type="submit" className="btn btn-primary search w-100" onClick={this.setDevice}>OK</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private deviceTypeToIcon(type: string): IconProp {
        switch (type) {
            case "Computer":
                return "desktop";
            case "Smartphone":
                return "mobile";
            case "Speaker":
                return "volume-off";
            default:
                return "play-circle";
        }
    }
}

export default DeviceSelect;
