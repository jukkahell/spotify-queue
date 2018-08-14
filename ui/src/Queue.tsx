import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";
import { ISettings } from "./Settings";
import Track, { ITrackProps } from "./Track";

export interface IQueuedItem {
    track: ITrackProps;
    userId: string;
    votes: IVote[];
    protected: boolean;
}

export interface IVote {
    userId: string;
    value: number;
}

interface IQueueProps {
    onQueued: () => void;
    onError: (msg: string) => void;
    onSkip: () => void;
    onProtected: () => void;
    queue: IQueuedItem[] | null;
    currentTrack: IQueuedItem | null;
    settings: ISettings | null;
    user: IUser | null;
}

interface IQueueState {
    contextMenuVisible: boolean;
    contextMenuTrack: IQueuedItem | null;
    contextMenuTargetPlaying: boolean;
}

export class Queue extends React.Component<IQueueProps, IQueueState> {

    public constructor(props: IQueueProps) {
        super(props);

        this.state = {
            contextMenuVisible: false,
            contextMenuTrack: null,
            contextMenuTargetPlaying: false
        };

        this.removeFromQueue = this.removeFromQueue.bind(this);
        this.showContextMenu = this.showContextMenu.bind(this);
        this.protectTrack = this.protectTrack.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.moveUp = this.moveUp.bind(this);
    }

    protected renderCurrentTrack() {
        if (!this.props.currentTrack) {
            return null;
        }
        return (
            <li key="currentTrack">
                <div className="dropup">
                    <Track
                        name={this.props.currentTrack.track.name}
                        artist={this.props.currentTrack.track.artist}
                        id={this.props.currentTrack.track.id}
                        artistId={this.props.currentTrack.track.artistId}
                        duration={this.props.currentTrack.track.duration}
                        key={"current-" + this.props.currentTrack.track.id}
                        isPlaying={true}
                        selectTrack={this.showContextMenu}/>
                    <div className={"dropdown-menu " + (this.state.contextMenuVisible ? "show" : "hide")} aria-labelledby="deviceMenuButton">
                        {this.renderContextMenu()}
                    </div>
                </div>
            </li>
        );
    }

    protected removeFromQueue(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        axios.delete(config.backend.url + "/removeFromQueue", {
            data: {
                trackId: this.state.contextMenuTrack!.track.id,
                isPlaying: this.state.contextMenuTargetPlaying
            }
        }).then(() => {
            this.props.onQueued();
            if (this.state.contextMenuTargetPlaying) {
                this.props.onSkip();
            }
            this.setState({
                contextMenuVisible: false,
                contextMenuTrack: null,
                contextMenuTargetPlaying: false
            });
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    protected protectTrack(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        axios.post(config.backend.url + "/protectTrack", {
            trackId: this.state.contextMenuTrack!.track.id,
            isPlaying: this.state.contextMenuTargetPlaying
        }).then(() => {
            this.props.onProtected();
            this.setState({
                contextMenuVisible: false,
                contextMenuTrack: null,
                contextMenuTargetPlaying: false
            });
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    protected moveUp(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        axios.post(config.backend.url + "/moveUpInQueue", {
            trackId: this.state.contextMenuTrack!.track.id
        }).then(() => {
            this.props.onQueued();
            this.setState({
                contextMenuVisible: false,
                contextMenuTrack: null,
                contextMenuTargetPlaying: false
            });
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    protected renderContextMenu() {
        if (!this.state.contextMenuTrack) {
            return null;
        }

        const menu = [];
        const showPoints = (this.state.contextMenuTrack.userId !== this.props.user!.id) ? "(-20 pts)" : "";
        if (!this.state.contextMenuTargetPlaying) {
            menu.push(
                <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
                    <FontAwesomeIcon icon="trash-alt" /> Remove from queue {showPoints}
                </a>
            );
            if (this.props.settings && this.props.settings.gamify) {
                menu.push(
                    <a className={"dropdown-item"} key={"moveUp"} href="#" onClick={this.moveUp}>
                        <FontAwesomeIcon icon="arrow-circle-up" /> Move up in queue (-5 pts)
                    </a>
                );
            }
        } else {
            menu.push(
                <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
                    <FontAwesomeIcon icon="forward" /> Skip {showPoints}
                </a>
            );
        }

        // If gamify enabled
        if (this.props.settings
            && this.props.settings.gamify
            && !this.state.contextMenuTrack.protected) {
            menu.push(
                <a className={"dropdown-item"} key={"protectTrack"} href="#" onClick={this.protectTrack}>
                    <FontAwesomeIcon icon="shield-alt" /> Protect from skip (-10 pts)
                </a>
            );
        }

        return menu;
    }
    protected showContextMenu(targetId: string, isPlaying: boolean) {
        const track: IQueuedItem = (!isPlaying)
            ? this.props.queue!.find(q => q.track.id === targetId)!
            : this.props.currentTrack!;
        this.setState((prevState) => ({
            contextMenuVisible: !prevState.contextMenuVisible,
            contextMenuTrack: track,
            contextMenuTargetPlaying: isPlaying
        }));
    }
    protected hideMenu() {
        this.setState(() => ({
            contextMenuVisible: false,
            contextMenuTrack: null,
            contextMenuTargetPlaying: false
        }));
    }

    protected renderTracks() {
        if (!this.props.queue) {
            return null;
        }

        return this.props.queue.map((queuedItem, i) => (
            <li key={"queue-" + i}>
                <div className="dropup">
                    <Track
                        name={queuedItem.track.name}
                        artist={queuedItem.track.artist}
                        id={queuedItem.track.id}
                        artistId={queuedItem.track.artistId}
                        duration={queuedItem.track.duration}
                        key={i + "-" + queuedItem.track.id}
                        isPlaying={false}
                        selectTrack={this.showContextMenu}/>
                </div>
            </li>
        ));
    }

    public render() {
        return (
            <div className="queue">
                <ol className={"queuedTracks " + (this.props.settings && this.props.settings.randomQueue ? "randomQueue" : "")}>
                    {this.renderCurrentTrack()}
                    {this.renderTracks()}
                </ol>
                <div className={"menuOverlay " + (this.state.contextMenuVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }
}
