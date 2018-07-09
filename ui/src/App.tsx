import axios from "axios";
import * as React from "react";
import { AlertBox, IAlert } from "./AlertBox";
import "./App.css";
import config from "./config";
import CurrentlyPlaying from "./CurrentlyPlaying";
import { DeviceSelect } from "./DeviceSelect";
import { IQueuedItem, Queue } from "./Queue";
import SearchForm from "./SearchForm";

export interface IState {
    enteredCode: string | null;
    passcode: string | null;
    responseMsg: IAlert;
    joinError: string | null;
    currentTrack: IQueuedItem | null;
    isPlaying: boolean;
    queuedItems: IQueuedItem[] | null;
}

export class App extends React.Component<{}, IState> {

    private authInterval: NodeJS.Timer;

    public constructor(props: {}) {
        super(props);

        this.state = {
            enteredCode: null,
            passcode: null,
            responseMsg: { msg: "", className: "alert-info"},
            joinError: null,
            currentTrack: null,
            isPlaying: false,
            queuedItems: null
        };

        this.createQueue = this.createQueue.bind(this);
        this.joinQueue = this.joinQueue.bind(this);
        this.onQueued = this.onQueued.bind(this);
        this.onSongEnd = this.onSongEnd.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.isAuthorized = this.isAuthorized.bind(this);
        this.onError = this.onError.bind(this);
        this.getCurrentTrack = this.getCurrentTrack.bind(this);
        this.getQueue = this.getQueue.bind(this);
    }

    public componentDidMount() {
        this.isAuthorized();
    }

    protected joinQueue(e: React.MouseEvent<HTMLElement>) {
        const code = this.state.enteredCode;

        axios.put(config.backend.url + "/join", { code })
            .then(response => {
                if (response.data.passcode) {
                    this.setState({
                        passcode: response.data.passcode
                    });
                    this.getCurrentTrack();
                    this.getQueue();
                }
            }).catch(error => {
                this.setState({
                    joinError: "Unable to join the given queue."
                });
            }
        );
    }

    protected isAuthorized() {
        axios.get(config.backend.url + "/isAuthorized")
            .then(response => {
                if (response.data.isAuthorized) {
                    this.getCurrentTrack();
                    this.getQueue();

                    clearInterval(this.authInterval);
                    this.setState({
                        passcode: response.data.passcode
                    });
                }
            }).catch(error => {
                console.log(error);
            });
    }

    protected createQueue(e: React.MouseEvent<HTMLElement>) {
        const client_id = "da6ea27d63384e858d12bcce0fac006d";
        const redirect_uri = config.backend.url + "/callback";
        const url = "https://accounts.spotify.com/authorize" +
            "?client_id=" + client_id +
            "&response_type=code" +
            "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state" +
            "&redirect_uri=" + encodeURIComponent(redirect_uri);

        window.open(url, "SpotiQue", "WIDTH=400,HEIGHT=500");

        this.authInterval = setInterval(this.isAuthorized, 2000);
    }

    protected handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        this.setState({
            enteredCode: e.target.value
        });
    }

    protected onSongEnd() {
        this.setState({
            isPlaying: false
        });
        this.getCurrentTrack();
        this.getQueue();
    }

    protected onQueued() {
        this.getQueue();
        if (!this.state.isPlaying) {
            this.getCurrentTrack();
        }
    }

    protected onError(msg: string) {
        if (typeof msg !== "string") {
            msg = "Unexpected error occurred.";
        }
        this.setState({
            responseMsg: { msg, className: "alert-danger" }
        });
    }

    public render() {
        if (this.state.passcode) {
            return (
                <div className="container">
                    <AlertBox alert={this.state.responseMsg} />
                    <div className="row">
                        <div className="col-md-4">
                            <div className="row">
                                <CurrentlyPlaying isPlaying={this.state.isPlaying} currentTrack={this.state.currentTrack} onSongEnd={this.onSongEnd} onError={this.onError} />
                            </div>
                            <div className="row">
                                <Queue currentTrack={this.state.currentTrack} queue={this.state.queuedItems} onQueued={this.onQueued} onError={this.onError} />
                            </div>
                        </div>
                        <div className="col-md-8">
                            <SearchForm onQueued={this.onQueued} onError={this.onError} />
                        </div>
                    </div>
                    <div className="footer fixed-bottom">
                        <DeviceSelect onError={this.onError} />
                    </div>
                </div>
            );
        } else {
            return (
                <div className="container h-100">
                <div className="row h-100 justify-content-center align-items-center">
                    <div className="row h-20 w-100 justify-content-center">
                        <div className="row h-20 w-100 justify-content-center">
                            <div className="col-md-3">
                                <button type="submit" className="btn btn-primary w-100" onClick={this.createQueue}>Create Queue</button>
                            </div>
                        </div>
                        <div className="Divider">
                            <div className="Side"><hr /></div>
                            <div className="Middle"><span>OR</span></div>
                            <div className="Side"><hr /></div>
                        </div>
                        <div className="row h-20 w-100 justify-content-center">
                            <div className="col-md-3">
                                <input className="form-control w-100 passcode" type="text" placeholder="Passcode" onChange={this.handleChangeEvent} />
                                <button type="submit" className="btn btn-primary w-100" onClick={this.joinQueue}>Join</button>
                                <p className="error">{this.state.joinError}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            );
        }
    }

    private getCurrentTrack() {
        axios.get(config.backend.url + "/currentlyPlaying")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        currentTrack: response.data.currentTrack,
                        isPlaying: response.data.isPlaying
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.msg);
            }
        );
    }

    private getQueue() {
        axios.get(config.backend.url + "/queue")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        queuedItems: response.data.queuedItems
                    });
                } else {
                    this.setState({
                        queuedItems: null
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.msg);
            }
        );
    }
}

export default App;
