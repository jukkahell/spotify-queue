import * as React from "react";
import { FontAwesomeIcon } from "../node_modules/@fortawesome/react-fontawesome";
import Track, { ITrackProps } from "./Track";

export interface IQueuedItem {
    track: ITrackProps;
    userId: string;
}

interface IQueueProps {
    onQueued: () => void;
    onError: (msg: string) => void;
    queue: IQueuedItem[] | null;
    currentTrack: IQueuedItem | null;
}

export class Queue extends React.Component<IQueueProps> {

    public constructor(props: IQueueProps) {
        super(props);

        this.removeFromQueue = this.removeFromQueue.bind(this);
        this.voteUp = this.voteUp.bind(this);
        this.voteDown = this.voteDown.bind(this);
    }

    protected renderCurrentTrack() {
        if (!this.props.currentTrack) {
            return null;
        }
        return (
            <li key="currentTrack">
                <Track
                    name={this.props.currentTrack.track.name}
                    artist={this.props.currentTrack.track.artist}
                    id={this.props.currentTrack.track.id}
                    duration={this.props.currentTrack.track.duration}
                    key={"current-" + this.props.currentTrack.track.id}
                    isPlaying={true}
                    onQueued={this.props.onQueued}
                    onError={this.props.onError} />
            </li>
        );
    }

    protected removeFromQueue(e: React.MouseEvent<HTMLButtonElement>) {
        console.log(e.currentTarget.id);
    }

    protected voteUp(e: React.MouseEvent<HTMLButtonElement>) {
        console.log(e.currentTarget.id);
    }

    protected voteDown(e: React.MouseEvent<HTMLButtonElement>) {
        console.log(e.currentTarget.id);
    }

    protected renderTracks() {
        if (!this.props.queue) {
            return null;
        }

        return this.props.queue.map((queuedItem, i) => (
            <li key={"queue-" + i}>
                <Track
                    name={queuedItem.track.name}
                    artist={queuedItem.track.artist}
                    id={queuedItem.track.id}
                    duration={queuedItem.track.duration}
                    key={i + "-" + queuedItem.track.id}
                    isPlaying={false}
                    onQueued={this.props.onQueued}
                    onError={this.props.onError} />
            </li>
        ));
    }

    protected renderVoteButtons() {
        if (!this.props.currentTrack) {
            return null;
        }

        return (
            <div className="voteButtons">
                <button type="submit" className="btn btn-primary voteButton up" id={this.props.currentTrack.track.id} onClick={this.voteUp}>
                    <FontAwesomeIcon icon="thumbs-up" />
                </button>
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
            </div>
        );
    }
}
