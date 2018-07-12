import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import config from "./config";

export interface ITrackProps {
    name: string;
    artist: string;
    id: string;
    duration: number;
    progress?: number;
    cover?: string;
    isPlaying: boolean;
    onQueued: () => void;
    onError: (msg: string) => void;
}

export class Track extends React.Component<ITrackProps> {

    public constructor(props: ITrackProps) {
        super(props);
        this.addToQueue = this.addToQueue.bind(this);
    }

    protected addToQueue(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        axios.post(config.backend.url + "/track", { spotifyUri: event.currentTarget.id })
            .then(() => {
                this.props.onQueued();
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    public render() {
        const {
            name,
            artist,
            id,
            isPlaying
        } = this.props;

        return (
            <div>
                <a className={(isPlaying ? "currentTrack" : "")} onClick={this.addToQueue} href="#" id={id}>{artist} - {name}</a>
                {isPlaying ? <FontAwesomeIcon icon="volume-up" /> : null}
            </div>
        );
    }
}

export default Track;
