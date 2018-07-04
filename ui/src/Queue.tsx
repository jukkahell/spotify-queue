import axios from "axios";
import * as React from "react";
import Track, { ITrackProps } from "./Track";

interface IQueueProps {
    onQueued: () => void;
}

interface IQueueState {
    q: string;
    tracks: ITrackProps[];
}

export class Queue extends React.Component<IQueueProps, IQueueState> {

    public constructor(props: IQueueProps) {
        super(props);
        this.state = {
            q: "",
            tracks: []
        };

        this.getQueue();
    }

    public componentWillReceiveProps(nextProps: IQueueProps) {
        this.getQueue();
    }

    public getQueue() {
        axios.get("http://spotique.fi:8000/queue")
            .then(response => {
                this.setState({
                    tracks: response.data.tracks
                });
            }).catch(error => {
                console.log(error);
            }
        );
    }

    protected renderTracks() {
        return this.state.tracks.map((track, i) => (
            <li key={"queue-" + i}>
                <Track
                    name={track.name}
                    artist={track.artist}
                    id={track.id}
                    key={i + "-" + track.id}
                    onQueued={this.props.onQueued} />
            </li>
        ));
    }

    public render() {
        return (
            <div className="queue col-md-12">
                {this.state.tracks.length > 0 ? <h4>Queue</h4> : null}
                <ol className="queuedTracks">
                    {this.renderTracks()}
                </ol>
            </div>
        );
    }
}

export default Queue;
