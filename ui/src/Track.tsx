import axios from "axios";
import * as React from "react";
import config from "./config";

export interface ITrackProps {
    name: string;
    artist: string;
    id: string;
    onQueued: () => void;
}

export class Track extends React.Component<ITrackProps> {

    public constructor(props: ITrackProps) {
        super(props);
        this.addToQueue = this.addToQueue.bind(this);
    }

    protected addToQueue(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        axios.get(config.backend.url + "/addSong?id=" + event.currentTarget.id)
            .then(response => {
                this.props.onQueued();
            }).catch(err => {
                console.log(err);
            }
        );
    }

    public render() {
        const {
            name,
            artist,
            id
        } = this.props;

        return (
            <div>
                <a onClick={this.addToQueue} href="#" id={id}>{artist} - {name}</a>
            </div>
        );
    }
}

export default Track;
