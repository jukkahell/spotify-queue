import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import config from "./config";

export interface IDevice {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
}

export interface IDeviceSelectProps {
    onError: (msg: string) => void;
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

        axios.get(config.backend.url + "/getDevices")
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

        this.setDevice();
    }

    public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    public renderDeviceOptions() {
        return this.state.devices.map((device: IDevice, i: number) => (
            <a className={"dropdown-item" + (device.isActive ? " active" : "")} key={"device-" + i} href="#" id={device.id} onClick={this.selectDevice}>
                <FontAwesomeIcon icon={this.deviceTypeToIcon(device.type)} /> {device.name}
            </a>
        ));
    }

    public setDevice() {
        if (this.state.selectedDeviceId) {
            axios.put(config.backend.url + "/device", { deviceId: this.state.selectedDeviceId })
            .catch(err => {
                this.props.onError(err.response.data.msg);
            });
        }
    }

    public render() {
        return (
            <div>
                <div className="dropup col-md-2">
                    <button className="btn btn-secondary dropdown-toggle deviceSelect"
                            onClick={this.dropdownClicked}
                            type="button"
                            id="deviceMenuButton"
                            data-toggle="dropdown"
                            aria-haspopup="true"
                            aria-expanded="false">
                        <FontAwesomeIcon icon="volume-off" />
                    </button>
                    <div className={"dropdown-menu col-md-12 " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="deviceMenuButton">
                        {this.renderDeviceOptions()}
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
