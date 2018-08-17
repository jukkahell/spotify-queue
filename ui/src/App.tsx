import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import * as ReactTooltip from "react-tooltip";
import {AlertBox, IAlert} from "./AlertBox";
import "./App.css";
import config from "./config";
import CurrentlyPlaying from "./CurrentlyPlaying";
import {DeviceSelect} from "./DeviceSelect";
import {IQueuedItem, Queue} from "./Queue";
import QueueList, { IUserQueue } from "./QueueList";
import SearchForm from "./SearchForm";
import Settings, {ISettings} from "./Settings";
import Share from "./Share";
import UserList from "./UserList";
import {UserMenu} from "./UserMenu";
import YouTubeSearchForm from "./YouTubeSearchForm";

export interface IUser {
    id: string;
    points: number;
    spotifyUserId?: string;
    username: string;
}

export interface IState {
    enteredCode: string | null;
    passcode: string | null;
    responseMsg: IAlert | null;
    joinError: string | null;
    currentTrack: IQueuedItem | null;
    isPlaying: boolean;
    queuedItems: IQueuedItem[] | null;
    isOwner: boolean;
    reactivate: boolean;
    playlistId: string | null;
    settings: ISettings | null;
    user: IUser | null;
    users: IUser[] | null;
    userQueues: IUserQueue[] | null;
}

export class App extends React.Component<{}, IState> {

    private authInterval: NodeJS.Timer;

