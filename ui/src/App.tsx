import axios from "axios";
import * as React from "react";
import { AlertBox, IAlert } from "./AlertBox";
import "./App.css";
import config from "./config";
import CurrentlyPlaying from "./CurrentlyPlaying";
import { DeviceSelect } from "./DeviceSelect";
import { IQueuedItem, Queue } from "./Queue";
import SearchForm from "./SearchForm";
import Share from "./Share";
import { UserMenu } from "./UserMenu";

export interface IState {
    enteredCode: string | null;
    passcode: string | null;
    responseMsg: IAlert;
    joinError: string | null;
    currentTrack: IQueuedItem | null;
    isPlaying: boolean;
    queuedItems: IQueuedItem[] | null;
    isOwner: boolean;
    reactivate: boolean;
    playlistId: string | null;
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
            queuedItems: null,
            isOwner: false,
            reactivate: false,
            playlistId: null
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
        this.reactivate = this.reactivate.bind(this);
        this.authorize = this.authorize.bind(this);
        this.onPlaylistSelected = this.onPlaylistSelected.bind(this);
        this.onPauseResume = this.onPauseResume.bind(this);
        this.refreshCurrentlyPlaying = this.refreshCurrentlyPlaying.bind(this);
    }

    public componentDidMount() {
        if (!this.state.passcode) {
            this.isAuthorized();
        }
    }

    protected joinQueue() {
        const code = this.state.enteredCode;

        axios.put(config.backend.url + "/join", { code })
            .then(response => {
                if (response.data.passcode) {
                    this.setState({
                        passcode: response.data.passcode,
                        isOwner: response.data.isOwner
                    });
                    this.getCurrentTrack();
                    this.getQueue();
                }
            }).catch((err) => {
                this.setState({
                    joinError: "Unable to join the given queue: " + err.response.data.message,
                    reactivate: true
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
                        passcode: response.data.passcode,
                        isOwner: response.data.isOwner
                    });
                } else if (!window.location.hash && window.location.pathname.length > 1) {
                    this.setState({
                        enteredCode: window.location.pathname.substr(1)
                    }, this.joinQueue);
                }
            }).catch(error => {
                this.onError(error.response.data.message);
            });
    }

    protected authorize(redirect_uri: string) {
        const client_id = "da6ea27d63384e858d12bcce0fac006d";
        const url = "https://accounts.spotify.com/authorize" +
            "?client_id=" + client_id +
            "&response_type=code" +
            "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state" +
            "&redirect_uri=" + encodeURIComponent(redirect_uri);

        window.open(url, "SpotiQue", "WIDTH=400,HEIGHT=500");

        this.authInterval = setInterval(this.isAuthorized, 2000);
    }

    protected createQueue() {
        this.authorize(config.backend.url + "/create");
    }

    protected reactivate() {
        this.authorize(config.backend.url + "/reactivate");
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
            // Give some time for spotify to catch up
            setTimeout(this.getCurrentTrack, 500);
        }
    }

    protected refreshCurrentlyPlaying() {
        setTimeout(this.getCurrentTrack, 500);
    }
    protected onPlaylistSelected() {
        this.getCurrentTrack();
    }

    protected onError(msg: string) {
        if (typeof msg !== "string") {
            console.log(msg);
            msg = "Unexpected error occurred.";
        }
        this.setState({
            responseMsg: { msg, className: "alert-danger" }
        });
    }

    protected onPauseResume() {
        if (!this.state.isOwner) {
            return;
        }

        axios.post(config.backend.url + "/pauseResume")
            .then(response => {

                this.setState({
                    isPlaying: response.data.isPlaying
                }, () =>
                    setTimeout(this.getCurrentTrack, 1000)
                );

                this.getQueue();
            }).catch((err) => {
                this.onError(err.response.data.message);
            }
        );
    }

    public render() {
        if (this.state.passcode) {
            return (
                <div className="container mainContent">
                    <AlertBox alert={this.state.responseMsg} />
                    <div className="row">
                        <div className="col-md-4">
                            <div className="row">
                                <CurrentlyPlaying isPlaying={this.state.isPlaying}
                                    currentTrack={this.state.currentTrack}
                                    isOwner={this.state.isOwner}
                                    onPauseResume={this.onPauseResume}
                                    onSongEnd={this.onSongEnd}
                                    onError={this.onError} />
                            </div>
                            <div className="row">
                                <Queue currentTrack={this.state.currentTrack}
                                    queue={this.state.queuedItems}
                                    onSkip={this.refreshCurrentlyPlaying}
                                    onQueued={this.onQueued}
                                    onError={this.onError} />
                            </div>
                        </div>
                        <div className="col-md-8">
                            <SearchForm activePlaylistId={this.state.playlistId}
                                isOwner={this.state.isOwner}
                                onQueued={this.onQueued}
                                onPlaylistSelected={this.onPlaylistSelected}
                                onError={this.onError} />
                        </div>
                    </div>
                    <div className="footer fixed-bottom d-flex">
                        <UserMenu passcode={this.state.passcode} onError={this.onError} />
                        {this.state.isOwner ? <DeviceSelect onError={this.onError} /> : null}
                        <Share passcode={this.state.passcode} onError={this.onError} />
                    </div>
                </div>
            );
        } else {
            return (
                <div className="container loginContainer h-100">
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
                                {this.state.reactivate ? <button type="submit" className="btn btn-primary w-100" onClick={this.reactivate}>Reactivate</button> : null}
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
                        isPlaying: response.data.isSpotiquPlaying,
                        playlistId: response.data.playlistId
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.message);
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
                this.onError(err.response.data.message);
            }
        );
    }
}

export default App;
