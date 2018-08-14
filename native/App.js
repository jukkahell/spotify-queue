import React from "react";
import { TextInput, Text, Button, View } from "react-native";
import axios from "axios";
import { AlertBox } from "./AlertBox";
import { Font } from 'expo';
import config from "./config";
import CurrentlyPlaying from "./CurrentlyPlaying";
import { DeviceSelect } from "./DeviceSelect";
import { Queue } from "./Queue";
import QueueList from "./QueueList";
import SearchForm from "./SearchForm";
import Settings from "./Settings";
import Share from "./Share";
import UserList from "./UserList";
import { UserMenu } from "./UserMenu";
import styles from "./styles";

export class App extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            fontLoaded: false,
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
    }

    async componentDidMount() {
        await Font.loadAsync({
          "Montserrat": require("./assets/fonts/Montserrat-Regular.ttf"),
          "fab": require("./assets/fonts/fa-brands-400.ttf"),
          "fas": require("./assets/fonts/fa-solid-900.ttf")
        });

        this.setState({
          fontLoaded: true
        });
        if (!this.state.passcode) {
            this.isAuthorized();
        }
    }

    joinQueue() {
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
              if (err.response) {
                err = err.response.data.message;
              }
                this.setState({
                    joinError: "Unable to join the given queue: " + err,
                    responseMsg: { className: "alert-danger", msg: "Unable to join queue: " + err },
                    reactivate: true
                });
            }
        );
    }

    isAuthorized() {
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
                }
            }).catch(error => {
              if (error.response) {
                  this.onError(error.response.data.message);
              } else {
                this.onError(error);
              }
            });
    }

    authorize(redirect_uri) {
        const client_id = "da6ea27d63384e858d12bcce0fac006d";
        const url = "https://accounts.spotify.com/authorize" +
            "?client_id=" + client_id +
            "&response_type=code" +
            "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state,playlist-read-private,playlist-read-collaborative" +
            "&redirect_uri=" + encodeURIComponent(redirect_uri);

        window.open(url, "SpotiQu", "WIDTH=400,HEIGHT=550");

        this.authInterval = setInterval(this.isAuthorized, 2000);
    }

    createQueue() {
        this.authorize(config.backend.url + "/create");
    }

    reactivate() {
        this.authorize(config.backend.url + "/reactivate");
    }

    handleChangeEvent(value) {
        this.setState({
            enteredCode: value
        });
    }

    onSongEnd() {
        this.setState({
            isPlaying: false
        });
        setTimeout(() => {
            this.getCurrentTrack();
            this.getQueue();
            this.getUser();
        }, 500);
    }

    onQueued() {
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

    onSpotifyLogin() {
        this.getUser();
    }

    refreshCurrentlyPlaying() {
        setTimeout(this.getCurrentTrack, 500);
    }
    onPlaylistSelected() {
        this.getCurrentTrack();
        this.getSettings();
    }

    onError(msg) {
        if (typeof msg !== "string") {
            console.log(msg);
            msg = "Unexpected error occurred.";
        }
        this.setState({
            responseMsg: { msg, className: "alert-danger" }
        });
    }

    closeAlert() {
        this.setState({
            responseMsg: null
        });
    }

    onPauseResume() {
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

    render() {
        if (this.state.passcode) {
            return (
                <View>
                    {this.state.responseMsg ? <AlertBox alert={this.state.responseMsg} close={this.closeAlert} /> : null}
                    <View>
                        <View>
                            <View>
                                <CurrentlyPlaying isPlaying={this.state.isPlaying}
                                    currentTrack={this.state.currentTrack}
                                    isOwner={this.state.isOwner}
                                    user={this.state.user}
                                    onVoted={this.refreshCurrentlyPlaying}
                                    onPauseResume={this.onPauseResume}
                                    onSongEnd={this.onSongEnd}
                                    onError={this.onError} />
                            </View>
                            <View>
                                <Queue currentTrack={this.state.currentTrack}
                                    queue={this.state.queuedItems}
                                    onSkip={this.refreshCurrentlyPlaying}
                                    settings={this.state.settings}
                                    onQueued={this.onQueued}
                                    onError={this.onError} />
                            </View>
                        </View>
                        <View>
                            <Text>{this.state.settings ? this.state.settings.name : ""}</Text>
                            <SearchForm settings={this.state.settings}
                                isOwner={this.state.isOwner}
                                user={this.state.user}
                                onQueued={this.onQueued}
                                onPlaylistSelected={this.onPlaylistSelected}
                                onError={this.onError} />
                        </View>
                    </View>
                    <View>
                        <UserMenu passcode={this.state.passcode} onError={this.onError} onSpotifyLogin={this.onSpotifyLogin} user={this.state.user} />
                        <Share passcode={this.state.passcode} onError={this.onError} />
                        <UserList onError={this.onError} isOwner={this.state.isOwner} users={this.state.users} onEdit={this.getUsers} />
                        <QueueList onError={this.onError} queues={this.state.userQueues} passcode={this.state.passcode} selectQueue={this.selectQueue} />
                        {this.state.isOwner ? <DeviceSelect onError={this.onError} /> : null}
                        {
                            this.state.isOwner && this.state.settings ?
                            <Settings settings={this.state.settings} updateSettings={this.updateSettings} onError={this.onError} /> :
                            null
                        }
                    </View>
                </View>
            );
        } else {
            if (this.state.fontLoaded) {
              return (
                  <View style={styles.loginContainer}>
                    <View style={[{width: "90%"}, styles.btn]}>
                      <Button style={styles.text} color="#1DB954" type="submit" onPress={this.createQueue} title="Create/Restore Queue" />
                    </View>
                    <Text style={styles.text}>OR</Text>
                    <View style={{width: "90%"}}>
                      <TextInput style={styles.text} type="text" placeholder="Passcode" onChangeText={this.handleChangeEvent} />
                      <View style={styles.btn}>
                        <Button style={styles.text} color="#1DB954" type="submit" onPress={this.joinQueue} title="Join" />
                      </View>
                      <Text style={styles.error}>{this.state.joinError}</Text>
                      {this.state.reactivate 
                        ? <View style={styles.btn}>
                            <Button style={styles.text} color="#1DB954" type="submit" onPress={this.reactivate} title="Reactivate" />
                          </View>
                        : null}
                    </View>
                  </View>
              );
            } else {
              return (
                <View style={styles.loginContainer}>
                  <Text style={styles.loading}>Loading...</Text>
                </View>
              );
            }
        }
    }

    selectQueue(passcode) {
        this.setState({
            enteredCode: passcode
        }, this.joinQueue);
    }

    getUser() {
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

    getUsers() {
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

    getUserQueues() {
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

    getSettings() {
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

    updateSettings(settings, updatedFields) {
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

    getCurrentTrack() {
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

    getQueue() {
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