    public constructor(props: {}) {
        super(props);

        this.state = {
            enteredCode: null,
            passcode: null,
            responseMsg: null,
            joinError: null,
            currentTrack: null,
            isPlaying: false,
            queuedItems: null,
            isOwner: false,
            reactivate: false,
            playlistId: null,
            settings: null,
            user: null,
            users: null,
            userQueues: null
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
        this.getSettings = this.getSettings.bind(this);
        this.updateSettings = this.updateSettings.bind(this);
        this.closeAlert = this.closeAlert.bind(this);
        this.getUser = this.getUser.bind(this);
        this.getUsers = this.getUsers.bind(this);
        this.onSpotifyLogin = this.onSpotifyLogin.bind(this);
        this.getUserQueues = this.getUserQueues.bind(this);
        this.selectQueue = this.selectQueue.bind(this);
        this.onProtected = this.onProtected.bind(this);
        this.onSkip = this.onSkip.bind(this);
        this.refreshData = this.refreshData.bind(this);
        this.updateUser = this.updateUser.bind(this);
        this.youtubeEnd = this.youtubeEnd.bind(this);
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
                        responseMsg: null,
                        passcode: response.data.passcode,
                        isOwner: response.data.isOwner
                    });
                    this.isAuthorized();
                }
            }).catch((err) => {
                this.setState({
                    joinError: "Unable to join the given queue: " + err.response.data.message,
                    responseMsg: { className: "alert-danger", msg: "Unable to join queue: " + err.response.data.message },
                    reactivate: true
                });
            }
        );
    }

    protected isAuthorized() {
        axios.get(config.backend.url + "/isAuthorized")
            .then(response => {
                if (response.data.isAuthorized) {
                    this.getUser();
                    this.getUsers();
                    this.getUserQueues();
                    this.getCurrentTrack();
                    this.getQueue();
                    this.getSettings();

                    clearInterval(this.authInterval);
                    this.setState({
                        responseMsg: null,
                        passcode: response.data.passcode,
                        isOwner: response.data.isOwner
                    });
                } else if (window.location.hash && window.location.hash.indexOf("join:") >= 0) {
                    this.setState({
                        enteredCode: window.location.hash.split("join:")[1]
                    }, this.joinQueue);
                } else if (window.location.pathname.length > 1) {
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
            "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state,playlist-read-private,playlist-read-collaborative,user-read-private" +
            "&redirect_uri=" + encodeURIComponent(redirect_uri);

        window.open(url, "SpotiQu", "WIDTH=400,HEIGHT=550");

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

    protected refreshData() {
        this.getUser();
        this.getUsers();
        this.getUserQueues();
        this.getCurrentTrack();
        this.getQueue();
        this.getSettings();
    }

    protected onSongEnd() {
        this.setState({
            isPlaying: false
        });
        setTimeout(() => {
            this.getCurrentTrack();
            this.getQueue();
            this.getUser();
        }, 500);
    }

    protected onQueued() {
        this.getQueue();
        this.getUser();
        if (!this.state.isPlaying) {
            // Give some time for spotify to catch up
            setTimeout(this.getCurrentTrack, 500);
        }
        this.setState({
            responseMsg: { msg: "Queued", className: "alert-success" }
        });
        setTimeout(() => {
            this.setState({ responseMsg: null });
        }, 2000);
    }

    protected onProtected() {
        this.setState({
            responseMsg: { msg: "Song protected", className: "alert-success" }
        });
        setTimeout(() => {
            this.getCurrentTrack();
            this.getQueue();
        }, 500);
        setTimeout(() => {
            this.setState({ responseMsg: null });
        }, 2000);
    }

    protected onSkip() {
        this.setState({
            responseMsg: { msg: "Skipped", className: "alert-success" }
        });
        setTimeout(() => {
            this.getCurrentTrack();
            this.getQueue();
        }, 500);
        setTimeout(() => {
            this.setState({ responseMsg: null });
        }, 2000);
    }

    protected onSpotifyLogin() {
        this.getUser();
    }

    protected refreshCurrentlyPlaying() {
        setTimeout(this.getCurrentTrack, 500);
    }
    protected onPlaylistSelected() {
        this.getCurrentTrack();
        this.getSettings();
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

    protected closeAlert() {
        this.setState({
            responseMsg: null
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

    protected renderPoints() {
        if (this.state.settings && this.state.settings.gamify && this.state.user) {
            return (
                <div className="pointsContainer">
                    <p className={"userPoints " + (this.state.user.points >= 0 ? "positive" : "negative")} data-tip="" data-for="gamifyHelp">
                        {this.state.user.points >= 0 ? "+" : ""}{this.state.user.points} points
                    </p>
                    <ReactTooltip id="gamifyHelp">
                        <p>You'll get points from the following events:</p>
                        <ul>
                            <li>+1 point if you have a song queued when someone else's song ends.</li>
                            <li>Points you spent to queue a song when that song ends.</li>
                            <li>Same amount of points how much votes your song gets. Can be negative as well.</li>
                        </ul>
                        <p>You can spend points on the following:</p>
                        <ul>
                            <li>Add a song to queue. 1min song costs 2 points, 2min song 3 points etc.</li>
                            <li>-5 points to move your song one step forward in the queue.</li>
                            <li>-15 points to protect a song to be skipped or removed.</li>
                            <li>-20 points to skip or remove another user's song from the queue.</li>
                        </ul>
                    </ReactTooltip>
                </div>
            );
        } else {
            return null;
        }
    }

    public render() {
        if (this.state.passcode) {
            return (
                <div className="container mainContent">
                    {this.state.responseMsg ? <AlertBox alert={this.state.responseMsg} close={this.closeAlert} /> : null}
                    <div className="row">
                        <div className="col-md-4">
                            <div className="row">
                                <CurrentlyPlaying isPlaying={this.state.isPlaying}
                                    currentTrack={this.state.currentTrack}
                                    isOwner={this.state.isOwner}
                                    user={this.state.user}
                                    onVoted={this.refreshCurrentlyPlaying}
                                    onPauseResume={this.onPauseResume}
                                    onSongEnd={this.onSongEnd}
                                    refreshData={this.refreshData}
                                    onYouTubeTrackEnd={this.youtubeEnd}
                                    onError={this.onError} />
                            </div>
                            <div className="row">
                                <Queue currentTrack={this.state.currentTrack}
                                    queue={this.state.queuedItems}
                                    onSkip={this.onSkip}
                                    onProtected={this.onProtected}
                                    settings={this.state.settings}
                                    user={this.state.user}
                                    onQueued={this.onQueued}
                                    onError={this.onError} />
                            </div>
                        </div>
                        <div className="col-md-8">
                            <h1>{this.state.settings ? this.state.settings.name : ""}</h1>
                            <Tabs selectedTabClassName="source-tab--selected" selectedTabPanelClassName="source-tab-panel--selected">
                                <TabList className="source-tab-list">
                                    <Tab className="source-tab spotify-tab">
                                        <FontAwesomeIcon icon={["fab", "spotify"]} />
                                    </Tab>
                                    <Tab className="source-tab youtube-tab">
                                        <FontAwesomeIcon icon={["fab", "youtube"]} />
                                    </Tab>
                                </TabList>
                                <TabPanel className="source-tab-panel">
                                    <SearchForm settings={this.state.settings}
                                                isOwner={this.state.isOwner}
                                                user={this.state.user}
                                                onQueued={this.onQueued}
                                                onPlaylistSelected={this.onPlaylistSelected}
                                                onError={this.onError} />
                                </TabPanel>
                                <TabPanel className="source-tab-panel">
                                    <YouTubeSearchForm settings={this.state.settings}
                                                isOwner={this.state.isOwner}
                                                user={this.state.user}
                                                onQueued={this.onQueued}
                                                onError={this.onError} />
                                </TabPanel>
                            </Tabs>
                        </div>
                    </div>
                    <div className="footer fixed-bottom d-flex">
                        <UserMenu updateUser={this.updateUser} passcode={this.state.passcode} onError={this.onError} onSpotifyLogin={this.onSpotifyLogin} user={this.state.user} />
                        <Share passcode={this.state.passcode} onError={this.onError} />
                        <UserList onError={this.onError} isOwner={this.state.isOwner} users={this.state.users} onEdit={this.getUsers} />
                        <QueueList onError={this.onError} queues={this.state.userQueues} passcode={this.state.passcode} selectQueue={this.selectQueue} />
                        {this.state.isOwner ? <DeviceSelect onError={this.onError} /> : null}
                        {
                            this.state.isOwner && this.state.settings ?
                            <Settings settings={this.state.settings} updateSettings={this.updateSettings} onError={this.onError} /> :
                            null
                        }
                        {this.renderPoints()}
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
                                <button type="submit" className="btn btn-primary w-100" onClick={this.createQueue}>Create/Restore Queue</button>
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

    private selectQueue(passcode: string) {
        this.setState({
            enteredCode: passcode
        }, this.joinQueue);
    }

    private getUser() {
        axios.get(config.backend.url + "/user")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        user: response.data
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
    }

    private getUsers() {
        axios.get(config.backend.url + "/users")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        users: response.data
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
    }

    private getUserQueues() {
        axios.get(config.backend.url + "/userQueues")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        userQueues: response.data
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
    }

    private getSettings() {
        axios.get(config.backend.url + "/settings")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        settings: response.data
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
    }

    private updateUser(username: string) {
        axios.post(config.backend.url + "/user", { username })
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        user: response.data
                    });
                    this.getUsers();
                }
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
    }

    private updateSettings(settings: ISettings, updatedFields?: string[]) {
        axios.post(config.backend.url + "/updateSettings", { settings, updatedFields })
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        settings: response.data
                    });
                }
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
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

    private youtubeEnd(event: any) {
        console.log(event);
        axios.get(config.backend.url + "/youtubeEnd")
            .then(() => {
                this.refreshData();
            }).catch(err => {
                this.onError(err.response.data.message);
            }
        );
    }
}

export default App;
