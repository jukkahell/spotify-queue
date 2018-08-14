import icon from "./Icon";
import * as React from "react";
import axios from "axios";
import config from "./config";
import Track from "./Track";
import { Text, View } from "react-native";
import styles from "./styles";

export class Queue extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            contextMenuVisible: false,
            contextMenuTrackId: null,
            contextMenuTargetPlaying: false
        };

        this.removeFromQueue = this.removeFromQueue.bind(this);
        this.showContextMenu = this.showContextMenu.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.moveUp = this.moveUp.bind(this);
    }

    renderCurrentTrack() {
        if (!this.props.currentTrack) {
            return null;
        }
        return (
            <View>
                <View>
                    <Track
                        name={this.props.currentTrack.track.name}
                        artist={this.props.currentTrack.track.artist}
                        id={this.props.currentTrack.track.id}
                        artistId={this.props.currentTrack.track.artistId}
                        duration={this.props.currentTrack.track.duration}
                        key={"current-" + this.props.currentTrack.track.id}
                        isPlaying={true}
                        selectTrack={this.showContextMenu}/>
                    <View style={[(this.state.contextMenuVisible ? styles.show : styles.hide)]}>
                        {this.renderContextMenu()}
                    </View>
                </View>
            </View>
        );
    }

    removeFromQueue(e) {
        e.preventDefault();

        axios.delete(config.backend.url + "/removeFromQueue", {
            data: {
                trackId: this.state.contextMenuTrackId,
                isPlaying: this.state.contextMenuTargetPlaying
            }
        }).then(() => {
            this.props.onQueued();
            if (this.state.contextMenuTargetPlaying) {
                this.props.onSkip();
            }
            this.setState({
                contextMenuVisible: false,
                contextMenuTrackId: null,
                contextMenuTargetPlaying: false
            });
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    moveUp(e) {
        e.preventDefault();

        axios.post(config.backend.url + "/moveUpInQueue", {
            trackId: this.state.contextMenuTrackId
        }).then(() => {
            this.props.onQueued();
            this.setState({
                contextMenuVisible: false,
                contextMenuTrackId: null,
                contextMenuTargetPlaying: false
            });
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    renderContextMenu() {
        if (!this.state.contextMenuTargetPlaying) {
            const menu = [
                <View className={"dropdown-item"} key={"removeFromQueue"} onPress={this.removeFromQueue}>
                    <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["trash-alt"]}</Text><Text>Remove from queue</Text>
                </View>
            ];
            if (this.props.settings && this.props.settings.gamify) {
                menu.push(
                    <View className={"dropdown-item"} key={"moveUp"} onPress={this.moveUp}>
                        <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["arrow-circle-up"]}</Text><Text>Move up in queue (-5 pts)</Text>
                    </View>
                );
            }
            return menu;
        } else {
            return (
                <View className={"dropdown-item"} key={"removeFromQueue"} onPress={this.removeFromQueue}>
                    <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["forward"]}</Text><Text>Skip</Text>
                </View>
            );
        }
    }
    showContextMenu(targetId, isPlaying) {
        this.setState((prevState) => ({
            contextMenuVisible: !prevState.contextMenuVisible,
            contextMenuTrackId: targetId,
            contextMenuTargetPlaying: isPlaying
        }));
    }
    hideMenu() {
        this.setState(() => ({
            contextMenuVisible: false,
            contextMenuTrackId: null,
            contextMenuTargetPlaying: false
        }));
    }

    renderTracks() {
        if (!this.props.queue) {
            return null;
        }

        return this.props.queue.map((queuedItem, i) => (
            <View key={"queue-" + i}>
                <View>
                    <Track
                        name={queuedItem.track.name}
                        artist={queuedItem.track.artist}
                        id={queuedItem.track.id}
                        artistId={queuedItem.track.artistId}
                        duration={queuedItem.track.duration}
                        key={i + "-" + queuedItem.track.id}
                        isPlaying={false}
                        selectTrack={this.showContextMenu}/>
                </View>
            </View>
        ));
    }

    render() {
        return (
            <View>
                <View style={[styles.queuedTracks, (this.props.settings && this.props.settings.randomQueue ? styles.randomQueue : "")]}>
                    {this.renderCurrentTrack()}
                    {this.renderTracks()}
                </View>
                <View style={[styles.menuOverlay, (this.state.contextMenuVisible ? styles.visible : styles.hidden)]} onClick={this.hideMenu}/>
            </View>
        );
    }
}
