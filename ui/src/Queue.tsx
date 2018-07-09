import * as React from "react";
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

    public render() {
        return (
            <div className="queue col-md-12">
                <ol className="queuedTracks">
                    {this.renderCurrentTrack()}
                    {this.renderTracks()}
                </ol>
            </div>
        );
    }
}
