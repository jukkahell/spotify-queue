import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import axios from "../node_modules/axios";
import config from "./config";
import Track, { ITrackProps } from "./Track";

export interface IQueuedItem {
    track: ITrackProps;
    userId: string;
    votes: IVote[];
}

export interface IVote {
    userId: string;
    value: number;
}

interface IQueueProps {
    onQueued: () => void;
    onError: (msg: string) => void;
    onSkip: () => void;
    queue: IQueuedItem[] | null;
    currentTrack: IQueuedItem | null;
}

interface IQueueState {
    contextMenuVisible: boolean;
    contextMenuTrackId: string | null;
    contextMenuTargetPlaying: boolean;
}

export class Queue extends React.Component<IQueueProps, IQueueState> {

    public constructor(props: IQueueProps) {
        super(props);

        this.state = {
            contextMenuVisible: false,
            contextMenuTrackId: null,
            contextMenuTargetPlaying: false
        };

        this.removeFromQueue = this.removeFromQueue.bind(this);
        this.voteUp = this.voteUp.bind(this);
        this.voteDown = this.voteDown.bind(this);
        this.showContextMenu = this.showContextMenu.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
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
                        selectTrack={this.showContextMenu}
                        selectArtist={this.showContextMenu}/>
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

    protected voteUp(e: React.MouseEvent<HTMLButtonElement>) {
        console.log(e.currentTarget.id);
    }

    protected voteDown(e: React.MouseEvent<HTMLButtonElement>) {
        console.log(e.currentTarget.id);
    }

    protected renderContextMenu() {
        if (!this.state.contextMenuTargetPlaying) {
            return (
                <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
                    <FontAwesomeIcon icon="trash-alt" /> Remove from queue
                </a>
            );
        } else {
            return (
                <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
                    <FontAwesomeIcon icon="forward" /> Skip
                </a>
            );
        }
    }
    protected showContextMenu(targetId: string, isPlaying: boolean) {
        this.setState((prevState) => ({
            contextMenuVisible: !prevState.contextMenuVisible,
            contextMenuTrackId: targetId,
            contextMenuTargetPlaying: isPlaying
        }));
    }
    protected hideMenu() {
        this.setState(() => ({
            contextMenuVisible: false,
            contextMenuTrackId: null,
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
                        selectTrack={this.showContextMenu}
                        selectArtist={this.showContextMenu}/>
                </div>
            </li>
        ));
    }

    protected renderVoteButtons() {
        if (!this.props.currentTrack) {
            return null;
        }
        let voteCount = 0;
        this.props.currentTrack.votes.forEach((v: IVote) => voteCount += v.value);
        return (
            <div className="voteButtons">
                <button type="submit" className="btn btn-primary voteButton up" id={this.props.currentTrack.track.id} onClick={this.voteUp}>
                    <FontAwesomeIcon icon="thumbs-up" />
                </button>
                <div className="voteCount">{voteCount > 0 ? "+" : ""}{voteCount}</div>
                <button type="submit" className="btn btn-primary voteButton down" id={this.props.currentTrack.track.id} onClick={this.voteDown}>
                    <FontAwesomeIcon icon="thumbs-down" />
                </button>
            </div>
        );
    }

    public render() {
        return (
            <div className="queue">
                {this.renderVoteButtons()}
                <ol className="queuedTracks">
                    {this.renderCurrentTrack()}
                    {this.renderTracks()}
                </ol>
                <div className={"menuOverlay " + (this.state.contextMenuVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }
}
