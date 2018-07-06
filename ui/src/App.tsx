import axios from "axios";
import * as React from "react";
import { AlertBox, IAlert } from "./AlertBox";
import "./App.css";
import config from "./config";
import CurrentlyPlaying from "./CurrentlyPlaying";
import DeviceSelect from "./DeviceSelect";
import { Queue } from "./Queue";
import SearchForm from "./SearchForm";

export interface IState {
    responseMsg: IAlert | null;
    deviceId: string | null;
    isAuthorized: boolean;
}

export class App extends React.Component<{}, IState> {

    private authInterval: NodeJS.Timer;

    public constructor(props: {}) {
        super(props);
        this.state = {
            responseMsg: null,
            deviceId: null,
            isAuthorized: false
        };

        axios.get(config.backend.url + "/selectedDevice")
            .then(response => {
                this.setState({
                    deviceId: response.data.deviceId
                });
            }).catch(error => {
                console.log(error);
            }
        );

        this.onQueued = this.onQueued.bind(this);
        this.setDevice = this.setDevice.bind(this);
        this.onSongEnd = this.onSongEnd.bind(this);
    }

    protected onQueued() {
        this.setState({
            responseMsg: null
        });
    }

    protected isAuthorized() {
        axios.get(config.backend.url + "/isAuthorized")
            .then(response => {
                if (response.data.isAuthorized) {
                    clearInterval(this.authInterval);
                    this.setState({
                        isAuthorized: true
                    });
                }
            }).catch(error => {
                console.log(error);
            }
        );
        return false;
    }

    protected setDevice(deviceId: string) {
        this.setState({
            deviceId
        });
    }

    protected onSongEnd() {
        this.setState({
            responseMsg: null
        });
    }

    public render() {
        if (!this.state.isAuthorized) {
            if (!this.authInterval) {
                this.authInterval = setInterval(() => {
                    this.isAuthorized();
                }, 2000);
            }
            return null;
        } else if (!this.state.deviceId) {
            return (
                <DeviceSelect setDevice={this.setDevice} />
            );
        } else {
            return (
                <div className="container">
                    <AlertBox alert={this.state.responseMsg} />
                    <div className="row">
                        <div className="col-md-4">
                            <div className="row">
                                <CurrentlyPlaying onSongEnd={this.onSongEnd} />
                            </div>
                            <div className="row">
                                <Queue onQueued={this.onQueued} />
                            </div>
                        </div>
                        <div className="col-md-8">
                            <SearchForm onQueued={this.onQueued} />
                        </div>
                    </div>
                </div>
            );
        }
    }
}

export default App;
