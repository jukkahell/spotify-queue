import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import config from "./config";

export class DeviceSelect extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            devices: [],
            selectedDeviceName: "Select device",
            selectedDeviceId: null,
            dropdownVisible: false,
            loading: false
        };

        axios.get(config.backend.url + "/devices")
            .then(response => {
                this.setState({
                    devices: response.data
                });
            }).catch(error => {
                this.props.onError(error.response.data.message);
            }
        );

        this.selectDevice = this.selectDevice.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.setDevice = this.setDevice.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
    }

    selectDevice(e) {
        if (this.state.devices.some((device) => !device.isActive && device.id === e.currentTarget.id)) {
            this.setState({
                selectedDeviceId: e.currentTarget.id,
                selectedDeviceName: e.currentTarget.innerText,
                dropdownVisible: false
            }, this.setDevice);
        }
    }

    dropdownClicked(e) {
        e.preventDefault();

        this.setState((prevState) => ({
            loading: true,
            dropdownVisible: !prevState.dropdownVisible
        }));
        axios.get(config.backend.url + "/devices")
            .then(response => {
                this.setState({
                    devices: response.data,
                    loading: false
                });
            }).catch(error => {
                this.props.onError(error.response.data.message);
            }
        );
    }

    hideMenu() {
        this.setState((prevState) => ({
            dropdownVisible: false
        }));
    }

    renderDeviceOptions() {
        return this.state.devices.map((device, i) => (
            <a className={"dropdown-item" + (device.isActive ? " active" : "")} key={"device-" + i} href="#" id={device.id} onClick={this.selectDevice}>
                <FontAwesomeIcon icon={this.deviceTypeToIcon(device.type)} /> {device.name}
            </a>
        ));
    }

    setDevice() {
        if (this.state.selectedDeviceId) {
            axios.put(config.backend.url + "/device", { deviceId: this.state.selectedDeviceId })
            .then(resp => {
                const devices = this.state.devices.map(device => {
                    if (device.id === this.state.selectedDeviceId) {
                       return { id: device.id, isActive: true, name: device.name, type: device.type };
                    }
                    return { id: device.id, isActive: false, name: device.name, type: device.type };
                });
                this.setState({
                    devices
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            });
        }
    }

    render() {
        return (
            <div className="dropup">
                <button className="btn btn-secondary footerMenu"
                        onClick={this.dropdownClicked}
                        type="button"
                        id="deviceMenuButton"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false">
                    <FontAwesomeIcon icon="volume-off" />
                </button>
                <div className={"dropdown-menu " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="deviceMenuButton">
                    {this.renderDeviceOptions()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }

    deviceTypeToIcon(type) {
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
